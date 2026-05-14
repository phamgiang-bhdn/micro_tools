# Business context — dealvault

Read this when working on anything user-facing, admin tooling, or AI extraction. For purely infra/build/devops tasks, the root `CLAUDE.md` alone is enough.

## What dealvault is

A Vietnam-market affiliate micro-tool platform. Revenue model: every user click on a product card becomes a tracked outbound click to an affiliate network (Accesstrade is default — see `Product.network`); if it converts, the network posts a webhook back with revenue.

**Everything in the architecture exists to either (a) drive more qualified clicks or (b) prove which clicks earned revenue.** When evaluating a feature proposal, that's the lens.

## Strategy: "one micro-tool = one niche"

The product is *not* a general catalog. Each `Tool` is a single deeply-comparable category with its own `schemaConfig` of category-specific spec fields. Narrow focus is the conversion thesis.

When you're tempted to add cross-tool generic features (a global search, a one-size-fits-all product card), check the per-tool angle first — it's usually the wrong instinct here.

## v1 launch scope

Currently only two tools are seeded and live (see `apps/api/prisma/seed.js`):
- `robot-hut-bui-lau-nha` — Robot hút bụi / lau nhà
- `may-loc-khong-khi` — Máy lọc không khí

Don't reintroduce or assume the older 5-tool seed lineup. New micro-tools should follow the same pattern: a slug, a Vietnamese-language `name`, a `schemaConfig` with the 5–10 spec fields that *actually* differentiate buying decisions in that niche, and 3–5 seeded products covering the price range.

## Three audiences, three surfaces

- **End user** — public storefront (RSC + ISR). Comes from SEO / Google. Conversion target: click "Xem deal". Vietnamese copy, VND prices, store badges (Lazada Mall / Shopee Mall / Tiki Trading / Điện Máy Xanh).
- **Operator / admin** — Next `/admin` pages + Nest `/api/v1/admin/*`. Runs the Refinery, Prompt Studio, Money Trail, War Room.
- **Affiliate network** — webhook caller. Posts to `/api/v1/webhooks/conversion` with `{ trackingCode, revenue, status, payload }`. Treat this endpoint as a stable external contract.

## Why human-in-the-loop is non-negotiable

This is not paranoia about AI quality — it's **affiliate-compliance and brand-trust**. A wrong price or fake voucher harms partner relationships and SEO trust signals.

The `PENDING_REVIEW` gate exists so a human always sees AI output before it reaches the public storefront. **Don't propose "auto-publish if confidence > X" shortcuts unless explicitly asked.**

## SEO is a primary growth channel

ISR (`revalidate: 300`), per-product JSON-LD (`Product` / `Offer` / `AggregateRating`), DB-driven `sitemap.xml`, and Vietnamese semantic slugs are load-bearing — not decoration. Changes that affect crawlability, canonical URLs, or structured-data emission are higher-risk than they look.

## Content strategy: AI-authored, human-reviewed blog

A pure product-comparison site can't out-rank Tiki/Shopee/Lazada on commercial queries — domain authority gap is unwinnable. **Affiliate sites win via informational content**: buying guides, reviews, comparisons. The blog (`/blog`) exists to capture top-funnel SEO traffic ("cách chọn xxx", "review xxx", "xxx có tốt không") and funnel readers into the product comparison surface.

- **AI authoring** — `/admin/articles/new` triggers Gemini with the active `PromptTemplate` for the chosen `ArticleType` (`BUYING_GUIDE` or `REVIEW`). Prompts tell AI to write *as if it had used the product*, include sensory detail (noise dB, sạc đầy bao lâu, etc.), and always include both pros AND cons. AI must never disclaim being AI.
- **Human review is mandatory** — same HITL gate as Refinery. `Article.status` flows `DRAFT → PUBLISHED` only after admin clicks Publish in `/admin/articles/[id]`. Don't propose "auto-publish if confidence > X" — Google's Helpful Content Update penalizes pure unreviewed AI content.
- **Tone & guardrails** — prompts forbid emoji, forbid "tốt nhất thế giới"-style hyperbole, enforce 800–1800 words, require explicit weaknesses. Admin's job is to spot hallucinated facts (wrong prices, made-up specs), tighten language, and approve.
- **Product cross-links** — `Article.productIds[]` is hand-picked at generation time. Cuối article tự render `ProductCard` với CTA "Xem deal" → tái dùng tracking flow. This is how blog converts to clicks.

## Domain glossary

Used both in code identifiers and in Vietnamese UI copy:

- **Refinery** — admin queue of `ProductExtraction` rows in `PENDING_REVIEW`.
- **Prompt Studio** — CRUD + activation history for `PromptTemplate` rows. Exactly one is `isActive` at a time per `name`. Used by both AI extractor (`default-parser`) and article authoring (`article-buying-guide`, `article-review`).
- **Money Trail** — join view of `ClickLog` → `ConversionWebhook` for revenue reconciliation.
- **War Room** — KPI dashboard (monthly revenue, conversion rate, token spend, crawler health).
- **Deal hot** — products auto-ranked by `% giảm` (discount %), freshness, and data completeness.
- **Network** — the affiliate platform string on `Product.network` (currently `ACCESSTRADE`).
- **Bài viết / Blog** — `Article` rows authored by Gemini, reviewed by admin in `/admin/articles`, published to `/blog` and `/blog/[slug]`. Two types: `BUYING_GUIDE` (cẩm nang chọn mua) and `REVIEW` (review chi tiết).
