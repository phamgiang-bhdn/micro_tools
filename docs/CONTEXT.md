# Business context — dealvault

Read this when working on anything user-facing, admin tooling, or AI extraction. For purely infra/build/devops tasks, the root `CLAUDE.md` alone is enough.

## What dealvault is

A Vietnam-market affiliate micro-tool platform. Revenue model: every user click on a product card becomes a tracked outbound click to an affiliate network (Accesstrade is default — see `Product.network`); if it converts, the network posts a webhook back with revenue.

**Everything in the architecture exists to either (a) drive more qualified clicks or (b) prove which clicks earned revenue.** When evaluating a feature proposal, that's the lens.

## Product direction — AI deal-intelligence

Positioning in one line: *"AI that tells real deals from fake ones and advises buying the right item, at the right time, at the lowest price"* for home appliances / smart home — distributed across social/deal-feed channels, monetised across multiple affiliate networks.

The test for every AI feature: **"Could ChatGPT just do this for the user itself?"** If yes → it's slop, drop it. If no — because it needs live Vietnam price data or continuous action — it's a moat, build it.

What this means in practice:
- **Real-time price truth is the moat.** AI Overviews increasingly answer "which X is best" (informational) queries, so generic comparison/SEO content is a shrinking channel. Live price/inventory + interactive tools are what AI can't replace.
- **Transactional + long-tail over evergreen "best X".** Lean into "giá [model] tháng X — rẻ nhất ở đâu" intent; demote (don't delete) evergreen buying guides. Programmatic transactional pages must be data-backed (avoid scaled-content penalties).
- **Distribution is social/video/deal-feed**, not only text search — VN buyers convert there.
- **Don't rewrite.** The app is pre-launch with 0 users; the biggest risk is never shipping. Add a thin price-data layer and validate each phase behind a gate rather than launching "grand rewrites."
- **The AI badge is packaging, not foundation.** The foundation is capability (live price data). AI slop makes the badge backfire.

## Strategy: "one micro-tool = one niche"

The product is *not* a general catalog. Each `Niche` is a single deeply-comparable group with its own `schemaConfig` of niche-specific spec fields. Narrow focus is the conversion thesis.

When you're tempted to add cross-niche generic features (a global search, a one-size-fits-all product card), check the per-niche angle first — it's usually the wrong instinct here.

> Naming note: the platform is *positioned* as a "micro-tool" platform (marketing / strategy framing). In the codebase the entity that groups products is `Niche`; the public storefront URL is `/categories/[slug]` for SEO. `Tool` is a separate concept — interactive AI quiz/scoring tools (`Tool` / `QuizSession` models).

## Niche lineup

Niches are seeded in `apps/api/prisma/seed.js` — ~100 niches covering the highest-volume affiliate verticals in VN (phones & tablets, computing, audio, wearables, camera, smart home, small & large appliances, beauty, health & sport, baby, pet, and more). **Only the launch niche is created `ACTIVE`** (default `may-loc-nuoc`, overridable via `LAUNCH_NICHE_SLUG`); the rest are `INACTIVE` — data kept, hidden from the storefront until a niche is intentionally launched.

Representative slugs by group:

| Group | Slugs |
|---|---|
| Smart home / small appliances | `robot-hut-bui-lau-nha`, `may-loc-khong-khi`, `may-loc-nuoc`, `noi-chien-khong-dau` |
| Large appliances | `may-giat`, `tu-lanh`, `dieu-hoa` |
| Consumer electronics | `tivi`, `laptop`, `tai-nghe-tws`, `dong-ho-thong-minh` |
| Beauty | `my-pham-duong-da`, `kem-chong-nang` |

**Products are NOT seeded** — they flow into the DB exclusively via the Accesstrade crawler after admins onboard a campaign (assign campaign → niche, set `filterRules`). The seed only creates Niche rows + system `PromptTemplate` rows + a sample Tool + default Authors.

When adding a new niche: a Vietnamese-no-dấu slug, a Vietnamese `name`, and a `schemaConfig` listing the 5–10 spec fields that *actually* differentiate buying decisions in that niche (the AI extractor uses this to know what to pull out of merchant pages).

## Three audiences, three surfaces

- **End user** — public storefront (RSC + ISR). Comes from SEO / social. Conversion target: click "Xem deal". Vietnamese copy, VND prices, store badges (Lazada Mall / Shopee Mall / Tiki Trading / Điện Máy Xanh).
- **Operator / admin** — Next `/admin` pages + Nest `/api/v1/admin/*`. Runs the Refinery, Prompt Studio, Money Trail, War Room.
- **Affiliate network** — webhook caller. Posts to `/api/v1/webhooks/conversion` with `{ trackingCode, revenue, status, payload }`. Treat this endpoint as a stable external contract.

## Why human-in-the-loop is non-negotiable

This is not paranoia about AI quality — it's **affiliate-compliance and brand-trust**. A wrong price or fake voucher harms partner relationships and SEO trust signals.

The `PENDING_REVIEW` gate exists so a human always sees AI output before it reaches the public storefront. **Don't propose "auto-publish if confidence > X" shortcuts unless explicitly asked.** (Pure price-data may pass rule-based validation, but editorial claims always stay full-HITL.)

## SEO is a primary growth channel

ISR (`revalidate: 300`), per-product JSON-LD (`Product` / `Offer` / `AggregateRating`), DB-driven `sitemap.xml`, and Vietnamese semantic slugs are load-bearing — not decoration. Changes that affect crawlability, canonical URLs, or structured-data emission are higher-risk than they look.

## Content strategy: AI-authored, human-reviewed blog

A pure product-comparison site can't out-rank Tiki/Shopee/Lazada on commercial queries — the domain authority gap is unwinnable. **Affiliate sites win via informational content**: buying guides, reviews, comparisons. The blog (`/blog`) captures top-funnel traffic ("cách chọn xxx", "review xxx", "xxx có tốt không") and funnels readers into the product comparison surface.

- **AI authoring** — `/admin/articles/new` triggers the AI pipeline with the active `PromptTemplate` for the chosen `ArticleType` (`BUYING_GUIDE` or `REVIEW`). Prompts tell the AI to write *as if it had used the product*, include sensory detail (noise dB, sạc đầy bao lâu, etc.), and always include both pros AND cons. The AI must never disclaim being AI.
- **Human review is mandatory** — same HITL gate as Refinery. `Article.status` flows `DRAFT → PUBLISHED` only after admin clicks Publish in `/admin/articles/[id]`. Don't propose "auto-publish if confidence > X" — Google's Helpful Content Update penalizes unreviewed AI content.
- **Tone & guardrails** — prompts forbid emoji-spam, forbid "tốt nhất thế giới"-style hyperbole, enforce length minimums, require explicit weaknesses, and enforce a phrase blacklist (Vinglish / marketing filler). Admin's job is to spot hallucinated facts (wrong prices, made-up specs), tighten language, and approve.
- **Product cross-links** — `Article.productIds[]` is hand-picked at generation time. The article renders `ProductCard`s with a "Xem deal" CTA → reuses the tracking flow. This is how the blog converts to clicks.

## Data flow — Accesstrade is upstream, Niche is the view

The mental model for data:

```
[Accesstrade]                       ← raw data pool; we don't control its structure
     ↓ sync (auto cron + admin manual button)
[Campaign + Product raw]            ← mirror in DB, 1-1 with AT (Campaign.atCampaignId)
     ↓ filter rules per-campaign + admin curate
[Niche view + Product public]       ← presentation: branding, SEO, niche grouping
     ↓ HITL approve (ProductExtraction.PENDING_REVIEW → PUBLISHED)
[Storefront]                        ← what the user sees
```

Implementation consequences:
- **Crawler is a per-campaign loop**: it pulls only from `Campaign`s with `status=APPROVED` + ≥1 `CampaignNiche` assignment + `atCampaignId`. Onboarding a new niche = approve the campaign in the AT dashboard + 2 clicks in `/admin/campaigns` (pick campaign + assign niche). No seed/code changes needed.
- **`Niche` N:N `Campaign`** (via `CampaignNiche`): one niche can gather many campaigns from many merchants — cross-merchant price comparison within a niche.
- **`Niche.schemaConfig`** is the dynamic per-niche spec (the HITL extractor maps into it).
- **Filter rules per merchant**: `Campaign.filterRules` (JSON) holds `minDiscountPercent`, `domains[]`, `priceMin/Max` — there is no global env threshold.
- **Revenue ground-truth**: real-time webhook + reconciler polling `/v1/order-list` every 30 min. The reconciler doesn't replace the webhook; it's a backup that verifies totals match the AT dashboard.
- **Coupons are a parallel pipeline**: `CouponSyncService` pulls `/v1/offers_informations/coupon` every 6h → DB → admin approves (separate `isActive` HITL gate) → `/khuyen-mai/<merchant>` public.
- **Top products are a snapshot cache**: pull `/v1/top_products` every 3am → render the homepage "🔥 Đang hot tuần này" section. Clicks go straight to the AT `affLink` (rel=nofollow sponsored), not through internal ClickLog.

Cross-app invariants are unchanged: the trackingCode contract, admin shared-secret header, the HITL gate for everything reaching the storefront, and the per-niche dynamic schema.

## Domain glossary

Used both in code identifiers and in Vietnamese UI copy:

- **Refinery** — admin queue of `ProductExtraction` rows in `PENDING_REVIEW`.
- **Prompt Studio** — CRUD + activation history for `PromptTemplate` rows. Exactly one is `isActive` at a time per `name`. Used by the AI extractor (`default-parser`), article authoring (`article-buying-guide`, `article-review`), and the Tool module (`tool.parseUserInput`, `tool.generateReasoning`).
- **Money Trail** — join view of `ClickLog` → `ConversionWebhook` for revenue reconciliation. `ConversionWebhook.source` ∈ `webhook | api-reconcile | both` shows which channel the data came from.
- **Reconciliation** — `ReconciliationService` polls AT `/v1/order-list` every 30 min, updates `ConversionWebhook.atOrderId/atCommission` and writes `reconcileNotes` if webhook revenue diverges from AT's pub_commission. Logs in `/admin/reconciliation`.
- **Coupon hub** — `/admin/coupons` manages codes (manual + AT sync); public `/khuyen-mai/<merchant>` shows approved + unexpired coupons.
- **Top products** — `TopProductSnapshot` daily; homepage "🔥 Đang hot tuần này" renders the latest snapshot.
- **War Room** — KPI dashboard (monthly revenue, conversion rate, token spend, crawler health).
- **Deal hot** — products auto-ranked by `% giảm` (discount %), freshness, and data completeness.
- **Tool** — interactive AI quiz/scoring tool (`Tool` + `QuizSession`): the user answers a few questions and the AI recommends the best-fit products with reasoning, then a tracked "Xem deal" CTA.
- **Network** — the affiliate platform string on `Product.network` (currently `ACCESSTRADE`).
- **Bài viết / Blog** — `Article` rows authored by the AI pipeline, reviewed by admin in `/admin/articles`, published to `/blog` and `/blog/[slug]`. Two types: `BUYING_GUIDE` and `REVIEW`.
