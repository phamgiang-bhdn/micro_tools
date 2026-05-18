# apps/api — NestJS backend

Auto-loaded when working anywhere under `apps/api/`. Root `CLAUDE.md` covers monorepo-level commands and cross-app invariants; this file is Nest-specific.

## Bootstrap

`src/main.ts` does three things you can rely on globally:
1. `app.setGlobalPrefix("api/v1")` — every controller path is mounted under `/api/v1/*`. Don't hardcode the prefix inside controller decorators.
2. Global `ValidationPipe({ whitelist: true, transform: true })` — incoming DTOs are stripped of unknown keys and coerced. Define request shape with `class-validator` decorators on a DTO class and inject it; **don't** re-validate inside the controller body.
3. Port from `process.env.PORT ?? 4000`.

## Module wiring

`src/modules/app.module.ts` imports `ConfigModule.forRoot({ isGlobal: true })` and `CrawlerModule`, and registers five controllers directly: `WebhooksController`, `CategoriesController`, `TrackingController`, `ArticlesController`, `AdminController`. `PrismaService`, `ScraperService`, `AiService`, `ArticleService` are top-level providers.

Crawler is the only feature module (`src/modules/crawler/`) because it owns its scheduler + affiliate clients. If you add another scheduled feature, follow the same pattern (own module, own `ScheduleModule.forRoot()` import is already in `CrawlerModule`).

## Prisma

- `PrismaService` (in `src/prisma/`) extends `PrismaClient` and implements `OnModuleInit` → call `$connect()` on startup. **Always inject it**; never `new PrismaClient()` ad hoc.
- Migrations live in `prisma/migrations/`. After editing `prisma/schema.prisma`, run `npm run db:migrate -- --name <slug>` from root (creates + applies migration + regens client). For a one-off client regen without migrating, `npm run prisma:generate --workspace api`.
- Use `Prisma.InputJsonValue` when assigning to `Json` columns (`scrapedData`, `aiOutput`, `payload`, `schemaConfig`) — see `admin.controller.ts` for the pattern.

## Admin endpoints — auth & validation pattern

Every method in `AdminController` follows the same shape:

```ts
@Get|@Post("path")
async handler(
  @Body() payload: unknown,        // or @Param / @Query
  @Headers("x-admin-role") role?: string,
  @Headers("x-admin-key") apiKey?: string
) {
  this.authorize(role, apiKey, ["reviewer", "admin"]);  // or ["viewer", ...] / ["admin"]
  const parsed = someZodSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
  }
  // ...
}
```

Two things to preserve:
- **Auth gate is per-method**, not a guard. Each handler calls `this.authorize(role, apiKey, allowedRoles)`. Allowed roles are `"viewer" | "reviewer" | "admin"` — pick the minimum scope. `ADMIN_API_KEY` env (default fallback `"change-me"` is intentional for dev) is the shared secret with the Next web app.
- **Admin uses zod for body validation**, not class-validator (the rest of the app does use class-validator + the global `ValidationPipe`). Don't mix them inside one controller; follow whatever the file already uses.

When in doubt about the existing admin endpoints (Refinery, Prompt Studio, Money Trail, War Room), they all live in `src/modules/admin/admin.controller.ts`.

## AI extraction (`src/services/ai.service.ts`)

- Model: read from `GEMINI_MODEL` env, default `gemini-2.0-flash`. `responseMimeType: "application/json"`. Resolved per-call (getter, not constructor) so changing env doesn't need a code restart in dev.
- Two methods, both routed through the shared `callJsonModel` helper:
  - `parseBySchema<T>(scrapedText, schema)` — extraction (raw text → structured JSON via `Niche.schemaConfig`). Used by Refinery / crawler enrichment.
  - `generateJson<T>(fullPrompt)` — generation (full prompt → JSON). Used by `ArticleService.generateDraft()` for blog AI authoring. The caller controls the entire prompt; nothing is prepended.
- `currentModel` getter exposes the active model name (used to log into `Article.aiModel` for traceability).
- Built-in retry: 3 attempts, backoff `Math.min(60000, attempt * 15000)` (15s/30s/45s) when error matches `429|rate limit|quota`. After max attempts, throws `HttpException(429)`. Non-rate-limit errors re-throw immediately. Don't wrap your own retry on top.
- `parseBySchema` truncates `scrapedText` to 15000 chars; `generateJson` does NOT truncate — caller is responsible for prompt size.

