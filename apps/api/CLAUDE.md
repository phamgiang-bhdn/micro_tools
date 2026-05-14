# apps/api — NestJS backend

Auto-loaded when working anywhere under `apps/api/`. Root `CLAUDE.md` covers monorepo-level commands and cross-app invariants; this file is Nest-specific.

## Bootstrap

`src/main.ts` does three things you can rely on globally:
1. `app.setGlobalPrefix("api/v1")` — every controller path is mounted under `/api/v1/*`. Don't hardcode the prefix inside controller decorators.
2. Global `ValidationPipe({ whitelist: true, transform: true })` — incoming DTOs are stripped of unknown keys and coerced. Define request shape with `class-validator` decorators on a DTO class and inject it; **don't** re-validate inside the controller body.
3. Port from `process.env.PORT ?? 4000`.

## Module wiring

`src/modules/app.module.ts` imports `ConfigModule.forRoot({ isGlobal: true })` and `CrawlerModule`, and registers five controllers directly: `WebhooksController`, `ToolsController`, `TrackingController`, `ArticlesController`, `AdminController`. `PrismaService`, `ScraperService`, `AiService`, `ArticleService` are top-level providers.

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
  - `parseBySchema<T>(scrapedText, schema)` — extraction (raw text → structured JSON via `Tool.schemaConfig`). Used by Refinery / crawler enrichment.
  - `generateJson<T>(fullPrompt)` — generation (full prompt → JSON). Used by `ArticleService.generateDraft()` for blog AI authoring. The caller controls the entire prompt; nothing is prepended.
- `currentModel` getter exposes the active model name (used to log into `Article.aiModel` for traceability).
- Built-in retry: 3 attempts, backoff `Math.min(60000, attempt * 15000)` (15s/30s/45s) when error matches `429|rate limit|quota`. After max attempts, throws `HttpException(429)`. Non-rate-limit errors re-throw immediately. Don't wrap your own retry on top.
- `parseBySchema` truncates `scrapedText` to 15000 chars; `generateJson` does NOT truncate — caller is responsible for prompt size.

## Articles (AI-generated blog)

Same HITL philosophy as `ProductExtraction`: AI produces a draft, an admin reviews, only then it reaches the public storefront. States on `Article.status`: `DRAFT | PUBLISHED | ARCHIVED`. `Article.type`: `BUYING_GUIDE | REVIEW`.

- **`ArticleService` (`src/services/article.service.ts`)** — picks the active `PromptTemplate` by name (`article-buying-guide` or `article-review`), interpolates `{topic}`, `{toolName}`, `{productHints}` (auto-built from `productIds`), calls `AiService.generateJson<ArticleAiOutput>` validated by a zod schema. Returns `{ output, promptName, modelName }`; the AdminController is the one that persists into `Article` and dedupes slug via `ensureUniqueSlug(candidate, excludeId?)`.
- **`ArticlesController` (public)** — `GET /api/v1/articles?type=&toolSlug=&limit=` (PUBLISHED only), `GET /api/v1/articles/:slug` (returns article + related `products` joined by `productIds[]`). Both unauthenticated.
- **Admin endpoints** in `AdminController`: `GET /admin/articles`, `GET /admin/articles/:id`, `POST /admin/articles/generate`, `PUT /admin/articles/:id`, `POST /admin/articles/:id/publish`, `POST /admin/articles/:id/archive`. Use zod schemas (`generateArticleSchema`, `updateArticleSchema`) for body validation.
- `Article.productIds: String[]` is a plain Postgres uuid array, **not** a relation table. Hand-managed: when products are deleted, the `Article` still references them by id — frontend must handle missing.

## Crawler

- Scheduler: `CrawlerScheduler` runs `@Cron(process.env.CRAWLER_CRON ?? "0 */6 * * *")`. Disable with `CRAWLER_ENABLED=false`. Cron name `crawler-cycle`.
- Three client implementations under `src/modules/crawler/clients/`: `accesstrade.client.ts`, `shopee.client.ts`, `web-scrape.client.ts`. To add a new affiliate network: implement a client, register it in `CrawlerModule` providers, and integrate it in `CrawlerService.runFullCycle()`.
- Normalized offer shape in `dto/normalized-offer.dto.ts` — the contract all clients converge to before hitting `ImportService` / `EnrichmentService`.

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
