# STORY-07 — Top products carousel homepage

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 3h
**Dependencies:** [STORY-01](STORY-01-schema-migration.md). Có thể chạy parallel với mọi story khác sau STORY-01.

## Context

AT cung cấp `/v1/top_products` ([doc mục 3.10](../../../integrations/accesstrade.md#310-get-v1top_products--top-sản-phẩm-bán-chạy-chưa-dùng)) — top 50 sản phẩm bán chạy trong khoảng ngày tuỳ chọn. Có ích cho:
- Homepage carousel "Đang hot tuần này".
- "Xu hướng" section cuối Category page.
- Cross-sell: gợi ý sản phẩm hot từ merchant khác.

Story này pull top_products mỗi 24h vào table cache + render homepage section.

**Không phải HITL**: data này chỉ dùng cho gợi ý/xếp hạng, không đè lên Product duyệt. Top products link về AT trực tiếp (aff_link), không qua Product DB của ta — đỡ phức tạp.

## User story

> **As** user truy cập homepage,
> **I want** thấy section "Top sản phẩm bán chạy" tự động cập nhật theo data thật từ Accesstrade,
> **so that** trang không tĩnh + tăng CTR vào affiliate link.

## Acceptance criteria

### AC1 — Schema mới `TopProductSnapshot`

Migration: `apps/api/prisma/migrations/<timestamp>_top_products/migration.sql`

```prisma
model TopProductSnapshot {
  id              String   @id @default(uuid()) @db.Uuid
  snapshotDate    DateTime                          // ngày snapshot (00:00:00)
  position        Int                                // thứ hạng 1-50 trong snapshot
  atProductId     String                             // product_id từ AT
  name            String
  brand           String?
  image           String?
  link            String                             // URL gốc
  affLink         String                             // aff_link tracking
  categoryName    String?
  productCategory String?
  price           Decimal?  @db.Decimal(15, 2)
  discount        Decimal?  @db.Decimal(15, 2)       // giá sau giảm (VND)
  merchant        String?                            // optional filter source
  shortDesc       String?
  atRawData       Json?     @db.JsonB
  createdAt       DateTime  @default(now())

  @@unique([snapshotDate, position, atProductId])
  @@index([snapshotDate])
  @@index([merchant, snapshotDate])
}
```

**Quyết định design**: lưu **snapshot per day** thay vì overwrite. Cho phép xem history "top tuần trước" sau này. Cron sẽ tạo snapshot mới hằng ngày, public route lấy snapshot mới nhất.

Chạy `npm run prisma:migrate --workspace api -- --name top_products`.

### AC2 — `AccesstradeClient.fetchTopProducts()`

File: [apps/api/src/modules/crawler/clients/accesstrade.client.ts](../../../../apps/api/src/modules/crawler/clients/accesstrade.client.ts)

```ts
interface AtTopProduct {
  product_id: string;
  name: string;
  brand?: string;
  image: string;
  link: string;
  aff_link: string;
  category_id?: string;
  category_name?: string;
  product_category?: string;
  price?: number;
  discount?: number;
  short_desc?: string;
  desc?: string;
}

async fetchTopProducts(opts: {
  dateFrom?: Date;
  dateTo?: Date;
  merchant?: string;
} = {}): Promise<AtTopProduct[]> {
  if (!this.isConfigured()) return [];
  const base = process.env.ACCESSTRADE_API_BASE ?? "https://api.accesstrade.vn/v1";
  const params = new URLSearchParams();
  // Format DD-MM-YYYY (KHÔNG phải ISO!) — xem gotcha #9 trong doc AT
  if (opts.dateFrom) params.set("date_from", this.toAtDayFormat(opts.dateFrom));
  if (opts.dateTo) params.set("date_to", this.toAtDayFormat(opts.dateTo));
  if (opts.merchant) params.set("merchant", opts.merchant);
  const url = `${base}/top_products?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Token ${process.env.ACCESSTRADE_ACCESS_TOKEN}`,
        Accept: "application/json"
      }
    });
    if (!resp.ok) {
      const body = await resp.text();
      this.logger.error(`Accesstrade /top_products ${resp.status}: ${body.slice(0, 300)}`);
      return [];
    }
    const json = (await resp.json()) as { data: AtTopProduct[]; total?: number };
    return Array.isArray(json.data) ? json.data : [];
  } catch (error) {
    this.logger.error("Accesstrade fetchTopProducts failed", error instanceof Error ? error.message : String(error));
    return [];
  }
}

private toAtDayFormat(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
```

### AC3 — Service + Scheduler

File mới: `apps/api/src/modules/crawler/top-products-sync.service.ts`

```ts
@Injectable()
export class TopProductsSyncService {
  private readonly logger = new Logger(TopProductsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  async syncDailySnapshot(): Promise<{ created: number; date: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check đã có snapshot today chưa
    const existing = await this.prisma.topProductSnapshot.findFirst({
      where: { snapshotDate: today }
    });
    if (existing) {
      this.logger.log("Top products snapshot for today already exists, skipping");
      return { created: 0, date: today.toISOString() };
    }

    // Pull data từ 7 ngày qua
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);

    const products = await this.accesstrade.fetchTopProducts({ dateFrom, dateTo });
    if (products.length === 0) {
      this.logger.warn("AT returned 0 top products");
      return { created: 0, date: today.toISOString() };
    }

    let created = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.product_id || !p.aff_link) continue;
      await this.prisma.topProductSnapshot.create({
        data: {
          snapshotDate: today,
          position: i + 1,
          atProductId: p.product_id,
          name: p.name,
          brand: p.brand ?? null,
          image: p.image ?? null,
          link: p.link,
          affLink: p.aff_link,
          categoryName: p.category_name ?? null,
          productCategory: p.product_category ?? null,
          price: p.price ? new Prisma.Decimal(p.price) : null,
          discount: p.discount ? new Prisma.Decimal(p.discount) : null,
          shortDesc: p.short_desc?.slice(0, 500) ?? null,
          atRawData: p as unknown as Prisma.InputJsonValue
        }
      });
      created += 1;
    }

    this.logger.log(`Top products snapshot created: ${created} items for ${today.toISOString().slice(0, 10)}`);
    return { created, date: today.toISOString() };
  }

  /**
   * Lấy snapshot mới nhất cho storefront. Nếu hôm nay chưa sync, dùng snapshot gần nhất.
   */
  async getLatestSnapshot(limit = 12): Promise<Array<unknown>> {
    const latest = await this.prisma.topProductSnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    });
    if (!latest) return [];

    return this.prisma.topProductSnapshot.findMany({
      where: { snapshotDate: latest.snapshotDate },
      orderBy: { position: "asc" },
      take: limit
    });
  }
}
```

Scheduler `top-products-sync.scheduler.ts`:

```ts
@Injectable()
export class TopProductsSyncScheduler {
  private readonly logger = new Logger(TopProductsSyncScheduler.name);

  constructor(private readonly service: TopProductsSyncService) {}

  // Mỗi ngày 3h sáng
  @Cron(process.env.TOP_PRODUCTS_CRON ?? "0 3 * * *", { name: "top-products-sync" })
  async handleCron() {
    if (process.env.TOP_PRODUCTS_ENABLED === "false") return;
    try {
      await this.service.syncDailySnapshot();
    } catch (error) {
      this.logger.error("Top products sync failed", error instanceof Error ? error.stack : String(error));
    }
  }
}
```

Register vào `CrawlerModule`.

### AC4 — Public endpoint

Thêm vào [admin.controller.ts không phù hợp — public endpoint nên thêm controller mới hoặc reuse]: tạo `TopProductsController` riêng hoặc thêm vào existing public controller.

File mới: `apps/api/src/modules/top-products/top-products.controller.ts`

```ts
@Controller("top-products")
export class TopProductsController {
  constructor(private readonly service: TopProductsSyncService) {}

  @Get()
  async getTop(@Query("limit") limit?: string) {
    return this.service.getLatestSnapshot(Math.min(Number(limit ?? 12), 50));
  }
}
```

Register vào [app.module.ts](../../../../apps/api/src/modules/app.module.ts).

### AC5 — Admin endpoint manual trigger

```ts
@Post("top-products/sync")
async syncTopProducts(...) {
  this.authorize(role, apiKey, ["admin"]);
  return this.topProducts.syncDailySnapshot();
}
```

### AC6 — Homepage section UI

File: [apps/web/app/page.tsx](../../../../apps/web/app/page.tsx)

Thêm section sau hero / trước listing chính:

```tsx
async function TopProductsSection() {
  const items = await fetch(`${process.env.API_BASE}/top-products?limit=12`, {
    next: { revalidate: 3600 }            // ISR 1h
  }).then((r) => r.json());

  if (items.length === 0) return null;

  return (
    <section className="py-12">
      <h2 className="text-2xl font-bold mb-6">🔥 Đang hot tuần này</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((p) => (
          <TopProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
```

File mới: `apps/web/components/top-product-card.tsx`

```tsx
export function TopProductCard({ product }: { product: TopProduct }) {
  return (
    <a
      href={product.affLink}
      target="_blank"
      rel="nofollow sponsored"
      className="block group"
    >
      <div className="aspect-square relative overflow-hidden rounded-lg bg-muted">
        {product.image && (
          <Image src={product.image} alt={product.name} fill className="object-cover" />
        )}
        <Badge className="absolute top-2 left-2">#{product.position}</Badge>
      </div>
      <h3 className="mt-2 text-sm line-clamp-2">{product.name}</h3>
      {product.discount && (
        <p className="text-primary font-semibold">{formatVND(product.discount)}</p>
      )}
    </a>
  );
}
```

**Lưu ý**: link click thẳng ra AT `affLink`, **không qua tracking nội bộ** vì top-products không phải Product DB. Trade-off: mất tracking nội bộ cho click này; nhưng AT vẫn track qua aff_link → revenue vẫn về. Chấp nhận cho v1.

Nếu sau này muốn track nội bộ → tạo route `/r/top/<atProductId>` redirect + log ClickLog (cần `ClickLog.productId` nullable hoặc tạo Product placeholder — phase sau).

### AC7 — Env

```
# ----- Top Products -----
TOP_PRODUCTS_ENABLED=true
TOP_PRODUCTS_CRON="0 3 * * *"
```

### AC8 — Unit test `TopProductsSyncService`

File mới: `apps/api/src/modules/crawler/top-products-sync.service.spec.ts`

Theo chuẩn `mt-dev` section 2.2. Cover:

- **Date format `DD-MM-YYYY`:** `toAtDayFormat(new Date("2026-05-16"))` → `"16-05-2026"`. Regression cho gotcha #9 — **không** được rơi vào ISO format.
- **Snapshot idempotent:** mock AT trả 50 product, chạy lần 1 → 50 row mới với `snapshotDate=today`; chạy lần 2 cùng ngày → 0 row mới (hoặc upsert, depending on AC3 strategy — match implementation).
- **`discount` field là VND, không phải %:** input `discount: 250000` → DB `discount: 250000` (Decimal hoặc number), không divide /100.
- **`position` ordering:** AT trả 50 item — DB lưu `position` 1..50 đúng thứ tự AT trả về.
- **`getLatestSnapshot(limit)`:** mock DB có snapshot 2 ngày khác nhau → trả về snapshot ngày mới nhất, không trộn lẫn.
- **Image domain capture:** verify image URL được lưu nguyên (debug khi UI gặp broken image — sẽ cần update `next.config.js`).

Pattern: `describe(TopProductsSyncService) > describe(syncDailySnapshot) > it("...")`. Mock Prisma + mock `AccesstradeClient`.

### AC9 — Doc

[docs/integrations/accesstrade.md](../../../integrations/accesstrade.md): mục 3.10 đánh dấu "(đang dùng)".

## Technical breakdown

### Files mới
- Migration `top_products`.
- `apps/api/src/modules/crawler/top-products-sync.service.ts`
- `apps/api/src/modules/crawler/top-products-sync.service.spec.ts`
- `apps/api/src/modules/crawler/top-products-sync.scheduler.ts`
- `apps/api/src/modules/top-products/top-products.controller.ts`
- `apps/api/src/modules/top-products/top-products.module.ts` (nếu tách module riêng) hoặc thêm vào AppModule
- `apps/web/components/top-product-card.tsx`

### Files sửa
- `apps/api/prisma/schema.prisma` — `TopProductSnapshot`.
- `apps/api/src/modules/crawler/clients/accesstrade.client.ts` — `fetchTopProducts`.
- `apps/api/src/modules/crawler/crawler.module.ts` — register service + scheduler.
- `apps/api/src/modules/app.module.ts` — register `TopProductsController` (hoặc TopProductsModule).
- `apps/api/src/modules/admin/admin.controller.ts` — endpoint manual sync.
- `apps/api/.env.example` — env mới.
- `apps/web/app/page.tsx` — thêm section.
- Doc update.

## Definition of Done

- [ ] Migration apply clean.
- [ ] Manual sync tạo snapshot today với 50 row.
- [ ] Public `GET /api/v1/top-products` trả 12 item từ snapshot mới nhất.
- [ ] Homepage hiện section "Đang hot tuần này" với 12 card.
- [ ] Click card → mở `affLink` ở tab mới với `rel="nofollow sponsored"`.
- [ ] Cron 3am chạy tự động (verify log).
- [ ] Sync 2 lần cùng ngày → idempotent (skip lần 2 nhờ check `existing`).
- [ ] `top-products-sync.service.spec.ts` pass — cover date format `DD-MM-YYYY`, idempotent, discount VND, position ordering.
- [ ] `npm run test:api` pass.

## Out of scope

- **Tracking click qua ClickLog**: chấp nhận AT track. Internal click tracking = phase sau.
- **History view** (xem top tuần trước): snapshot per day đã lưu, nhưng chưa có UI. Có thể query Prisma trực tiếp khi cần.
- **Filter theo category/merchant ở UI**: chỉ "all" ở homepage. Có thể thêm filter ở Category page nếu nhu cầu.
- **Snapshot khoảng thời gian custom**: cron luôn pull 7 ngày qua. Custom range = admin tay (gọi service trực tiếp).
- **Remove old snapshots**: chấp nhận lưu vô hạn, ~50 row/ngày × 365 ngày = 18k row/năm. Nhỏ, không cần cleanup ngay. Phase sau có thể add retention policy.

## Notes cho AI agent

- **Date format `DD-MM-YYYY`**: gotcha #9 trong doc. **KHÔNG** dùng `.toISOString()`. Helper `toAtDayFormat` ở AC2 là pattern duy nhất đúng.
- **`discount` field ở `/top_products` là VND** (giá sau giảm), không phải %. Lưu trực tiếp, đừng compute %.
- **`rel="nofollow sponsored"`** bắt buộc cho affiliate link — Google policy (nếu thiếu có thể bị penalize SEO toàn site).
- **ISR `revalidate: 3600`**: cân bằng giữa fresh data và TTFB. 1h là OK cho top products (data daily, không cần realtime).
- **`atRawData` lưu raw**: để future analysis (vd "products nào liên tục top 1 trong 30 ngày"). Đừng skip.
- **Image domain whitelist**: Next.js Image cần thêm domain vào [next.config.js](../../../../apps/web/next.config.js) cho mọi domain merchant (vd `fado.vn`, `shopee.vn`, `lazada-vn-live-...`). Nếu không, image hiển thị broken. Thêm `images.remotePatterns` cẩn thận.
- **Don't bloat homepage**: chỉ 12 items, không 50. Card grid 2-3-4 columns responsive.