## Articles (AI-generated blog)

Same HITL philosophy as `ProductExtraction`: AI produces a draft, an admin reviews, only then it reaches the public storefront. States on `Article.status`: `DRAFT | PUBLISHED | ARCHIVED`. `Article.type`: `BUYING_GUIDE | REVIEW`.

- **`ArticleService` (`src/services/article.service.ts`)** — picks the active `PromptTemplate` by name (`article-buying-guide` or `article-review`), interpolates `{topic}`, `{nicheName}`, `{productHints}` (auto-built from `productIds`), calls `AiService.generateJson<ArticleAiOutput>` validated by a zod schema. Returns `{ output, promptName, modelName }`; the AdminController is the one that persists into `Article` and dedupes slug via `ensureUniqueSlug(candidate, excludeId?)`.
- **`ArticlesController` (public)** — `GET /api/v1/articles?type=&nicheSlug=&limit=` (PUBLISHED only), `GET /api/v1/articles/:slug` (returns article + related `products` joined by `productIds[]`). Both unauthenticated.
- **Admin endpoints** in `AdminController`: `GET /admin/articles`, `GET /admin/articles/:id`, `POST /admin/articles/generate`, `PUT /admin/articles/:id`, `POST /admin/articles/:id/publish`, `POST /admin/articles/:id/archive`. Use zod schemas (`generateArticleSchema`, `updateArticleSchema`) for body validation.
- `Article.productIds: String[]` is a plain Postgres uuid array, **not** a relation table. Hand-managed: when products are deleted, the `Article` still references them by id — frontend must handle missing.

## Campaigns

`Campaign` model groups all `Product`s and `ConversionWebhook`s that come from one merchant on one affiliate network — e.g. `(ACCESSTRADE, "shopee-cps-vn")` is "Shopee via Accesstrade publisher account". One affiliate token can be approved for many campaigns; this model is how we track which.

