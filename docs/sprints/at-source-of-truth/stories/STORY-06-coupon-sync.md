# STORY-06 — Coupon sync (`/v1/offers_informations/coupon` → Coupon)

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 5h
**Dependencies:** [STORY-01](STORY-01-schema-migration.md). Có thể chạy parallel với STORY-02/03/04/05.

## Context

Model `Coupon` đã có sẵn ([schema.prisma:91](../../../../apps/api/prisma/schema.prisma#L91), migration `20260515130000_add_coupons_crawlerlogs_category_seo`) nhưng chưa có client populate — table rỗng.

AT cung cấp 4 endpoint cho coupon ([doc mục 3.9](../../../integrations/accesstrade.md#39-get-v1offers_informations--voucherscoupons-chưa-dùng)):
- `/merchant_list` — list merchant có coupon.
- `/keyword_list` — list từ khoá hot.
- `/coupon?icon_text=<id>` — list coupon theo keyword.
- `/list_category_coupons` — phân nhóm theo ngành.

Story này pull coupon → Coupon DB → admin duyệt → public `/khuyen-mai/<merchant>`.

**Giá trị**: SEO long-tail ("mã giảm giá shopee tháng 12", "voucher tiki hôm nay"), volume search lớn, competition vừa.

## User story

> **As** content/SEO admin DealVault,
> **I want** hệ thống tự pull coupon từ AT, lưu vào DB, để tôi duyệt và publish trang khuyến mại theo merchant,
> **so that** site có nguồn SEO long-tail bổ sung cho product page chính.

## Acceptance criteria

### AC1 — Extend schema `Coupon`

Migration: `apps/api/prisma/migrations/<timestamp>_coupon_extension/migration.sql`

```prisma
model Coupon {
  // ... existing ...
  atCouponId        String?       @unique   // id từ /v1/offers_informations/coupon
  merchantSlug      String?                  // login_name từ /merchant_list, vd "shopee", "tikivn"
  merchantDisplay   String?                  // display_name (Shopee, tiki vn)
  merchantLogo      String?
  iconText          String?                  // tên từ khoá (ShopeePay, VISA, ...)
  iconTextId        String?                  // id từ keyword_list (vd "shopee-181427514064896")
  campaignId        String?       @db.Uuid   // link về Campaign nếu merchantSlug match
  contentHtml       String?       @db.Text   // content HTML từ AT (mô tả khuyến mại)
  imageUrl          String?
  bannersJson       Json?         @db.JsonB  // banners[] từ AT
  domain            String?
  prodLink          String?                  // affiliate link sản phẩm gốc
  coinCap           Decimal?      @db.Decimal(15, 2)
  coinPercentage    Decimal?      @db.Decimal(5, 2)
  percentageUsed    Decimal?      @db.Decimal(5, 2)
  atRawData         Json?         @db.JsonB
  atLastSyncedAt    DateTime?
  campaign          Campaign?     @relation(fields: [campaignId], references: [id], onDelete: SetNull)

  @@index([merchantSlug, isActive])
  @@index([atLastSyncedAt])
}
```

Cũng phải thêm relation ngược vào `Campaign`:

```prisma
model Campaign {
  // ... existing ...
  coupons         Coupon[]
}
```

Chạy `npm run prisma:migrate --workspace api -- --name coupon_extension`.

### AC2 — `AccesstradeClient` thêm 3 method

File: [apps/api/src/modules/crawler/clients/accesstrade.client.ts](../../../../apps/api/src/modules/crawler/clients/accesstrade.client.ts)

```ts
interface AtMerchant {
  id: string;
  display_name: string;
  login_name: string;
  logo: string;
  total_offer: number;
}

interface AtKeyword {
  id: string;                     // "shopee-181427514064896"
  icon_text: string;
  total_offer: number;
}

interface AtCoupon {
  id: string;
  name: string;
  content: string;                // HTML
  image: string;
  link: string;
  prod_link?: string;
  merchant: string;
  domain: string;
  categories: unknown;
  start_time: string | null;
  end_time: string | null;
  banners: Array<{ link: string; width: number; height: number }>;
  coupons: unknown[];             // mã giảm cụ thể (array khó type — lưu raw)
  coin_cap?: number;
  coin_percentage?: number;
  percentage_used?: number;
  discount_value?: number;
  discount_percentage?: number;
}

async fetchMerchantsWithCoupons(): Promise<AtMerchant[]>;
async fetchCouponsByKeyword(iconTextId: string, limit?: number): Promise<AtCoupon[]>;
async fetchKeywordsByMerchant(merchantId: string): Promise<AtKeyword[]>;
```

3 method cùng pattern fetch + try/catch + return `[]`. Build URL cụ thể tham khảo [doc mục 3.9](../../../integrations/accesstrade.md#39-get-v1offers_informations--voucherscoupons-chưa-dùng).

### AC3 — Service mới `CouponSyncService`

File mới: `apps/api/src/modules/crawler/coupon-sync.service.ts`

```ts
@Injectable()
export class CouponSyncService {
  private readonly logger = new Logger(CouponSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesstrade: AccesstradeClient
  ) {}

  /**
   * Pull coupon từ AT cho các merchant đã có campaign approved trong DB.
   * Strategy:
   *  1. Lấy list merchant từ /merchant_list (AT)
   *  2. Cross-reference với Campaign trong DB (chỉ merchant đã approved)
   *  3. Per merchant đã match: pull keywords → mỗi keyword pull coupons (giới hạn 20/keyword)
   *  4. Upsert Coupon (dedup theo atCouponId)
   *  5. Mới sync về → isActive=false, chờ admin duyệt
   */
  async syncFromAccesstrade(): Promise<{ fetched: number; created: number; updated: number; skipped: number }> {
    const atMerchants = await this.accesstrade.fetchMerchantsWithCoupons();
    if (atMerchants.length === 0) return { fetched: 0, created: 0, updated: 0, skipped: 0 };

    // Lọc merchant có Campaign approved trong DB
    const ourCampaigns = await this.prisma.campaign.findMany({
      where: { status: "APPROVED", merchantName: { not: null } },
      select: { id: true, merchantName: true }
    });
    const merchantToCampaign = new Map(
      ourCampaigns.map((c) => [c.merchantName!.toLowerCase(), c.id])
    );

    const relevantMerchants = atMerchants.filter((m) =>
      merchantToCampaign.has(m.login_name.toLowerCase())
    );
    this.logger.log(`Coupon sync: ${atMerchants.length} AT merchants, ${relevantMerchants.length} match our campaigns`);

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const merchant of relevantMerchants) {
      const campaignId = merchantToCampaign.get(merchant.login_name.toLowerCase())!;
      const keywords = await this.accesstrade.fetchKeywordsByMerchant(merchant.id);
      await this.sleep(7000);                  // rate limit safe

      for (const kw of keywords.slice(0, 5)) {  // tối đa 5 keyword/merchant
        const coupons = await this.accesstrade.fetchCouponsByKeyword(kw.id, 20);
        await this.sleep(7000);
        fetched += coupons.length;

        for (const c of coupons) {
          if (!c.id) { skipped += 1; continue; }
          const existing = await this.prisma.coupon.findUnique({ where: { atCouponId: c.id } });
          const baseData = {
            atCouponId: c.id,
            code: c.id,                                       // không có code rõ, dùng id
            description: c.name,
            merchantSlug: merchant.login_name,
            merchantDisplay: merchant.display_name,
            merchantLogo: merchant.logo,
            iconText: kw.icon_text,
            iconTextId: kw.id,
            campaignId,
            contentHtml: c.content,
            imageUrl: c.image,
            bannersJson: c.banners as unknown as Prisma.InputJsonValue,
            domain: c.domain,
            prodLink: c.prod_link,
            affiliateUrl: c.link,
            startsAt: c.start_time ? new Date(c.start_time) : null,
            expiresAt: c.end_time ? new Date(c.end_time) : null,
            discountPercent: c.discount_percentage ? Math.round(c.discount_percentage) : null,
            discountAmount: c.discount_value ? new Prisma.Decimal(c.discount_value) : null,
            coinCap: c.coin_cap ? new Prisma.Decimal(c.coin_cap) : null,
            coinPercentage: c.coin_percentage ? new Prisma.Decimal(c.coin_percentage) : null,
            percentageUsed: c.percentage_used ? new Prisma.Decimal(c.percentage_used) : null,
            atRawData: c as unknown as Prisma.InputJsonValue,
            atLastSyncedAt: new Date(),
            network: "ACCESSTRADE" as const
          };

          if (existing) {
            await this.prisma.coupon.update({
              where: { id: existing.id },
              data: baseData
            });
            updated += 1;
          } else {
            await this.prisma.coupon.create({
              data: {
                ...baseData,
                isActive: false                  // HITL: admin duyệt mới active
              }
            });
            created += 1;
          }
        }
      }
    }

    return { fetched, created, updated, skipped };
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
```

### AC4 — Scheduler

File mới: `apps/api/src/modules/crawler/coupon-sync.scheduler.ts`

```ts
@Injectable()
export class CouponSyncScheduler {
  private readonly logger = new Logger(CouponSyncScheduler.name);

  constructor(private readonly couponSync: CouponSyncService) {}

  // Mỗi 6h
  @Cron(process.env.COUPON_SYNC_CRON ?? "0 */6 * * *", { name: "coupon-sync-cycle" })
  async handleCron() {
    if (process.env.COUPON_SYNC_ENABLED === "false") return;
    try {
      await this.couponSync.syncFromAccesstrade();
    } catch (error) {
      this.logger.error("Coupon sync failed", error instanceof Error ? error.stack : String(error));
    }
  }
}
```

Register vào `CrawlerModule` providers.

### AC5 — Admin endpoint manual trigger + list

```ts
@Post("coupons/sync-from-at")
async syncCouponsFromAt(...) { authorize ["admin"]; return this.couponSync.syncFromAccesstrade(); }

@Get("coupons")
async listCoupons(
  @Query("isActive") isActive?: string,
  @Query("merchantSlug") merchantSlug?: string,
  @Query("limit") limit?: string,
  @Headers(...) ...
) {
  this.authorize(role, apiKey, ["viewer", "reviewer", "admin"]);
  return this.prisma.coupon.findMany({
    where: {
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      ...(merchantSlug ? { merchantSlug } : {})
    },
    take: Math.min(Number(limit ?? 50), 200),
    orderBy: { atLastSyncedAt: "desc" }
  });
}

@Post("coupons/:id/approve")
async approveCoupon(@Param("id") id: string, ...) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);
  return this.prisma.coupon.update({ where: { id }, data: { isActive: true } });
}

@Post("coupons/:id/archive")
async archiveCoupon(@Param("id") id: string, ...) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);
  return this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
}
```

### AC6 — UI: `/admin/coupons`

File mới: `apps/web/app/admin/coupons/page.tsx` (nếu chưa có) + `coupons-table.tsx`.

Convention `ListPageShell + RowActions`:
- Filter status: All | Pending | Active.
- Filter merchant.
- Table: logo merchant, iconText badge, name (truncate), discount, expiresAt (relative), isActive badge.
- RowActions: Approve / Archive / View (mở dialog hiển thị `contentHtml`).
- Button "Sync from Accesstrade" ở header.

### AC7 — Public route `/khuyen-mai/<merchantSlug>`

File mới: `apps/web/app/khuyen-mai/[merchantSlug]/page.tsx`

```tsx
export default async function MerchantCouponsPage({ params }: { params: Promise<{ merchantSlug: string }> }) {
  const { merchantSlug } = await params;
  const coupons = await fetch(`${process.env.API_BASE}/coupons?merchantSlug=${merchantSlug}`).then(r => r.json());
  // Filter chỉ active + chưa expired
  const active = coupons.filter((c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt) > new Date()));
  return (
    <main>
      <h1>Mã giảm giá {merchantSlug}</h1>
      {active.map((c) => (
        <CouponCard key={c.id} coupon={c} />
      ))}
    </main>
  );
}

export async function generateMetadata({ params }) {
  const { merchantSlug } = await params;
  return {
    title: `Mã giảm giá ${merchantSlug} tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
    description: `Tổng hợp mã giảm giá ${merchantSlug} mới nhất, cập nhật hàng ngày.`
  };
}
```

Public endpoint cho coupon: thêm vào `CouponsController` (mới) — public, không cần admin auth.

File mới: `apps/api/src/modules/coupons/coupons.controller.ts`

```ts
@Controller("coupons")
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query("merchantSlug") merchantSlug?: string, @Query("limit") limit?: string) {
    return this.prisma.coupon.findMany({
      where: {
        isActive: true,
        ...(merchantSlug ? { merchantSlug } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      orderBy: { startsAt: "desc" },
      take: Math.min(Number(limit ?? 50), 100)
    });
  }
}
```

Register vào [app.module.ts](../../../../apps/api/src/modules/app.module.ts).

### AC8 — Env

`apps/api/.env.example`:
```
# ----- Coupon Sync -----
COUPON_SYNC_ENABLED=true
COUPON_SYNC_CRON="0 */6 * * *"
```

### AC9 — Sanitize `contentHtml` (bắt buộc, security gate)

Cả admin (view dialog) và public route đều render `contentHtml` từ AT — đây là HTML **untrusted**, có thể chứa `<script>`, `<iframe>`, inline handlers. **CẤM** `dangerouslySetInnerHTML` raw.

**Pattern chốt**: sanitize ở **server-side trước khi trả về**, không sanitize ở client.

File mới: `apps/api/src/common/sanitize-html.util.ts`

```ts
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "ul", "ol", "li",
  "a", "h2", "h3", "h4", "span", "div", "img", "table",
  "thead", "tbody", "tr", "td", "th"
];

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "width", "height"],
  span: ["class"],
  div: ["class"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"]
};

export function sanitizeCouponHtml(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" })
    },
    disallowedTagsMode: "discard"
  });
}
```

Thêm dependency `sanitize-html` + `@types/sanitize-html` vào `apps/api/package.json`.

**Áp dụng:**
- `CouponSyncService.syncFromAccesstrade()`: gọi `sanitizeCouponHtml(c.content)` trước khi save vào `Coupon.contentHtml`. **Lưu sanitized version**, không lưu raw. Raw vẫn còn trong `atRawData.content` để debug.
- Public endpoint `CouponsController.list()`: `contentHtml` trả ra đã sanitized rồi (từ DB).
- Admin endpoint `listCoupons`: tương tự, trả từ DB.

**Render side (web):**
- `apps/web/components/coupon-card.tsx`: dùng `dangerouslySetInnerHTML={{ __html: coupon.contentHtml }}` — **CHỈ** vì backend đã sanitize. Comment rõ trên dòng: `// Pre-sanitized by api sanitize-coupon-html util`.
- Admin view dialog: tương tự.

