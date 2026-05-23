# STORY-05 — Real-bestseller (Loop 2): order-products sync + storefront "Bán chạy thật"

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 5h
**Money loop:** Loop 2 — "User mua gì thật, không chỉ click gì?"
**Dependencies:** STORY-02 (reconcile manual button đã wired LastSyncStatus). Cross-ref vn-storefront-v2 STORY-02 cho storefront mount slot.

## Context

**Vấn đề**: Storefront hiện rank product theo:
- Discount % (cao xuống thấp) — homepage "Deal hot tuần", niche page.
- AT `top_products` snapshot — homepage "🔥 Đang hot tuần này" (data marketing AT push, ko phải thực mua).

**Sự thật**: top click ≠ top buy. Có sản phẩm giảm 70% được click nhiều nhưng ko ai mua thật (giá vẫn quá cao, hoặc product chất lượng kém). Có sản phẩm giảm 15% nhưng convert tốt.

**Giải pháp**: AT có endpoint `GET /v1/order-products` trả các product line trong từng order — biết **user thực mua sản phẩm nào** sau khi click qua dealvault.

**Flow**:
1. Reconciler (manual hoặc cron) pull `/v1/order-list` mỗi run.
2. **Hook mới**: với mỗi order mới chưa có order-products data → pull tiếp `/v1/order-products?order_id=X&merchant=Y`.
3. Save vào `OrderProduct` table — biết "click product A → mua product B" (A có thể null nếu user mua thêm thứ khác).
4. Compute "Bán chạy thật" ranking per niche per week.
5. Render trong:
   - Admin insight tab "Sản phẩm bán chạy thật".
   - Storefront homepage section "✅ Bán chạy thật tuần" (slot bên cạnh existing "🔥 Top discount").
   - Niche page sub-section.

## User story

> **As** operator + user storefront,
> **I want** thấy sản phẩm có evidence mua thật, không chỉ marketing top_products của AT,
> **so that** operator tune content theo data real, user thấy "bán chạy thật" trust hơn "đang hot".

## Acceptance criteria

### AC1 — Schema: OrderProduct model

`apps/api/prisma/schema.prisma`:

```prisma
model OrderProduct {
  id                  String   @id @default(uuid()) @db.Uuid
  conversionWebhookId String   @db.Uuid                       // FK to existing ConversionWebhook (which has order_id)
  conversionWebhook   ConversionWebhook @relation(fields: [conversionWebhookId], references: [id], onDelete: Cascade)
  atOrderProductId    String                                   // ._id từ AT response
  atCampaignId        String?                                  // campaign_id thật từ order-products (rare source)
  merchant            String
  atProductId         String?                                  // có thể null
  productName         String?                                  // nếu AT trả
  productImage        String?
  productPrice        Float?
  productQuantity     Int?
  approvedQuantity    Int      @default(0)
  pendingQuantity     Int      @default(0)
  rejectQuantity      Int      @default(0)
  approvedBilling     Float    @default(0)
  approvedCommission  Float    @default(0)
  salesTime           DateTime?
  fetchedAt           DateTime @default(now())

  // Match với Product nội bộ nếu detect được (theo atProductId hoặc affLink suffix)
  matchedProductId    String?  @db.Uuid
  matchedProduct      Product? @relation(fields: [matchedProductId], references: [id], onDelete: SetNull)

  @@unique([conversionWebhookId, atOrderProductId])
  @@index([matchedProductId])
  @@index([salesTime])
}
```

Add inverse relation trong `ConversionWebhook`:
```prisma
model ConversionWebhook {
  // ... existing ...
  orderProducts OrderProduct[]
}
```

Add inverse trong `Product`:
```prisma
model Product {
  // ... existing ...
  orderProducts OrderProduct[]
}
```

Migration: `npm run db:migrate -- --name add_order_products`.

### AC2 — Extend AccesstradeClient

File: `apps/api/src/modules/crawler/clients/accesstrade.client.ts`.

```ts
async fetchOrderProducts(opts: { orderId: string; merchant: string; page?: number; limit?: number }): Promise<OrderProductsResponse> {
  const params = new URLSearchParams({
    order_id: opts.orderId,
    merchant: opts.merchant,
    page: String(opts.page ?? 1),
    limit: String(opts.limit ?? 100)
  });
  const res = await this.httpClient.get(`/v1/order-products?${params}`);
  return res.data; // shape doc mục 3.7
}
```

### AC3 — Hook vào reconciler

File: `apps/api/src/modules/reconciliation/reconciliation.service.ts`.