- **Identity**: `@@unique([network, externalId])`. `externalId` is `slugify(offer.campaign)` for crawler-discovered campaigns (Accesstrade doesn't expose campaign IDs in datafeed, only names). When you create a campaign manually via `/admin/campaigns`, pick the same slug so the crawler will dedupe into it later. **Legacy after AT-first sprint**: `externalId` (slug) stays for backward compat; new code should join via `Campaign.atCampaignId` (global Accesstrade id) populated by the campaigns-sync flow.
- **AT-first fields** (added STORY-01): `atCampaignId` (unique, real AT id), `atCategoryName` / `atSubCategory` / `atLogo` / `atMerchantUrl` / `atScope` / `atCookieDurationSec` / `atStartTime` / `atEndTime` / `atRawData` (raw `/v1/campaigns` response, JsonB, for debug + future-proof), `atLastSyncedAt`, `filterRules` (per-campaign tuning — validate with `filterRulesSchema` from `crawler/dto/filter-rules.dto.ts`). N:N assignments via `CampaignNiche` (filterRules + priority per pair) — Niche là layer trình bày (slug, SEO), Campaign là upstream từ AT.
- **Sync flow (STORY-02)**: admin bấm "Sync from Accesstrade" ở `/admin/campaigns` → `CampaignSyncService` pull `/v1/campaigns?approval=successful`, upsert theo `atCampaignId`. New rows land as `APPLIED`; admin-managed fields (`status`, `notes`, assignments, `filterRules`) KHÔNG bị đè khi re-sync.
- **Lifecycle**: `APPLIED → APPROVED → PAUSED/REJECTED → INACTIVE`. Admin assign campaign vào Niche trong `/admin/campaigns` → status auto chuyển `APPROVED` (signal cho crawler-cycle pick up).
- **Legacy `externalId`** (`@deprecated` ở schema): slug-based id từ trước sprint. Code mới luôn join qua `atCampaignId`. Đừng tạo Campaign mới với `externalId` slug — dùng sync flow.
- **Web-scrape fallback** (`ImportService.resolveCampaignId`, `@deprecated`): chỉ chạy khi `offer.campaignDbId` null (vd paste URL tay không có context campaign). Tạo Campaign slug-based, KHÔNG có `atCampaignId` — admin phải re-sync để link.
- **Webhook link**: `WebhooksController.resolveCampaignId` looks up `(network, slugify(payload.campaign))` and sets `ConversionWebhook.campaignId` if found. Does NOT auto-create — webhooks shouldn't be the source of truth for campaign rows (race: a postback for an unknown campaign would create a row with no merchant context).
- **Don't delete campaigns with history**: `Campaign.deleteCampaign` 409s when there are linked products/conversions. Use `status: INACTIVE` to hide instead — preserves attribution trail.
- **Product.campaignId is nullable + SetNull on delete**: products created before campaign tracking (or from `web-scrape.client.ts` manual paste) have `campaignId = null`. The storefront doesn't care; this is metadata for admin reporting only.

## Crawler

- Scheduler: `CrawlerScheduler` runs `@Cron(process.env.CRAWLER_CRON ?? "0 */6 * * *")`. Disable with `CRAWLER_ENABLED=false`. Cron name `crawler-cycle`.
- Affiliate clients live in `src/modules/crawler/clients/` and all implement `AffiliateClient` (`affiliate-client.interface.ts`): `accesstrade.client.ts` (active), `shopee.client.ts` / `lazada.client.ts` / `tiktok.client.ts` (stubs — code present but only called when explicitly enabled), `web-scrape.client.ts` (Playwright + Gemini fallback for arbitrary URLs).
- **Active networks are env-gated**: `CRAWLER_ENABLED_NETWORKS` (comma-separated, case-insensitive, default `"accesstrade"`) decides which clients `CrawlerService` actually pulls from. All clients stay in `CrawlerModule` providers regardless — keep them so the skeleton is ready when you onboard a direct integration.
- To add a new network: implement `AffiliateClient`, register the provider in `CrawlerModule`, inject into `CrawlerService` constructor and add to the `all` array, then add the network name to `CRAWLER_ENABLED_NETWORKS`.
- Normalized offer shape in `dto/normalized-offer.dto.ts` — the contract all clients converge to before hitting `ImportService` / `EnrichmentService`. Use `metadata?: Record<string, unknown>` for network-specific fields that don't fit the normalized columns (shop ratings, voucher codes...) so we don't have to widen the DTO every time.
- **Per-assignment fetch (push filterRules xuống AT)**: `CrawlerService.runFullCycle` load tất cả `CampaignNiche` có `Campaign.status=APPROVED` + `atCampaignId` + `merchantName`. Mỗi assignment = 1 fetch `/v1/datafeeds?campaign=<merchantSlug>` + filter từ `rulesToFetchOpts(rules)` (convert FilterRules → AT params: `discount_rate_from/to`, `price_from/to`, `discount_from/to` (giá sau giảm), `discount_amount_from/to`, `status_discount`, `update_from` (incremental sync), `domain` chỉ khi rule có ĐÚNG 1 domain). Limit `PER_ASSIGNMENT_LIMIT=100` (1 page, không paginate). Sleep `SLEEP_BETWEEN_FETCH_MS=500ms` giữa fetch. Mỗi offer trong response → route thẳng vào `assignment.niche.slug` + `assignment.campaign.id`. `offerPassesFilter` chạy client-side như tầng phòng vệ 2 (chính cho `domains` ≥2 không push được). `CycleResult.assignments[]` trả breakdown chi tiết per-assignment cho UI. **Lưu ý**: `?campaign=` của AT là **merchant slug** (lấy từ `Campaign.merchantName`), KHÔNG phải `atCampaignId` numeric (truyền sai → AT trả mảng rỗng âm thầm; xem [accesstrade.md](../../docs/integrations/accesstrade.md) gotcha #3).
- **`niche-inference.util.ts` là legacy (`@deprecated`)** — chỉ còn `WebScrapeClient` (paste URL tay) gọi làm fallback khi admin không truyền `nicheSlug`. Crawler-cycle KHÔNG đụng. Không sửa keyword table; xoá khi web-scrape không còn dùng.
- **No global min-discount env**: discount threshold giờ per-campaign trong `Campaign.filterRules.minDiscountPercent`. `CRAWLER_MIN_DISCOUNT_PERCENT` đã bị xoá khỏi `.env.example` (sprint at-source-of-truth).
- **Webhook contract is currently Accesstrade-shaped**: `WebhooksController` parses one format. When a second network goes live (direct Shopee/Lazada postback), split into per-network endpoints (`/webhooks/conversion/<network>`) that each normalize into a single `ConversionWebhook` row — don't try to make one parser polymorphic.
- **Accesstrade API reference**: endpoint shapes (datafeeds, campaigns, product_link/create, transactions), auth format, rate limits, mapping vào schema repo — xem [`docs/integrations/accesstrade.md`](../../docs/integrations/accesstrade.md). Đọc trước khi đụng vào `accesstrade.client.ts` hoặc khi mở rộng sang endpoint mới của Accesstrade.

## Top products

`TopProductsSyncService` (`src/modules/crawler/top-products-sync.service.ts`) pull AT `/v1/top_products` mỗi 3h sáng, lưu snapshot per day vào `TopProductSnapshot`. Homepage section "🔥 Đang hot tuần này" (`apps/web/app/page.tsx`) render snapshot mới nhất qua public `GET /api/v1/top-products?limit=12`.

- **Snapshot per day**: `@@unique([snapshotDate, position, atProductId])` — không overwrite, giữ history. Cron skip nếu hôm nay đã có snapshot (idempotent).
- **Date format**: AT `/top_products` dùng `DD-MM-YYYY` cho `date_from`/`date_to`, KHÔNG phải ISO. Helper `AccesstradeClient.toAtDayFormat()` là pattern duy nhất đúng — đừng `.toISOString()` cho endpoint này.
- **`discount` là VND** (giá sau giảm), KHÔNG phải %. Lưu trực tiếp.
- **Lookback**: 7 ngày qua (`TOP_PRODUCTS_LOOKBACK_DAYS`).
- **Click flow**: link card thẳng ra `affLink` với `rel="nofollow sponsored noopener"` — không qua `ClickLog` (data này không phải Product DB của ta; tracking nội bộ = phase sau). AT vẫn track qua aff_link → revenue vẫn về.
- **Env**: `TOP_PRODUCTS_ENABLED` (true/false), `TOP_PRODUCTS_CRON` (default `0 3 * * *`).
- **Admin endpoint**: `POST /api/v1/admin/top-products/sync` (admin) — chạy snapshot tay (hữu ích khi backfill hoặc bootstrap).
- **Image domain**: hiện dùng `<img>` thường (storefront chưa migrate sang `next/image`), nên không cần update `next.config.ts`. Nếu sau này dùng `next/image` → cần thêm domain (lazada-vn-live, shopee.vn, …) vào `images.remotePatterns`.

## Coupons

`CouponSyncService` (`src/modules/crawler/coupon-sync.service.ts`) poll AT mỗi 6h, pull voucher → `Coupon` DB. Storefront route `/khuyen-mai/<merchantSlug>` (`apps/web/app/khuyen-mai/[merchantSlug]/page.tsx`) đọc qua public endpoint `/api/v1/coupons` (CouponsController, không auth).

- **3-level fetch**: `merchant_list` → cross-reference với `Campaign` đã `APPROVED + merchantName` (case-insensitive lower) → per merchant `icontext_list` (5 keyword đầu) → per keyword `coupon?icon_text=<id>` (20 coupon). Sleep 7s giữa mọi request (`COUPON_SYNC_SLEEP_MS`) — AT cap 10 req/phút trên `/offers_informations/*`.
- **No-merchant-matched short-circuit**: nếu không có Campaign nào match → log warning, return ngay, không pull để khỏi lãng phí quota.
- **HITL gate**: coupon mới sync → `isActive=false`. Admin approve qua `POST /admin/coupons/:id/approve` (hoặc archive bằng `:id/archive`). Storefront chỉ show `isActive=true` AND `(expiresAt IS NULL OR expiresAt > now())`.
- **Identity**: `Coupon.atCouponId` unique; `Coupon.code` set = `atCouponId` để giữ unique constraint hiện có (voucher code thật từ `c.coupons[]` lưu trong `atRawData`, chưa parse — phase sau).
- **`contentHtml` sanitize gate**: HTML từ AT là untrusted (có thể chứa `<script>`, `<iframe>`). `CouponSyncService` gọi `sanitizeCouponHtml()` từ [`src/common/sanitize-html.util.ts`](src/common/sanitize-html.util.ts) **trước khi save vào DB**. Render side (admin View dialog, public CouponCard) dùng `dangerouslySetInnerHTML` chỉ vì DB đã sạch — không sanitize lại ở client, không ngược chiều luồng này. Anchor tự thêm `rel="nofollow noopener" target="_blank"`.
- **Env**: `COUPON_SYNC_ENABLED` (true/false), `COUPON_SYNC_CRON` (default `0 */6 * * *`).
- **Admin endpoints**: `POST /admin/coupons/sync-from-at` (admin), `GET /admin/coupons?merchantSlug=&isActive=&limit=` (viewer+), `POST /admin/coupons/:id/approve|:id/archive` (reviewer+).
- **Public endpoint**: `GET /api/v1/coupons?merchantSlug=&limit=` — chỉ trả active + chưa expired. Không cache HTTP; ISR ở Next side (`revalidate: 1800`).

## Reconciliation

`ReconciliationService` (`src/modules/reconciliation/`) polls Accesstrade `/v1/order-list` mỗi 30 phút và update `ConversionWebhook` với ground-truth data. Webhook real-time vẫn chạy — reconciler là backup, KHÔNG thay thế.

- **Cycle window**: `lastSuccessfulRun.syncWindowEnd − 10min` → `now`. First run: 24h lookback.
- **Match strategy**: ưu tiên `order.utm_source = ConversionWebhook.trackingCode`; fallback `order.order_id = ConversionWebhook.atOrderId` (cho row đã reconcile trước).
- **Unmatched orders**: chỉ log warning, KHÔNG tạo `ConversionWebhook` mới — sẽ FK violation vì `trackingCode` phải tồn tại trong `ClickLog`. Admin xem `ReconciliationLog.unmatched` để biết webhook miss.
- **Mismatch**: nếu `|webhook.revenue − order.pub_commission| > 1` ghi vào `ConversionWebhook.reconcileNotes` để admin theo dõi trên `/admin?tab=money-trail`.
- **Source field**: webhook-only = `"webhook"`; reconciler-only = `"api-reconcile"`; cả hai = `"both"`.
- **Rate limit**: AT cap 10 req/phút trên `/v1/order-list`. Service sleep 7s giữa request khi pagination → tối đa ~57 req/cycle (20 pages × 300 orders).
- **Manual trigger**: `POST /api/v1/admin/reconciliation/run` (role `admin`). Logs ở `GET /api/v1/admin/reconciliation/logs`.
- **Env**: `RECONCILE_ENABLED` (true/false), `RECONCILE_CRON` (default `*/30 * * * *`).

## Testing

- Jest. Sole spec currently: `src/modules/app.module.spec.ts`. Run a single test: `npm run test -- <pattern>` or `-- -t "test name"`.
- No DB mocking convention yet — if you add Prisma-touching tests, set up the test DB explicitly rather than reaching for mocks.

## Env (this workspace's `.env`)

- `DATABASE_URL` (required) — Postgres connection string.
- `PORT` — defaults to 4000.
- `GEMINI_API_KEY` — required for any path that hits `AiService`.
- `GEMINI_MODEL` — defaults to `gemini-2.0-flash`. Swap to `gemini-2.0-flash-thinking-exp` for reasoning or `gemini-2.0-pro` for accuracy.
- `ADMIN_API_KEY` — must match the web app's value.
- `CRAWLER_CRON` / `CRAWLER_ENABLED` / `CRAWLER_ENABLED_NETWORKS` / `CRAWLER_AI_ENRICH` — crawler scheduler + AI rewrite controls. Per-campaign discount threshold lives in `Campaign.filterRules`, NOT env.
- `RECONCILE_ENABLED` / `RECONCILE_CRON` — `/v1/order-list` poller (sprint at-source-of-truth STORY-05).
- `COUPON_SYNC_ENABLED` / `COUPON_SYNC_CRON` — `/v1/offers_informations/coupon` poller (STORY-06).
- `TOP_PRODUCTS_ENABLED` / `TOP_PRODUCTS_CRON` — `/v1/top_products` daily snapshot (STORY-07).
- `ACCESSTRADE_API_BASE` / `ACCESSTRADE_ACCESS_TOKEN` — credentials for every AT call.
