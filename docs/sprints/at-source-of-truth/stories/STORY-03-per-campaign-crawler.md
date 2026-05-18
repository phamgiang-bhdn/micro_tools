# STORY-03 — Crawler per-campaign loop + filter rules

**Sprint:** [at-source-of-truth](../sprint.md)
**Estimate:** 5h
**Dependencies:** [STORY-01](STORY-01-schema-migration.md) (schema), [STORY-02](STORY-02-campaign-sync.md) (cần Campaign có `atCampaignId`).

## Context

Crawler hiện tại pull `/v1/datafeeds` global (không filter campaign), rồi `import.service.ts` cố infer category từ free-text bằng [category-inference.util.ts](../../../../apps/api/src/modules/crawler/category-inference.util.ts) — mapping lệch hoàn toàn với seed v1 nên skip 100% offer.

Sau STORY-02, mỗi Campaign approved có `atCampaignId` thật. Story này refactor crawler để:
1. **Loop per-campaign** (chỉ campaign đã assign category + có filterRules), gọi `/v1/datafeeds?campaign=<atCampaignId>` per campaign.
2. **Filter rules per-campaign** (từ `Campaign.filterRules` JSON), không phải env global.
3. **Category = Campaign.categoryId** (deterministic, không phải infer từ free-text).

Sau story này, `inferCategorySlug` không còn cần (STORY-08 sẽ xoá).