Hiện reconciler:
1. Pull `/v1/order-list` per page với pagination.
2. Match `order.utm_source` với `ConversionWebhook.trackingCode` → update commission.

Thêm step 3 sau match:

```ts
async runCycle() {
  return this.syncStatus.wrap("reconcile", async () => {
    // ... existing logic match order-list ...

    // NEW: pull order-products cho mỗi order mới reconciled lần đầu
    const recentlyReconciled = await this.prisma.conversionWebhook.findMany({
      where: {
        atOrderId: { not: null },
        // chưa có OrderProduct nào
        orderProducts: { none: {} }
      },
      take: 50, // cap 50 per cycle để khỏi rate-limit
      orderBy: { createdAt: "desc" }
    });

    let orderProductsFetched = 0;
    for (const cw of recentlyReconciled) {
      if (!cw.atOrderId || !cw.merchant) continue;
      try {
        await new Promise(r => setTimeout(r, 7000)); // AT rate-limit /order-products = 10 req/min
        const res = await this.accesstrade.fetchOrderProducts({
          orderId: cw.atOrderId,
          merchant: cw.merchant
        });
        const items = res.data ?? [];
        for (const item of items) {
          // Match với Product nội bộ theo atProductId (nếu có) hoặc skip
          const matchedProduct = item.atProductId
            ? await this.prisma.product.findFirst({ where: { scrapedData: { path: ["sourceId"], equals: item.atProductId } } })
            : null;

          await this.prisma.orderProduct.upsert({
            where: { conversionWebhookId_atOrderProductId: { conversionWebhookId: cw.id, atOrderProductId: item._id } },
            create: {
              conversionWebhookId: cw.id,
              atOrderProductId: item._id,
              atCampaignId: item.campaign_id,
              merchant: item.merchant,
              atProductId: item.atProductId ?? null,
              productPrice: item.product_price,
              productQuantity: item.product_quantity,
              approvedQuantity: item.quantity?.approved ?? 0,
              pendingQuantity: item.quantity?.pending ?? 0,
              rejectQuantity: item.quantity?.reject ?? 0,
              approvedBilling: item.billing?.approved ?? 0,
              approvedCommission: item.commission?.approved ?? 0,
              salesTime: item.sales_time ? new Date(item.sales_time) : null,
              matchedProductId: matchedProduct?.id ?? null
            },
            update: {} // don't update if exists
          });
          orderProductsFetched++;
        }
      } catch (err) {
        this.logger.warn(`fetchOrderProducts failed for ${cw.atOrderId}: ${err}`);
        // Continue with next order
      }
    }

    return { ...existingResult, orderProductsFetched };
  });
}
```

### AC4 — `RealBestsellerService` — compute ranking

NEW: `apps/api/src/modules/insights/real-bestseller.service.ts`.

```ts
@Injectable()
export class RealBestsellerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Top products with proven sales in given window.
   * @param days lookback window
   * @param nicheSlug filter to specific niche (optional)
   * @param limit max results
   */
  async getTopReal(opts: { days?: number; nicheSlug?: string; limit?: number }) {
    const days = opts.days ?? 7;
    const limit = opts.limit ?? 10;
    const since = new Date(Date.now() - days * 86400000);

    // Aggregate: matched product với tổng approvedQuantity + approvedCommission
    const rows = await this.prisma.$queryRaw<Array<{
      productId: string;
      totalQty: number;
      totalCommission: number;
      orderCount: number;
    }>>`
      SELECT
        op."matchedProductId" as "productId",
        SUM(op."approvedQuantity")::int as "totalQty",
        SUM(op."approvedCommission")::float as "totalCommission",
        COUNT(DISTINCT op."conversionWebhookId")::int as "orderCount"
      FROM "OrderProduct" op
      WHERE op."matchedProductId" IS NOT NULL
        AND op."salesTime" >= ${since}
        ${opts.nicheSlug ? Prisma.sql`AND op."matchedProductId" IN (SELECT id FROM "Product" WHERE "nicheId" IN (SELECT id FROM "Niche" WHERE slug = ${opts.nicheSlug}))` : Prisma.empty}
      GROUP BY op."matchedProductId"
      ORDER BY "totalQty" DESC, "totalCommission" DESC
      LIMIT ${limit}
    `;

    // Hydrate product details
    const productIds = rows.map(r => r.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isPublic: true },
      include: { niche: { select: { slug: true, name: true } } }
    });

    return rows.map(r => ({
      ...products.find(p => p.id === r.productId)!,
      realBestsellerStats: {
        totalSoldUnits: r.totalQty,
        orderCount: r.orderCount,
        totalCommission: r.totalCommission,
        windowDays: days
      }
    })).filter(p => p.id); // drop nếu product đã isPublic=false
  }
}
```