**Test:** với input `<p>OK</p><script>alert(1)</script>` → output `<p>OK</p>` (script bị strip).

### AC10 — Unit test `CouponSyncService`

File mới: `apps/api/src/modules/crawler/coupon-sync.service.spec.ts`

Theo chuẩn `mt-dev` section 2.2. Cover:

- **Merchant cross-reference:** AT trả 5 merchant, DB có 2 Campaign approved match → chỉ 2 merchant được pull keywords.
- **HITL gate:** coupon mới sync → `isActive=false` (regression — quan trọng nhất).
- **Idempotent:** chạy lần 2 với cùng data → `updated`, không `created` duplicate, `atCouponId` unique.
- **Sanitize hook:** mock `sanitizeCouponHtml`, verify được gọi trên `c.content` trước khi pass vào Prisma `contentHtml`. Hoặc test end-to-end: input có `<script>` → DB lưu không chứa `<script>`.
- **Rate limit:** spy `setTimeout` 7000ms giữa keyword fetches.
- **Skip merchant không match:** AT có merchant `"foo"` không có trong DB Campaign → log "No merchant matched" và không gọi `fetchKeywordsByMerchant`.

File mới: `apps/api/src/common/sanitize-html.util.spec.ts`

- `<script>` → strip.
- `<iframe>` → strip.
- `<a href="javascript:...">` → strip href (schemes).
- `<a href="https://...">` → kept với `rel="nofollow noopener" target="_blank"`.
- `<p>OK</p>` → kept.
- `null`/`undefined`/empty string → empty string.

