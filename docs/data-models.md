# Data Models

> Generated 2026-06-17 from `apps/api/prisma/schema.prisma` (single baseline `0_init`). PostgreSQL 16 via Prisma. Authoritative source is always the schema file.

## Enums

`NicheStatus` (ACTIVE | INACTIVE) · `ParseStatus` (DRAFT_RAW | PENDING_REVIEW | PUBLISHED | ERROR) · `ArticleType` (BUYING_GUIDE | REVIEW) · `ArticleStatus` (DRAFT | PUBLISHED | ARCHIVED) · `EvidenceType` · `AffiliateNetwork` (ACCESSTRADE | …) · `CampaignStatus` (APPLIED | APPROVED | PAUSED | REJECTED | INACTIVE) · `SubscriberStatus` · `ToolStatus`.

## Domain groups

### Presentation layer (admin-defined, SEO-facing)
- **Niche** — `slug` 🔑, `name`, `status`, `schemaConfig` (Json, per-niche dynamic spec), `keywords[]`. Groups products. Public URL `/categories/[slug]`.
- **Product** — `nicheId →`, `campaignId →?` (SetNull on delete), `name`, `slug`, `affiliateUrl`, `scrapedData` (JsonB, per-niche), `network`, `isPublic`. Read on web only via `normalizeProduct`.
- **ProductExtraction** — `rawContent`, `aiOutput` (Json), `status: ParseStatus`, `autoApproved`/`autoApprovedAt`/`unapprovedAt`, `errorReason`. The Refinery HITL record; approval copies `aiOutput → Product.scrapedData` and publishes.
- **ProductReview** — rating/content per product.
- **Shop** — store/domain semantic metadata.

### Upstream layer (Accesstrade source-of-truth)
- **Campaign** — `@@unique([network, externalId])`; `atCampaignId` 🔑 (real AT id, the join key for new code), `merchantName`, `status: CampaignStatus`, `filterRules` (Json), `atRawData` (Json), AT metadata (`atCategoryName`, `atScope`, `atCookieDurationSec`, …). `externalId` slug is legacy/deprecated.
- **CampaignNiche** — M:N `Campaign ↔ Niche`, with per-pair `filterRules` + `priority`.
- **CrawlerLog** — audit of crawler cycles (per-assignment breakdown).

### Revenue attribution (the trackingCode spine)
- **ClickLog** — `trackingCode` 🔑 (32-char dashless uuid), `productId →`, `channel`, `marketplace`, `toolId`, `quizSessionId`, `ipHash`, `userAgent`, `createdAt`.
- **ConversionWebhook** — references `ClickLog` by `trackingCode`; `revenue`, `status`, `channel`, `atOrderId`, `atCommission`, `source` (webhook | api-reconcile | both), `reconcileNotes`, `payload` (Json).
- **OrderProduct** — product-line breakdown from `/v1/order-products` (real bestseller aggregation).
- **ReconciliationLog** — audit of `/order-list` reconcile cycles (incl. `unmatched`).
- **LastSyncStatus** — `name` 🔑, `lastRunAt/lastSuccessAt/lastError/lastDurationMs/lastResult`, `expectedFrequencySec` (drives `isStale`). 6 backbone rows seeded.

### Catalog synced from AT
- **Coupon** — `atCouponId` 🔑, `merchantSlug`, `contentHtml` (sanitized server-side), `code`, `expiresAt`, `isActive` (HITL gate).
- **TopProductSnapshot** — `@@unique([snapshotDate, position, atProductId])`; `affLink`, `discount` (VND). Daily snapshot, no overwrite.

### Price intelligence (V4)
- **PriceSnapshot** — `productId →`, `price`, `originalPrice`, `source`/`marketplace`, `fetchedAt`. Index `(productId, fetchedAt desc)`. One row per product per crawl cycle → price history + deal-verdict.
- **PriceAlert** — threshold drop alerts (model + skeleton; live-posting not yet wired — needs channel credentials).

### Blog (AI-authored, HITL)
- **Article** — `slug` 🔑, `type: ArticleType`, `status: ArticleStatus`, `productIds: String[]` (plain uuid array, hand-managed — not a relation), `aiModel`, multi-stage progress fields (`currentStageMessage`, `currentStageProgress`, `aiRevisionCount`, `thesisEmbedding`, `coverImageAttribution`).
- **ArticleSection** / **ArticleEvidence** — structured body + evidence (`EvidenceType`).
- **ArticleGenerationRun** — per-run multi-stage progress + `output` (Json).
- **Author** — `slug` 🔑, `name`, `bio`, `voiceProfile` (Json), `expertiseNiches: String[]`.

### Interactive AI tool
- **Tool** — `slug` 🔑, `nicheId →`, `quizSchema` (Json), `scoringRules` (Json), `resultTemplate` (Json), `status: ToolStatus`, SEO fields.
- **QuizSession** — a user's quiz run + scored result (links to `ClickLog` via `quizSessionId`).
- **ReasoningCache** — cached AI reasoning (`model`, key, output) to avoid recompute.

### System & leads
- **PromptTemplate** — `name` 🔑, `content`, `version`, `isActive` (exactly one active per name), `activatedAt`. Used by extractor, article authoring, and tool prompts.
- **Subscriber** — `status: SubscriberStatus` (price-watch / newsletter).
- **WaitlistSignup** — pre-launch interest capture.

## Migration strategy

Single baseline `prisma/migrations/0_init/migration.sql` (pre-release squash). New changes: edit `schema.prisma` → `npm run db:migrate -- --name <slug>` (additive migrations on top of baseline). Never hand-edit the DB.