### AC5 — Endpoint `GET /admin/insights/real-bestseller`

```ts
@Get("insights/real-bestseller")
async getRealBestseller(
  @Query("days") days?: string,
  @Query("nicheSlug") nicheSlug?: string,
  @Query("limit") limit?: string,
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
  return this.realBestseller.getTopReal({
    days: days ? parseInt(days) : 7,
    nicheSlug,
    limit: limit ? parseInt(limit) : 10
  });
}
```

### AC6 — Public storefront endpoint

```ts
// apps/api/src/modules/storefront/storefront.controller.ts (NEW or extend)
@Get("real-bestseller")
async getPublicRealBestseller(
  @Query("days") days?: string,
  @Query("nicheSlug") nicheSlug?: string,
  @Query("limit") limit?: string
) {
  return this.realBestseller.getTopReal({
    days: days ? parseInt(days) : 7,
    nicheSlug,
    limit: limit ? parseInt(limit) : 8
  });
}
```

Public route, no auth — sẽ render trong storefront RSC.

### AC7 — Storefront component: RealBestsellerSection

NEW: `apps/web/components/storefront/real-bestseller-section.tsx` (RSC).

```tsx
import { fetchRealBestseller } from "../../lib/api";
import { ProductGrid } from "./product-grid";
import { SectionHeading } from "../ui/section";

interface Props {
  nicheSlug?: string;
  limit?: number;
}

export async function RealBestsellerSection({ nicheSlug, limit = 8 }: Props) {
  const products = await fetchRealBestseller({ days: 7, nicheSlug, limit });
  if (products.length === 0) return null; // ko render section nếu chưa có data

  return (
    <section className="py-8">
      <SectionHeading
        title="✅ Bán chạy thật tuần này"
        description="Sản phẩm có nhiều người mua thật qua dealvault — không phải chỉ click."
        trailing={<>{products.length} sản phẩm</>}
      />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map(p => (
          <ProductCard key={p.id} product={normalizeProduct(p)} nicheSlug={p.niche.slug} />
        ))}
      </div>
    </section>
  );
}
```

`fetchRealBestseller` add vào `apps/web/lib/api.ts`:

```ts
export async function fetchRealBestseller(opts: { days?: number; nicheSlug?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (opts.days) params.set("days", String(opts.days));
  if (opts.nicheSlug) params.set("nicheSlug", opts.nicheSlug);
  if (opts.limit) params.set("limit", String(opts.limit));
  return safeFetch<ProductItem[]>(`${API_BASE_URL}/storefront/real-bestseller?${params}`, "GET");
}
```

### AC8 — Mount slot trong storefront (CROSS-REF)

Mount point depend storefront-v2 status:

**Option A — Storefront-v2 STORY-02 (homepage rebuild) đã merge**:
- Storefront-v2 STORY-02 có section "🔥 Deal hot trong tuần" (top discount).
- Story này thêm 1 section **ngay trên** đó: `<RealBestsellerSection limit={8} />`.
- Khi data có ≥4 product → render; ko thì hide gracefully.

**Option B — Storefront-v2 STORY-02 chưa merge**:
- Mount vào homepage hiện tại `apps/web/app/page.tsx` ngay sau "🔥 Đang hot tuần này" section.
- PR riêng từ STORY-05 chỉ thêm 1 import + 1 dòng `<RealBestsellerSection />` — không xung đột storefront-v2 sau merge.

Niche page (STORY-04 storefront-v2 hoặc current):
- Mount `<RealBestsellerSection nicheSlug={niche.slug} limit={4} />` trên top của grid niche.

### AC9 — Admin insight tab

NEW page: `apps/web/app/admin/insights/real-bestseller/page.tsx`.

```tsx
export default async function RealBestsellerInsightPage() {
  const products = await adminFetch<ProductWithStats[]>("/admin/insights/real-bestseller?days=30&limit=50", "GET");

  return (
    <AdminPageShell title="Sản phẩm bán chạy thật" subtitle="Dựa trên order-products data từ Accesstrade, 30 ngày qua">
      <table>
        {/* columns: Rank, Image, Name, Niche, Sold Units, Order Count, Commission Earned, [Action: pin homepage] */}
      </table>
    </AdminPageShell>
  );
}
```

Sub-menu admin sidebar STORY-03 thêm: "Tiền & Hiệu suất → Bán chạy thật".

### AC10 — Metric trong KPI widget

Update KPI widget (STORY-03 AC3) thêm 1 stat:

```
• Tuần này: X click → Y đơn → Z VND
• Top sản phẩm bán chạy thật: [Tên sản phẩm], N đơn
```

Pull from `RealBestsellerService.getTopReal({ days: 7, limit: 1 })`.

## Files touched

```
apps/api/prisma/schema.prisma                                   (add OrderProduct + relations)
apps/api/prisma/migrations/<ts>_add_order_products/             (NEW)
apps/api/src/modules/crawler/clients/accesstrade.client.ts      (add fetchOrderProducts)
apps/api/src/modules/reconciliation/reconciliation.service.ts   (hook order-products after order-list match)
apps/api/src/modules/insights/real-bestseller.service.ts        (NEW)
apps/api/src/modules/insights/insights.module.ts                (register RealBestsellerService)
apps/api/src/modules/admin/admin.controller.ts                  (GET /admin/insights/real-bestseller)
apps/api/src/modules/storefront/storefront.controller.ts        (NEW or extend — GET /storefront/real-bestseller)
apps/web/components/storefront/real-bestseller-section.tsx      (NEW RSC)
apps/web/lib/api.ts                                             (add fetchRealBestseller)
apps/web/app/page.tsx OR storefront-v2 STORY-02 homepage         (mount section, 1-2 lines)
apps/web/app/admin/insights/real-bestseller/page.tsx            (NEW admin insight tab)
apps/web/components/admin/dashboard/kpi-widget.tsx              (extend với top sản phẩm bán chạy real)
```

## Verification

```bash
# 1. Migration
npm run db:migrate -- --name add_order_products

# 2. Manual reconcile triggers order-products fetch
curl -X POST http://localhost:4000/api/v1/admin/sync/reconcile -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: result includes orderProductsFetched count

# 3. Check OrderProduct populated
psql -c "SELECT COUNT(*) FROM \"OrderProduct\""
# expect: > 0 nếu có ConversionWebhook đã reconciled

# 4. Admin insight query
curl http://localhost:4000/api/v1/admin/insights/real-bestseller -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: array with realBestsellerStats per product

# 5. Storefront endpoint
curl http://localhost:4000/api/v1/storefront/real-bestseller?limit=4
# expect: 4 products (or fewer if data thin)

# 6. Frontend section render
# Open homepage → section "✅ Bán chạy thật tuần này" hiển thị
# Nếu DB chưa có OrderProduct → section hidden (ko empty placeholder)

# 7. Niche page
# Open /categories/laptop → "Bán chạy thật tuần" sub-section top

# 8. Admin tab
# Open /admin/insights/real-bestseller → table 50 row
```

## Definition of done

- [ ] `OrderProduct` migrated với indexes.
- [ ] `fetchOrderProducts` work, respect 10 req/min rate limit (7s sleep).
- [ ] Reconciler hook fetch order-products cho recently reconciled (cap 50/cycle).
- [ ] `matchedProductId` set khi product nội bộ có `sourceId` khớp.
- [ ] `RealBestsellerService` aggregate đúng + filter niche option.
- [ ] Admin `/admin/insights/real-bestseller` table render.
- [ ] Storefront `/api/v1/storefront/real-bestseller` public.
- [ ] `RealBestsellerSection` component render trong homepage + niche page (hide gracefully nếu data ít).
- [ ] KPI widget show top sản phẩm bán chạy real.
- [ ] Conflict-free với storefront-v2 STORY-02 (only adds import + mount line).

## Notes for next session

- Match `atProductId` với `Product.scrapedData.sourceId` — verify field name trong scrapedData. Có thể là `id`, `productId`, `sourceId` tuỳ niche. Check `normalizeProduct` để biết chính xác.
- Order-products endpoint giới hạn 10 req/min — cap 50 order/cycle với 7s sleep = ~6 phút worst case. Nếu reconcile rất nhiều order/lần (>50), sẽ defer phần dư sang lần sau. Acceptable.
- Future enhancement: AT có thể trả product user mua mà KHÔNG có trong feed của ta (vd: user click laptop A nhưng cuối mua adapter B từ shop khác). Lưu `OrderProduct.matchedProductId = null` cho case này. Insight: "Tỷ lệ user mua product khác với click = X%" → cross-sell signal.
- Có thể thêm column "Click-to-buy switch rate" trong admin insight: % order có product mua ≠ product click đầu tiên.
- Storefront `RealBestsellerSection` nếu < 4 product → ẩn (đừng render section trống). > 4 thì show.
- Public endpoint cache `s-maxage=600` (10 phút) — data thay đổi slow.