### AC11 — Doc

[docs/integrations/accesstrade.md](../../../integrations/accesstrade.md):
- Mục 3.9: đánh dấu "(đang dùng)".

[apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md): section "Coupons" mới.

## Technical breakdown

### Files mới
- `apps/api/prisma/migrations/<timestamp>_coupon_extension/migration.sql`
- `apps/api/src/modules/crawler/coupon-sync.service.ts`
- `apps/api/src/modules/crawler/coupon-sync.service.spec.ts`
- `apps/api/src/modules/crawler/coupon-sync.scheduler.ts`
- `apps/api/src/modules/coupons/coupons.controller.ts`
- `apps/api/src/common/sanitize-html.util.ts`
- `apps/api/src/common/sanitize-html.util.spec.ts`
- `apps/web/app/admin/coupons/page.tsx` (kiểm tra đã có chưa — schema migration tên có nhắc; nếu đã có thì sửa)
- `apps/web/app/admin/coupons/coupons-table.tsx` (kiểm tra)
- `apps/web/app/khuyen-mai/[merchantSlug]/page.tsx`
- `apps/web/components/coupon-card.tsx`

### Files sửa
- `apps/api/prisma/schema.prisma` — extend Coupon + relation.
- `apps/api/src/modules/crawler/clients/accesstrade.client.ts` — 3 method mới.
- `apps/api/src/modules/crawler/crawler.module.ts` — register CouponSyncService + Scheduler.
- `apps/api/src/modules/admin/admin.controller.ts` — endpoints coupon admin.
- `apps/api/src/modules/app.module.ts` — register CouponsController.
- `apps/api/.env.example` — env mới.
- Doc updates.

