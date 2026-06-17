# Architecture — api (NestJS backend)

> Generated 2026-06-17 (deep scan). Part: `apps/api`. See [apps/api/CLAUDE.md](../apps/api/CLAUDE.md) for the authoritative module-level patterns.

## Executive summary

NestJS 10 service/API backend. Global prefix `/api/v1`, global `ValidationPipe({ whitelist, transform })`. Prisma on PostgreSQL 16. AI is provider-agnostic via `AiService`. Affiliate data flows from Accesstrade through a per-campaign crawler into a HITL review pipeline before reaching the public storefront.

## Technology stack

| Category | Technology | Notes |
|---|---|---|
| Framework | NestJS 10 | one feature module per concern |
| Language | TypeScript 5 (strict, no `any`) | |
| ORM | Prisma | inject `PrismaService`, never `new PrismaClient()` |
| DB | PostgreSQL 16 | JSONB columns for dynamic/per-niche data |
| Validation | class-validator (public) + zod (admin) | don't mix within one controller |
| Scheduling | `@nestjs/schedule` | crawler 6h, coupon 6h, top-products 3am, reconcile 30m — env-gated |
| AI | Gemini / OpenAI-compatible | model from env, resolved per-call |

## Module map

| Module | Responsibility |
|---|---|
| `admin` | `AdminController` — Refinery, Prompt Studio, Money Trail, War Room, sync triggers. Auth per-method via `authorize(role, key, allowedRoles)`. zod body validation. |
| `crawler` | AT clients (`accesstrade.client`, `web-scrape.client`), `CampaignSyncService`, `CouponSyncService`, `TopProductsSyncService`, `ImportService`, `EnrichmentService`, `ClassificationService`, `PriceIntelligenceService`, `ProductDiscoveryService`. Owns the scheduler. |
| `refinery` | `ConfidenceService` (deterministic 0–100 score + reasons) → auto-approve above threshold; `RefineryService` (bulk approve / unapprove). |
| `insights` | Money loops: `CommissionRankService`, `KeywordRadarService`, `OpportunityService`, `OrderProductsSyncService`, `RealBestsellerService`, `MoneyTrailService`. |
| `reconciliation` | `ReconciliationService` polls `/v1/order-list`, updates `ConversionWebhook` with ground-truth, writes `reconcileNotes` on mismatch. |
| `tool` | Interactive AI tool: `ScoringService` (deterministic rule scoring), `ToolAiService` (reasoning), `InventoryCheckService`, `ToolPublicController` (quiz session submit). |
| `assistant` | `AssistantService` + `AssistantController` — AI price/classification assistant (V4 deal-intelligence). |
| `prices` | `PriceController` — read API over `PriceSnapshot` (price history / intelligence). |
| `articles` | Public `ArticlesController` + `ArticleNotificationService`. |
| `article-pipeline` | Multi-stage AI article generation (`ArticlePipelineService`) + `ArticleRefreshService`. |
| `coupons` / `niches` / `top-products` | Public read controllers. |
| `subscribers` / `waitlist` | Lead capture. |
| `tracking` | `POST /tracking/click` → `ClickLog`. |
| `webhooks` | `POST /webhooks/accesstrade` → `ConversionWebhook` (one network-specific handler; don't make polymorphic). |

Top-level providers: `PrismaService`, `AiService`, `ScraperService`, `ArticleService`, `SyncStatusService`.

## Architecture patterns

- **Per-method auth gate** in `AdminController` (not a guard) — `this.authorize(...)` with the minimum role.
- **Manual sync mode**: `SyncStatusService.wrap(name, fn)` records `LastSyncStatus`; cron is OFF by default (`CRAWLER_ENABLED=false`), operator triggers via admin buttons.
- **Per-campaign crawler loop**: only `Campaign.status=APPROVED` + `atCampaignId` + `merchantName` + ≥1 `CampaignNiche` assignment get fetched; `filterRules` pushed down to AT datafeed query params.
- **AI single-attempt at stage level** (no stage-level retry); `AiService` has built-in rate-limit backoff only.
- **HITL gates** on `ProductExtraction`, `Article`, `Coupon`.

## Data architecture

See [data-models.md](./data-models.md). Key: `Niche.schemaConfig` (Json) is the per-niche dynamic spec the extractor maps into.

## API design

Public read endpoints under `/api/v1`: `/niches`, `/articles`, `/coupons`, `/top-products`, prices, tool session. Write/ingest: `/tracking/click`, `/webhooks/accesstrade`. Admin under `/api/v1/admin/*` (header-auth). Full endpoint catalog: api-contracts.md _(To be generated)_.

## Testing

Jest (`npm run test:api`). Currently minimal coverage (`app.module.spec.ts`). No DB-mock convention — use an explicit test DB if adding Prisma-touching tests.

## Integration

Inbound: web HTTP calls + affiliate webhooks. Outbound: Accesstrade REST API (see [integrations/accesstrade.md](./integrations/accesstrade.md)). Cross-part contract detail in [integration-architecture.md](./integration-architecture.md).