**Reference doc**: [accesstrade.md mục 3.1](../../../integrations/accesstrade.md#31-get-v1datafeeds--sản-phẩm-đang-dùng) — datafeed có 14+ query params hỗ trợ filter server-side.

## User story

> **As** system admin,
> **I want** crawler chỉ pull data từ những campaign đã được approve + assign vào Category, với filter rules cụ thể per campaign,
> **so that** Product DB không lẫn rác từ ngoài niche và mỗi merchant có policy filter riêng.

## Acceptance criteria

### AC1 — Mở rộng `fetchProducts` để hỗ trợ filter

File: [apps/api/src/modules/crawler/clients/accesstrade.client.ts](../../../../apps/api/src/modules/crawler/clients/accesstrade.client.ts)

Đổi signature:

```ts
async fetchProducts(opts: {
  page?: number;
  limit?: number;
  campaign?: string;              // atCampaignId hoặc merchant slug từ AT (vd "lazadaapp", "shopeenew")
  domain?: string;                // "shopee.vn", "lazada.vn"
  priceFrom?: number;
  priceTo?: number;
  discountRateFrom?: number;      // %
  discountRateTo?: number;
  statusDiscount?: 0 | 1;
  updateFrom?: string;            // "DD-MM-YYYY"
  updateTo?: string;
} = {}): Promise<NormalizedOffer[]>
```

Build URL:
```ts
const params = new URLSearchParams();
params.set("page", String(opts.page ?? 1));
params.set("limit", String(opts.limit ?? 50));
if (opts.campaign) params.set("campaign", opts.campaign);
if (opts.domain) params.set("domain", opts.domain);
if (opts.priceFrom !== undefined) params.set("price_from", String(opts.priceFrom));
if (opts.priceTo !== undefined) params.set("price_to", String(opts.priceTo));
if (opts.discountRateFrom !== undefined) params.set("discount_rate_from", String(opts.discountRateFrom));
if (opts.discountRateTo !== undefined) params.set("discount_rate_to", String(opts.discountRateTo));
if (opts.statusDiscount !== undefined) params.set("status_discount", String(opts.statusDiscount));
if (opts.updateFrom) params.set("update_from", opts.updateFrom);
if (opts.updateTo) params.set("update_to", opts.updateTo);
const url = `${base}/datafeeds?${params.toString()}`;
```

### AC2 — Fix semantic field `discount` trong `toNormalized`

Theo doc, `discount` raw = giá sau giảm (VND), không phải %. `discount_rate` mới là %.

Sửa [accesstrade.client.ts:71-98](../../../../apps/api/src/modules/crawler/clients/accesstrade.client.ts#L71-L98):

```ts
private toNormalized(p: AccesstradeProduct): NormalizedOffer {
  const sale = p.sale_price ?? p.discount ?? p.price;       // discount = giá sau giảm
  const original = p.price && sale && p.price > sale ? p.price : undefined;

  let discountPercent: number | undefined;
  if (typeof p.discount_rate === "number" && p.discount_rate > 0 && p.discount_rate <= 100) {
    discountPercent = Math.round(p.discount_rate);          // ưu tiên field chính thức
  } else if (sale && original && original > sale) {
    discountPercent = Math.round(((original - sale) / original) * 100);
  }

  return {
    source: "accesstrade",
    externalId: p.id,
    name: p.name,
    affiliateUrl: p.aff_link ?? p.url ?? "",
    image: p.image,
    price: sale,
    originalPrice: original,
    currency: "VND",
    description: p.desc,
    category: p.category,
    brand: p.brand,
    store: p.merchant,
    discountPercent,
    campaign: p.campaign,                  // tên campaign (string, không phải id)
    merchantName: p.merchant,
    categorySlug: undefined,               // KHÔNG infer ở client nữa — caller set từ Campaign.categoryId
    // Thêm fields mới
    sku: p.sku,
    sourceProductId: p.product_id,
    atCategorySlug: p.cate,                // slug danh mục AT (vd "thoi-trang-my-pham")
    discountAmount: p.discount_amount,
  };
}
```

Update interface `AccesstradeProduct` thêm: `discount_rate?: number`, `sku?: string`, `product_id?: string`, `cate?: string`, `discount_amount?: number`, `status_discount?: 0 | 1`, `update_time?: string`, `promotion?: string | null`.

Update `NormalizedOffer` interface ([dto/normalized-offer.dto.ts](../../../../apps/api/src/modules/crawler/dto/normalized-offer.dto.ts)) thêm `sku?`, `sourceProductId?`, `atCategorySlug?`, `discountAmount?` (optional, không break code khác).

### AC3 — Refactor `CrawlerService.runFullCycle` thành per-campaign loop

File: [apps/api/src/modules/crawler/crawler.service.ts](../../../../apps/api/src/modules/crawler/crawler.service.ts)

Logic mới:

```ts
async runFullCycle(triggeredBy = "cron"): Promise<CycleResult> {
  this.logger.log("Crawler cycle started (per-campaign mode)");
  const log = await this.prisma.crawlerLog.create({ data: { triggeredBy } });
  const start = Date.now();

  try {
    // Chỉ pull campaign approved + có categoryId (admin đã assign)
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: "APPROVED",
        categoryId: { not: null },
        atCampaignId: { not: null }    // skip legacy campaign chưa backfill
      },
      select: {
        id: true,
        atCampaignId: true,
        merchantName: true,
        categoryId: true,
        filterRules: true,
        name: true
      }
    });

    const results = await Promise.all(
      campaigns.map(async (campaign) => {
        try {
          const rules = filterRulesSchema.safeParse(campaign.filterRules ?? {});
          const validRules = rules.success ? rules.data : DEFAULT_FILTER_RULES;

          const offers = await this.accesstrade.fetchProducts({
            campaign: campaign.atCampaignId!,
            limit: 100,
            discountRateFrom: validRules.minDiscountPercent,
            discountRateTo: validRules.maxDiscountPercent,
            priceFrom: validRules.priceMin,
            priceTo: validRules.priceMax,
            statusDiscount: validRules.status_discount
          });

          // Apply client-side filter cho thứ AT không hỗ trợ (vd domains whitelist)
          const filtered = offers.filter((o) => {
            if (validRules.domains && validRules.domains.length > 0) {
              try {
                const host = new URL(o.affiliateUrl).hostname;
                if (!validRules.domains.some((d) => host.includes(d))) return false;
              } catch { return false; }
            }
            return true;
          });

          // Gán categorySlug từ Campaign.categoryId (deterministic)
          const category = await this.prisma.category.findUnique({
            where: { id: campaign.categoryId! },
            select: { slug: true }
          });
          if (!category) {
            this.logger.warn(`Campaign ${campaign.id} has categoryId but Category not found`);
            return { fetched: offers.length, passed: 0, offers: [] };
          }
          const offersWithCategory = filtered.map((o) => ({
            ...o,
            categorySlug: category.slug,
            campaignDbId: campaign.id       // truyền sẵn để import.service không lookup lại
          }));

          this.logger.log(`Campaign ${campaign.name} (${campaign.atCampaignId}): fetched ${offers.length}, filtered ${filtered.length}`);
          return { fetched: offers.length, passed: filtered.length, offers: offersWithCategory };
        } catch (error) {
          this.logger.error(`Campaign ${campaign.atCampaignId} failed`, error instanceof Error ? error.message : String(error));
          return { fetched: 0, passed: 0, offers: [] };
        }
      })
    );

    const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);
    const allOffers = results.flatMap((r) => r.offers);
    const totalPassed = allOffers.length;

    const enriched: NormalizedOffer[] = [];
    for (const offer of allOffers) {
      enriched.push(await this.enrichment.enrich(offer));
    }

    const result = await this.importer.upsertOffers(enriched);
    this.logger.log(`Import: +${result.created} created, ~${result.updated} updated, /${result.skipped} skipped`);

    await this.prisma.crawlerLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        fetched: totalFetched,
        passedFilter: totalPassed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        success: true,
        durationMs: Date.now() - start
      }
    });

    return { fetched: totalFetched, passedFilter: totalPassed, ...result };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    await this.prisma.crawlerLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        success: false,
        errorReason: reason.slice(0, 1000),
        durationMs: Date.now() - start
      }
    });
    throw error;
  }
}
```

**Lưu ý**:
- KHÔNG còn dùng `CRAWLER_MIN_DISCOUNT_PERCENT` env global (STORY-08 sẽ xoá).
- KHÔNG còn dùng `inferCategorySlug` — category lấy từ `Campaign.categoryId`.
- Đa số constructor (`shopee`, `tiktok`, `lazada`) vẫn giữ — sprint này không touch (chỉ Accesstrade đang active).

### AC4 — Update `ImportService.upsertOffers` để dùng `campaignDbId`

File: [apps/api/src/modules/crawler/import.service.ts](../../../../apps/api/src/modules/crawler/import.service.ts)

Đổi `NormalizedOffer` type thêm optional `campaignDbId?: string` (đã chuẩn bị ở AC3).

Trong `upsertOffers`:
- Nếu offer có `campaignDbId` → dùng trực tiếp, KHÔNG gọi `resolveCampaignId` (lookup theo slug cũ).
- Nếu offer KHÔNG có `campaignDbId` (legacy path từ web-scrape hoặc test) → fallback cách cũ.

```ts
const campaignId = offer.campaignDbId ?? await this.resolveCampaignId(network, offer);
```

Method `resolveCampaignId` giữ nguyên cho backward compat — vẫn upsert theo `slugify(offer.campaign)`. Note thêm comment "@deprecated — chỉ dùng cho path không có campaignDbId (web-scrape manual). Path chính từ crawler-cycle đã set campaignDbId."

### AC5 — Cập nhật cron schedule

File: [apps/api/src/modules/crawler/crawler.scheduler.ts](../../../../apps/api/src/modules/crawler/crawler.scheduler.ts)

Không cần đổi logic — vẫn gọi `runFullCycle()`. Nhưng cập nhật comment ghi rõ giờ là per-campaign mode.

### AC6 — Endpoint manual trigger 1 campaign (debug)

Thêm vào [crawler.controller.ts](../../../../apps/api/src/modules/crawler/crawler.controller.ts):

```ts
@Post("run-campaign/:atCampaignId")
async runSingleCampaign(
  @Param("atCampaignId") atCampaignId: string,
  @Headers("x-admin-key") apiKey?: string
) {
  authorize(apiKey);
  // Tạm thời: gọi runFullCycle với filter tay
  // (hoặc tách method runForCampaign(atCampaignId) trong CrawlerService nếu muốn clean)
  // Story này chấp nhận runFullCycle full — tối ưu sau.
  return this.crawler.runFullCycle("manual-single");
}
```

Hữu ích khi admin onboard campaign mới + muốn test ngay không đợi cron 6h.

**Lưu ý**: thực tế nên implement `runForCampaign(atCampaignId)` riêng để chỉ pull 1 campaign, nhưng story này estimate 5h nên chấp nhận full run. Nếu thừa thời gian thì tách.

### AC7 — Cập nhật unit test

File: `apps/api/src/modules/crawler/crawler.service.spec.ts` (tạo nếu chưa có).

Theo chuẩn `mt-dev` section 2.2. Cover:

- `runFullCycle()` mock Prisma trả 2 campaign (1 có `categoryId` + `atCampaignId`, 1 thiếu `categoryId`) → chỉ campaign 1 được gọi `fetchProducts`.
- `filterRules` invalid (zod parse fail) → fallback `DEFAULT_FILTER_RULES` + log warning.
- `discount_rate` (không phải `discount`) được map vào `discountPercent` (regression cho gotcha #10).
- `inferCategorySlug` KHÔNG được invoke trong path crawler-cycle (spy assert not called).

Pattern: `describe(CrawlerService) > describe(runFullCycle) > it("...")`.

### AC8 — Cập nhật doc

Cập nhật [docs/integrations/accesstrade.md](../../../integrations/accesstrade.md):
- Mục 3.1: ghi rõ code giờ truyền filter server-side (`campaign`, `domain`, `discount_rate_from`...).
- Mục 6 gotcha #10 (`discount` ambiguous): đánh dấu "đã fix ở STORY-03".

Cập nhật [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md) section Crawler:
- "Free-text → categorySlug mapping" — note giờ chỉ là fallback, path chính từ `Campaign.categoryId`.
- Thêm dòng về `Campaign.filterRules`.

## Technical breakdown

### Files mới
Không.

### Files mới
- `apps/api/src/modules/crawler/crawler.service.spec.ts` — unit test cho `runFullCycle`.

### Files sửa
- `apps/api/src/modules/crawler/clients/accesstrade.client.ts` — extend `fetchProducts` signature + fix `toNormalized`.
- `apps/api/src/modules/crawler/dto/normalized-offer.dto.ts` — thêm field optional.
- `apps/api/src/modules/crawler/crawler.service.ts` — refactor `runFullCycle`.
- `apps/api/src/modules/crawler/import.service.ts` — accept `campaignDbId` shortcut.
- `apps/api/src/modules/crawler/crawler.controller.ts` — thêm endpoint run-campaign.
- `apps/api/src/modules/crawler/crawler.scheduler.ts` — update comment.
- `docs/integrations/accesstrade.md` — update.
- `apps/api/CLAUDE.md` — update.

### Schema
Không cần migration.

### Env
- KHÔNG xoá `CRAWLER_MIN_DISCOUNT_PERCENT` ở story này (STORY-08 sẽ xoá). Nhưng KHÔNG đọc nó nữa trong `runFullCycle`.
- KHÔNG xoá `CRAWLER_ENABLED_NETWORKS` — giữ multi-network skeleton.

## Definition of Done

- [ ] Campaign có `categoryId` + `atCampaignId` được pull data; campaign không có thì skip.
- [ ] Filter rules JSON được parse qua zod; rules invalid → fallback DEFAULT_FILTER_RULES, log warning.
- [ ] `accesstrade.client.ts` truyền đúng query params đến `/v1/datafeeds`.
- [ ] `discount_rate` được dùng cho `discountPercent`, không phải `discount` (fix gotcha #10 trong doc).
- [ ] `inferCategorySlug` KHÔNG được gọi trong path crawler-cycle nữa (vẫn còn file, STORY-08 xoá).
- [ ] Manual test: chạy `POST /api/v1/admin/crawler/run` → log cho thấy "Campaign X: fetched N" per campaign.
- [ ] Tạo 1 campaign giả trong DB với `categoryId` invalid → log warning, không crash.
- [ ] `crawler.service.spec.ts` pass — cover per-campaign loop skip, filterRules fallback, `discount_rate` map đúng, `inferCategorySlug` không bị gọi.
- [ ] `npm run test:api` pass.

## Out of scope

- **Pagination per-campaign**: chỉ pull 100 offers/campaign mỗi cycle. Đủ cho v1. Nếu campaign có 1000+ offers, cron tiếp theo sẽ cover (idempotent upsert).
- **`runForCampaign(atCampaignId)` riêng**: nice-to-have, không bắt buộc nếu thời gian eo hẹp.
- **Domains filter server-side**: AT không hỗ trợ trực tiếp filter `domain` (chỉ filter `campaign`); domains filter làm client-side. Có thể optimize bằng grouping campaign by domain nếu sau này nhiều campaign.
- **Multi-network mở rộng**: Shopee/Lazada/TikTok client stubs vẫn giữ, không touch. CRAWLER_ENABLED_NETWORKS env vẫn dùng.

## Notes cho AI agent

- **Đừng xoá `inferCategorySlug` ở story này**. STORY-08 sẽ xử lý cleanup. Chỉ đảm bảo crawler-cycle path không gọi nó.
- **`Prisma.JsonValue` vs `Json`**: khi đọc `Campaign.filterRules`, type là `Prisma.JsonValue` (có thể null). Phải zod parse trước khi dùng.
- **`URLSearchParams`** ở `fetchProducts` mới: nhớ skip param nếu undefined/null, không set chuỗi "undefined".
- **Test cẩn thận với data thật**: nếu có token AT thật ở dev, chạy 1 cycle thật để verify campaign params được respect server-side. Doc nói AT hỗ trợ filter này nhưng chưa ai test trên code này.
- **Backward compat path**: web-scrape (paste URL tay) ở [crawler.controller.ts](../../../../apps/api/src/modules/crawler/crawler.controller.ts) gọi trực tiếp `webScrape.fetchByUrl + importer.upsertOffers([enriched])` — path này KHÔNG có campaignDbId. `resolveCampaignId` fallback giữ cho path này.
- **Đừng break `web-scrape.client.ts`**: nó cũng dùng `inferCategorySlug` qua offer.categorySlug. Story này chỉ chỉnh path crawler-cycle, không touch web-scrape path.
