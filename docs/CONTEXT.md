# Business context — dealvault

Read this when working on anything user-facing, admin tooling, or AI extraction. For purely infra/build/devops tasks, the root `CLAUDE.md` alone is enough.

## What dealvault is

A Vietnam-market affiliate micro-tool platform. Revenue model: every user click on a product card becomes a tracked outbound click to an affiliate network (Accesstrade is default — see `Product.network`); if it converts, the network posts a webhook back with revenue.

**Everything in the architecture exists to either (a) drive more qualified clicks or (b) prove which clicks earned revenue.** When evaluating a feature proposal, that's the lens.

## Strategy: "one micro-tool = one niche"

The product is *not* a general catalog. Each `Category` is a single deeply-comparable niche with its own `schemaConfig` of category-specific spec fields. Narrow focus is the conversion thesis.

When you're tempted to add cross-category generic features (a global search, a one-size-fits-all product card), check the per-category angle first — it's usually the wrong instinct here.

> Naming note: the platform is *positioned* as a "micro-tool" platform (marketing copy / strategy framing), but in the codebase the entity is called `Category`. The name `Tool` is reserved for future interactive utilities (price calculators, comparators) that haven't shipped yet.

## Category lineup (v2)

Categories are seeded in `apps/api/prisma/seed.js` — 12 niches covering the highest-volume affiliate verticals in VN:

| Group | Slugs |
|---|---|
| Smart home / small appliances | `robot-hut-bui-lau-nha`, `may-loc-khong-khi`, `may-loc-nuoc`, `noi-chien-khong-dau` |
| Large appliances | `may-giat`, `tu-lanh`, `dieu-hoa` |
| Consumer electronics | `tivi`, `laptop`, `tai-nghe-tws`, `dong-ho-thong-minh` |
| Beauty | `my-pham-duong-da` |

**Products are NOT seeded** — they flow into the DB exclusively via the Accesstrade crawler after admins onboard a campaign (assign campaign → niche, set `filterRules`). The seed only creates Category rows + system `PromptTemplate` rows.

When adding a new niche: a Vietnamese-no-dấu slug, a Vietnamese `name`, and a `schemaConfig` listing the 5–10 spec fields that *actually* differentiate buying decisions in that niche (AI extractor uses this to know what to pull out of merchant pages).

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

## Data flow — Accesstrade là upstream, Category là view

Sau sprint at-source-of-truth (2026-05), mental model dữ liệu chuẩn là:

```
[Accesstrade]                       ← pool data thô; ta không control structure
     ↓ sync (auto cron + admin manual button)
[Campaign + Product raw]            ← mirror trong DB, 1-1 với AT (Campaign.atCampaignId)
     ↓ filter rules per-campaign + admin curate
[Category view + Product public]    ← presentation: branding, SEO, niche grouping
     ↓ HITL approve (ProductExtraction.PENDING_REVIEW → PUBLISHED)
[Storefront]                        ← user thấy
```

Hệ quả implementation:
- **Crawler là per-campaign loop**: chỉ pull từ những `Campaign` có `status=APPROVED` + `categoryId` + `atCampaignId`. Onboard niche mới = approve campaign trong AT dashboard + 2 click trong `/admin/campaigns` (chọn campaign + assign category). KHÔNG cần đụng seed/code.
- **`Category` 1:N `Campaign`**: 1 niche có thể gom nhiều campaign từ nhiều merchant — so sánh giá cross-merchant trong cùng niche.
- **`Category.schemaConfig`** vẫn là spec dynamic per niche (HITL extractor map vào đó).
- **Filter rules per merchant**: `Campaign.filterRules` (JSON) chứa `minDiscountPercent`, `domains[]`, `priceMin/Max` — KHÔNG còn env global.
- **Revenue ground-truth**: webhook real-time + reconciler poll `/v1/order-list` mỗi 30 phút. Reconciler không thay webhook, là backup verify total khớp AT dashboard.
- **Coupon là pipeline song song**: `CouponSyncService` pull `/v1/offers_informations/coupon` mỗi 6h → DB → admin duyệt (HITL gate riêng `isActive`) → `/khuyen-mai/<merchant>` public.
- **Top products là snapshot cache**: pull `/v1/top_products` mỗi 3h sáng → render homepage section "🔥 Đang hot tuần này". Click thẳng AT `affLink` (rel=nofollow sponsored), KHÔNG qua ClickLog nội bộ.

Cross-app invariants không đổi: trackingCode contract, admin shared-secret header, HITL gate cho mọi data ra storefront, schema per-category dynamic.

## Domain glossary

Used both in code identifiers and in Vietnamese UI copy:

- **Refinery** — admin queue of `ProductExtraction` rows in `PENDING_REVIEW`.
- **Prompt Studio** — CRUD + activation history for `PromptTemplate` rows. Exactly one is `isActive` at a time per `name`. Used by both AI extractor (`default-parser`) and article authoring (`article-buying-guide`, `article-review`).
- **Money Trail** — join view of `ClickLog` → `ConversionWebhook` for revenue reconciliation. `ConversionWebhook.source` ∈ `webhook|api-reconcile|both` cho thấy data đến từ kênh nào.
- **Reconciliation** — `ReconciliationService` poll AT `/v1/order-list` mỗi 30 phút, update `ConversionWebhook.atOrderId/atCommission` và ghi `reconcileNotes` nếu revenue webhook lệch pub_commission AT. Logs ở `/admin/reconciliation`.
- **Coupon hub** — `/admin/coupons` quản lý mã (manual + AT sync), public `/khuyen-mai/<merchant>` hiển thị coupon đã duyệt + còn hạn.
- **Top products** — `TopProductSnapshot` daily; homepage section "🔥 Đang hot tuần này" render snapshot mới nhất.
- **War Room** — KPI dashboard (monthly revenue, conversion rate, token spend, crawler health).
- **Deal hot** — products auto-ranked by `% giảm` (discount %), freshness, and data completeness.
- **Network** — the affiliate platform string on `Product.network` (currently `ACCESSTRADE`).
- **Bài viết / Blog** — `Article` rows authored by Gemini, reviewed by admin in `/admin/articles`, published to `/blog` and `/blog/[slug]`. Two types: `BUYING_GUIDE` (cẩm nang chọn mua) and `REVIEW` (review chi tiết).