## Definition of Done

- [ ] Migration apply clean.
- [ ] Manual sync (`POST /admin/coupons/sync-from-at`) chạy không lỗi, log thấy merchant matched.
- [ ] Mới sync về → Coupon.isActive = false (HITL).
- [ ] Admin approve coupon → isActive = true, hiện trên `/khuyen-mai/<merchant>`.
- [ ] Coupon expired không hiện ở public route.
- [ ] Coupon không link với Campaign đã approved → skip (không pull).
- [ ] Cron 6h chạy tự động (verify via log).
- [ ] `contentHtml` sau sync KHÔNG chứa `<script>`, `<iframe>`, `javascript:` href (verify trong DB sau khi chạy sync với input giả chứa các tag này).
- [ ] `coupon-sync.service.spec.ts` + `sanitize-html.util.spec.ts` pass.
- [ ] `npm run test:api` pass.

## Out of scope

- **Voucher code chính xác**: AT trả `coupons: []` array trong response nhưng shape không rõ trong doc. Story này lưu raw vào `atRawData.coupons`, không parse. Admin xem trong dialog read-only. Parse khi có spec rõ hơn.
- **Coupon `prod_link` ingest thành Product**: không tự động. Coupon và Product là 2 entity tách biệt.
- **Coupon listing widget cho homepage**: chỉ /khuyen-mai/<merchant> ở story này. Homepage carousel coupon = story sau.
- **Click tracking cho coupon**: thêm vào `/click` flow cùng pattern Product. Phase sau.
- **Per-keyword landing page**: chỉ per-merchant. /khuyen-mai/<merchant>/<keyword> = phase sau.

