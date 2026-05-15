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
- Migrations live in `prisma/migrations/`. After editing `prisma/schema.prisma`, run `npm run prisma:generate` from this workspace (or `npm run db:generate` from root) before the new types are usable.
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
  - `parseBySchema<T>(scrapedText, schema)` — extraction (raw text → structured JSON via `Category.schemaConfig`). Used by Refinery / crawler enrichment.
  - `generateJson<T>(fullPrompt)` — generation (full prompt → JSON). Used by `ArticleService.generateDraft()` for blog AI authoring. The caller controls the entire prompt; nothing is prepended.
- `currentModel` getter exposes the active model name (used to log into `Article.aiModel` for traceability).
- Built-in retry: 3 attempts, backoff `Math.min(60000, attempt * 15000)` (15s/30s/45s) when error matches `429|rate limit|quota`. After max attempts, throws `HttpException(429)`. Non-rate-limit errors re-throw immediately. Don't wrap your own retry on top.
- `parseBySchema` truncates `scrapedText` to 15000 chars; `generateJson` does NOT truncate — caller is responsible for prompt size.

## Articles (AI-generated blog)

Same HITL philosophy as `ProductExtraction`: AI produces a draft, an admin reviews, only then it reaches the public storefront. States on `Article.status`: `DRAFT | PUBLISHED | ARCHIVED`. `Article.type`: `BUYING_GUIDE | REVIEW`.

- **`ArticleService` (`src/services/article.service.ts`)** — picks the active `PromptTemplate` by name (`article-buying-guide` or `article-review`), interpolates `{topic}`, `{categoryName}`, `{productHints}` (auto-built from `productIds`), calls `AiService.generateJson<ArticleAiOutput>` validated by a zod schema. Returns `{ output, promptName, modelName }`; the AdminController is the one that persists into `Article` and dedupes slug via `ensureUniqueSlug(candidate, excludeId?)`.
- **`ArticlesController` (public)** — `GET /api/v1/articles?type=&categorySlug=&limit=` (PUBLISHED only), `GET /api/v1/articles/:slug` (returns article + related `products` joined by `productIds[]`). Both unauthenticated.
- **Admin endpoints** in `AdminController`: `GET /admin/articles`, `GET /admin/articles/:id`, `POST /admin/articles/generate`, `PUT /admin/articles/:id`, `POST /admin/articles/:id/publish`, `POST /admin/articles/:id/archive`. Use zod schemas (`generateArticleSchema`, `updateArticleSchema`) for body validation.
- `Article.productIds: String[]` is a plain Postgres uuid array, **not** a relation table. Hand-managed: when products are deleted, the `Article` still references them by id — frontend must handle missing.

## Campaigns

`Campaign` model groups all `Product`s and `ConversionWebhook`s that come from one merchant on one affiliate network — e.g. `(ACCESSTRADE, "shopee-cps-vn")` is "Shopee via Accesstrade publisher account". One affiliate token can be approved for many campaigns; this model is how we track which.

- **Identity**: `@@unique([network, externalId])`. `externalId` is `slugify(offer.campaign)` for crawler-discovered campaigns (Accesstrade doesn't expose campaign IDs in datafeed, only names). When you create a campaign manually via `/admin/campaigns`, pick the same slug so the crawler will dedupe into it later.
- **Lifecycle**: `APPLIED → APPROVED → PAUSED/REJECTED → INACTIVE`. Status is **synced manually** — Accesstrade has no API to query publisher approval state. Admin updates per row in `/admin/campaigns` after checking their dashboard.
- **Auto-create**: `ImportService.resolveCampaignId` upserts on every crawler tick. New campaigns land as `APPLIED`; existing rows refresh `name`/`merchantName` but never overwrite admin-managed fields (`status`, `notes`, `approvedAt`).
- **Webhook link**: `WebhooksController.resolveCampaignId` looks up `(network, slugify(payload.campaign))` and sets `ConversionWebhook.campaignId` if found. Does NOT auto-create — webhooks shouldn't be the source of truth for campaign rows (race: a postback for an unknown campaign would create a row with no merchant context).
- **Don't delete campaigns with history**: `Campaign.deleteCampaign` 409s when there are linked products/conversions. Use `status: INACTIVE` to hide instead — preserves attribution trail.
- **Product.campaignId is nullable + SetNull on delete**: products created before campaign tracking (or from `web-scrape.client.ts` manual paste) have `campaignId = null`. The storefront doesn't care; this is metadata for admin reporting only.

## Crawler

- Scheduler: `CrawlerScheduler` runs `@Cron(process.env.CRAWLER_CRON ?? "0 */6 * * *")`. Disable with `CRAWLER_ENABLED=false`. Cron name `crawler-cycle`.
- Affiliate clients live in `src/modules/crawler/clients/` and all implement `AffiliateClient` (`affiliate-client.interface.ts`): `accesstrade.client.ts` (active), `shopee.client.ts` / `lazada.client.ts` / `tiktok.client.ts` (stubs — code present but only called when explicitly enabled), `web-scrape.client.ts` (Playwright + Gemini fallback for arbitrary URLs).
- **Active networks are env-gated**: `CRAWLER_ENABLED_NETWORKS` (comma-separated, case-insensitive, default `"accesstrade"`) decides which clients `CrawlerService` actually pulls from. All clients stay in `CrawlerModule` providers regardless — keep them so the skeleton is ready when you onboard a direct integration.
- To add a new network: implement `AffiliateClient`, register the provider in `CrawlerModule`, inject into `CrawlerService` constructor and add to the `all` array, then add the network name to `CRAWLER_ENABLED_NETWORKS`.
- Normalized offer shape in `dto/normalized-offer.dto.ts` — the contract all clients converge to before hitting `ImportService` / `EnrichmentService`. Use `metadata?: Record<string, unknown>` for network-specific fields that don't fit the normalized columns (shop ratings, voucher codes...) so we don't have to widen the DTO every time.
- Free-text → `categorySlug` mapping lives in `category-inference.util.ts` (shared across clients). Don't re-implement per-client regex; extend the keyword table there.
- **Webhook contract is currently Accesstrade-shaped**: `WebhooksController` parses one format. When a second network goes live (direct Shopee/Lazada postback), split into per-network endpoints (`/webhooks/conversion/<network>`) that each normalize into a single `ConversionWebhook` row — don't try to make one parser polymorphic.

## Testing

- Jest. Sole spec currently: `src/modules/app.module.spec.ts`. Run a single test: `npm run test -- <pattern>` or `-- -t "test name"`.
- No DB mocking convention yet — if you add Prisma-touching tests, set up the test DB explicitly rather than reaching for mocks.

## Env (this workspace's `.env`)

- `DATABASE_URL` (required) — Postgres connection string.
- `PORT` — defaults to 4000.
- `GEMINI_API_KEY` — required for any path that hits `AiService`.
- `GEMINI_MODEL` — defaults to `gemini-2.0-flash`. Swap to `gemini-2.0-flash-thinking-exp` for reasoning or `gemini-2.0-pro` for accuracy.
- `ADMIN_API_KEY` — must match the web app's value.
- `CRAWLER_CRON` / `CRAWLER_ENABLED` — scheduler controls.