## Notes cho AI agent

- **Rate limit nặng**: 3-level pull (merchants → keywords → coupons), mỗi level có thể 7s sleep. Tổng 1 cycle có thể vài phút. Đừng bỏ sleep — sẽ bị 429 và crash giữa chừng.
- **HITL gate phải tuân thủ**: mới sync = `isActive=false`. Đừng "tự động active" để tiết kiệm step admin — đây là original sin của HITL bypass.
- **`Coupon.code` UNIQUE**: schema hiện có `code String @unique`. Dùng `atCouponId` làm code để tránh xung đột. Nếu coupon thật có mã (vd "SHOPEE10K") trong `c.coupons[]`, parse và lưu vào field riêng (phase sau).
- **Decimal precision**: `coin_cap` có thể là số lớn (1tr), dùng `Decimal(15,2)`.
- **Merchant matching case-insensitive**: AT `login_name = "shopee"`, ta lưu `Campaign.merchantName = "shopee"` (lowercase từ datafeed). So sánh `.toLowerCase()` cả 2 phía.
- **Sanitize `contentHtml`**: xem AC9 — sanitize ở **server-side** (lib `sanitize-html`) trước khi save vào DB, không sanitize ở client. Render `dangerouslySetInnerHTML` được phép **chỉ vì** DB đã sạch. Đừng đảo chiều flow này.
- **SEO h1**: title route phải có tháng/năm động (Google ranking signal cho "khuyến mại tháng X"). `generateMetadata` lấy `new Date()`.
- **Don't pull all merchant nếu DB chưa có campaign approve**: empty case → log "No merchant matched, sync skipped". Đừng pull tất cả AT merchant → lãng phí quota + lưu rác.
