<div align="center">

# dealvault

**Affiliate micro-tool platform cho thị trường Việt Nam**

_Crawl • Extract • Compare • Track — mỗi micro-tool một ngách, càng chuyên càng dễ chuyển đổi._

<br />

[![Next.js 15](https://img.shields.io/badge/Next.js-15-000?logo=next.js&logoColor=fff)](https://nextjs.org)
[![NestJS 10](https://img.shields.io/badge/NestJS-10-ea2845?logo=nestjs&logoColor=fff)](https://nestjs.com)
[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=fff)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=fff)](https://prisma.io)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=fff)](https://postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=fff)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Điểm khác biệt](#-điểm-khác-biệt)
- [Kiến trúc](#-kiến-trúc)
- [Tech stack](#-tech-stack)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Bắt đầu nhanh](#-bắt-đầu-nhanh)
- [NPM scripts](#-npm-scripts)
- [Biến môi trường](#-biến-môi-trường)
- [Mô hình dữ liệu](#-mô-hình-dữ-liệu)
- [Luồng dữ liệu](#-luồng-dữ-liệu)
- [Admin panel](#-admin-panel)
- [Tích hợp Accesstrade](#-tích-hợp-accesstrade)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Đóng góp](#-đóng-góp)

---

## ✨ Giới thiệu

**dealvault** không phải một site tổng hợp affiliate kiểu cũ. Nó là một nền tảng *micro-tool* — mỗi tool gắn với một ngách cụ thể (robot hút bụi, máy lọc không khí, máy lọc nước…), so sánh sâu trên những trường dữ liệu mà người mua thật sự quan tâm.

> **Mỗi micro-tool = 1 ngách = 1 trang so sánh chuyên sâu.**
> Càng chuyên, traffic càng đúng intent → conversion càng cao.

Hệ thống tự crawl offer từ Accesstrade (Shopee / Lazada / Tiki / TikTok Shop... qua publisher account), dùng LLM để bóc các trường dữ liệu theo schema riêng của từng ngách, **bắt buộc qua duyệt thủ công (human-in-the-loop)** trước khi xuất bản. Lớp **AI deal-intelligence** (giá real-time + tool tư vấn tương tác) là moat. Mọi cú click ra link đối tác đều có `trackingCode` 32 ký tự duy nhất → đối soát qua webhook conversion + reconciler `/order-list` chạy mỗi 30 phút.

> 📖 Đọc [`docs/CONTEXT.md`](docs/CONTEXT.md) để hiểu strategy, business context và lý do tồn tại của HITL gate.

---

## 🚀 Điểm khác biệt

### Cho người dùng cuối

| | |
| --- | --- |
| 🏷️ **So sánh sâu theo ngách** | Mỗi ngách có schema riêng — robot hút bụi so sánh `suctionPower`, `batteryMinutes`, `mopFunction`; máy lọc nước so sánh `filterStages`, `capacityLph`. Không phải bảng giá rập khuôn. |
| 🔥 **Top tuần này** | Section homepage render snapshot `/top_products` Accesstrade pull mỗi 3h sáng — deal đang chạy thật, không phải hardcode. |
| 📝 **Bài viết AI có người duyệt** | Buying guide & review viết bằng AI nhưng có admin review từng đoạn trước khi publish — đọc tại `/blog`. |
| 🎟️ **Voucher tổng hợp** | Coupon sync từ Accesstrade mỗi 6h tại `/khuyen-mai/<merchant>`. Mã đã sanitize, click ra có tracking. |
| 🔗 **Click có tracking thật** | Server action sinh `trackingCode` → ghi `ClickLog` → append `utm_source` → `redirect()` qua URL đối tác. Không phải `<a target=_blank>` rỗng. |
| 🧾 **SEO-ready** | `generateMetadata` động, JSON-LD `Product` / `Offer` / `AggregateRating` / `Article`, ISR `revalidate: 300`, sitemap.xml + robots.txt sinh từ DB. |

### Cho operator / admin

| | |
| --- | --- |
| 🤖 **AI extract pipeline** | Gemini bóc HTML/text → JSON theo `schemaConfig` từng ngách. Retry-on-rate-limit built-in (3 lần, backoff 15s/30s/45s). |
| 👀 **Refinery** | Mọi kết quả AI mặc định `PENDING_REVIEW` — phải duyệt mới sang `PUBLISHED`. Không có path nào bypass. |
| 📰 **Article pipeline** | Multi-stage AI generation (research → outline → draft → polish) với live progress streaming lên UI. Trạng thái `DRAFT → PUBLISHED → ARCHIVED`. |
| 🧪 **Prompt Studio** | Versioned `PromptTemplate` trong DB; bật/tắt nhanh, rollback, test sandbox. |
| 💰 **Money Trail** | Đối soát click → conversion webhook → reconciler `/order-list` → doanh thu thật. Mismatch tự ghi `reconcileNotes` cho admin xử lý. |
| 📈 **War Room** | KPI realtime: revenue tháng, conversion rate, token budget, crawler health, cron status. |
| 🎯 **Per-campaign filters** | `filterRules` (price range, discount %, status, domain) đẩy thẳng xuống Accesstrade datafeeds query — chỉ kéo về data đúng tiêu chí. |

### Cho hệ thống

- ⚡ **ISR 5 phút** trên trang public — nhanh cho user, thân thiện crawler.
- 🛡️ **Admin auth shared-secret** (`x-admin-role` + `x-admin-key`) — không cần session, hai app share key. Endpoint admin bị `robots.txt` chặn index.
- 🐳 **Docker compose** kèm Postgres 16 + pgAdmin — `npm run bootstrap` chạy là xong.
- ⏰ **Cron-driven**: crawler-cycle (6h), top-products (3h sáng), coupon-sync (6h), reconciliation (30 phút) — toàn bộ env-gated, disable được riêng.
- 🧼 **HTML sanitize** ở DB ingestion side (coupon AT có thể chứa `<script>`) — render side đã sạch, không sanitize ngược chiều.

---

## 🏗 Kiến trúc

```
                    ┌─────────────────────────┐
                    │   Accesstrade API       │
                    │  /campaigns /datafeeds  │
                    │  /top_products          │
                    │  /coupons /order-list   │
                    └────────────┬────────────┘
                                 │  cron-driven pull
                                 ▼
       ┌──────────────────────────────────────────────────┐
       │              NestJS API (port 4000)              │
       │  ┌────────────────────────────────────────────┐  │
       │  │ Crawler     → CampaignSync, DatafeedCycle  │  │
       │  │             → CouponSync, TopProductsSync  │  │
       │  │ AI          → parseBySchema, generateJson  │  │
       │  │ Refinery    → HITL gate cho Product        │  │
       │  │ Articles    → HITL gate cho Blog          │  │
       │  │ Reconcile   → /order-list ground-truth     │  │
       │  │ Tracking    → /tracking/click → ClickLog   │  │
       │  │ Webhooks    → /webhooks/conversion         │  │
       │  └────────────┬───────────────────────────────┘  │
       └───────────────┼──────────────────────────────────┘
                       │ Prisma
                       ▼
                ┌──────────────┐
                │  PostgreSQL  │
                └──────┬───────┘
                       │
       ┌───────────────┴──────────────────────────────────┐
       ▼                                                  ▼
┌──────────────────┐         server action        ┌──────────────────┐
│  Next.js public  │ ──── createTrackingRedirect ─►  Affiliate URL  │
│  /categories     │      (sinh trackingCode +    │                  │
│  /blog           │       utm_source, redirect)  │ (Shopee, Lazada, │
│  /khuyen-mai     │                              │  Tiki, TikTok…)  │
│  ISR + JSON-LD   │                              └──────────────────┘
└──────────────────┘
        ▲
        │  shared lib/, components/
        ▼
┌──────────────────┐
│   /admin panel   │
│  Refinery        │   header-auth (x-admin-role + x-admin-key)
│  Prompt Studio   │   robots.txt blocked
│  Money Trail     │
│  War Room        │
└──────────────────┘
```

---

## 🧰 Tech stack

| Tầng | Công nghệ |
| --- | --- |
| **Frontend** | Next.js 15 (App Router · RSC · Server Actions) · React 19 · TypeScript 5 · Tailwind CSS · Radix Primitives · react-markdown |
| **Backend** | NestJS 10 · TypeScript 5 · class-validator · zod (admin endpoints) · Prisma ORM |
| **Database** | PostgreSQL 16 (JSONB cho `scrapedData`, `aiOutput`, `schemaConfig`, `filterRules`, `atRawData`) |
| **AI** | Google Gemini API (default `gemini-2.0-flash`) · OpenAI-compatible provider (Deepseek…) |
| **Affiliate** | Accesstrade (active network) · Web-scrape fallback (Playwright + Gemini) for arbitrary URLs |
| **Infra** | Docker Compose · pgAdmin · npm workspaces · Cron-based schedulers (NestJS `@nestjs/schedule`) |

---

## 📂 Cấu trúc dự án

```
micro_tools/
├── apps/
│   ├── api/                              # NestJS backend (port 4000)
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # Niche, Product, Article, Campaign, Coupon, Tool, ClickLog…
│   │   │   ├── migrations/               # Single baseline migration (pre-release squash)
│   │   │   └── seed.js                   # ~100 niches (1 launch-active) + system PromptTemplates (KHÔNG seed product)
│   │   └── src/
│   │       ├── main.ts                   # bootstrap, prefix /api/v1, global ValidationPipe
│   │       ├── modules/
│   │       │   ├── admin/                # Refinery, Prompt Studio, Money Trail, War Room
│   │       │   ├── article-pipeline/     # Article multi-stage generation + streaming
│   │       │   ├── articles/             # Public GET /articles, /articles/:slug
│   │       │   ├── coupons/              # Public GET /coupons
│   │       │   ├── crawler/              # AT clients, CampaignSync, CouponSync, TopProductsSync
│   │       │   ├── niches/               # Public GET /niches, /niches/:slug
│   │       │   ├── reconciliation/       # /v1/order-list ground-truth poller
│   │       │   ├── top-products/         # Public GET /top-products
│   │       │   ├── tracking/             # POST /tracking/click → ClickLog
│   │       │   └── webhooks/             # POST /webhooks/conversion → ConversionWebhook
│   │       ├── prisma/                   # PrismaService singleton
│   │       ├── services/                 # AiService, ArticleService, ScraperService
│   │       └── common/                   # sanitize-html, helpers
│   │
│   └── web/                              # Next.js 15 storefront + admin (port 3100)
│       ├── app/
│       │   ├── page.tsx                  # Hero · niche grid · top-products
│       │   ├── layout.tsx · sitemap.ts · robots.ts
│       │   ├── categories/[slug]/        # Niche page (URL legacy giữ /categories cho SEO)
│       │   │   └── [productSlug]/        # Product detail · JSON-LD Product/Offer/AggregateRating
│       │   ├── blog/                     # Blog list (?type, ?category)
│       │   │   └── [slug]/               # Blog detail · JSON-LD Article
│       │   ├── khuyen-mai/[merchantSlug]/# Coupon page per merchant
│       │   ├── actions/tracking.ts       # createTrackingRedirect() — KHÔNG REFACTOR
│       │   ├── api/                      # Route handlers (proxy/streaming)
│       │   └── admin/                    # Refinery · Articles · Campaigns · Coupons · …
│       │       ├── actions.ts            # adminFetch + post() helpers (header injection)
│       │       └── preview/[extractionId]/
│       ├── components/                   # hero · product-card · navbar · ui/ (Radix atoms)
│       └── lib/
│           ├── api.ts                    # Server fetch wrapper
│           ├── format.ts                 # formatMoney + normalizeProduct (SAFE READ scrapedData)
│           ├── admin/constants.ts        # Magic strings tập trung
│           └── types.ts                  # NicheItem, ProductItem, ProductView
│
├── docs/
│   ├── CONTEXT.md                        # Business context + product direction + lý do HITL
│   └── integrations/accesstrade.md       # AT API reference + gotchas
├── scripts/                              # Banner-coloured CLI helpers
├── docker-compose.yml                    # Postgres 16 + pgAdmin
└── package.json                          # Workspaces (apps/web + apps/api)
```

---

## ⚡ Bắt đầu nhanh

### Yêu cầu

- **Node.js ≥ 20**
- **Docker Desktop** (cho Postgres)
- **Gemini API key** — chỉ cần khi muốn dùng AI extract / blog AI (có thể skip nếu chỉ xem storefront)
- **Accesstrade access token** — chỉ cần khi muốn crawl thật (có thể skip lần đầu)

### Cài đặt 1 dòng

```bash
git clone https://github.com/phamgiang-bhdn/micro_tools.git
cd micro_tools
npm install
npm run bootstrap
```

`npm run bootstrap` tự động:

1. ✅ Copy `apps/api/.env.example` → `.env` và `apps/web/.env.example` → `.env` (nếu chưa có)
2. ✅ `docker compose up -d` — Postgres 16 + pgAdmin
3. ✅ `prisma migrate deploy` — áp toàn bộ migration
4. ✅ Seed **~100 niches** (chỉ niche launch là `ACTIVE`) + system `PromptTemplate` + sample Tool + authors (KHÔNG seed product — product đến từ crawler)

### Chạy dev

```bash
npm run dev
```

Script `scripts/dev.mjs` tự kiểm tra deps + env, khởi động Docker nếu cần, rồi chạy **cả API (4000) và Web (3100) song song**.

> 💡 Muốn chạy riêng: `npm run dev:api` hoặc `npm run dev:web`.
> 💡 Port bị chiếm? `npm run kill:all` (kill 4000 + 3100).

### Mở app

| | |
| --- | --- |
| 🛍️ Public storefront | http://localhost:3100 |
| 🛠️ Admin panel | http://localhost:3100/admin |
| 📡 API base | http://localhost:4000/api/v1 |
| 🐘 pgAdmin | http://localhost:5050 |

### Có dữ liệu thật

Storefront vừa cài xong sẽ trống (chỉ có niche launch active, không có product). Để có data:

1. Vào `/admin/campaigns` → bấm **"Sync from Accesstrade"** (cần `ACCESSTRADE_ACCESS_TOKEN` trong `apps/api/.env`).
2. Gán campaign vào Niche, set `filterRules` (price range / min discount).
3. Chạy `POST /api/v1/admin/crawler/run` từ admin, hoặc đợi cron `0 */6 * * *`.
4. Vào `/admin` (Refinery tab) duyệt extraction từ `PENDING_REVIEW` → `PUBLISHED`.
5. Product sẽ xuất hiện ở `/categories/<slug>`.

---

## 🛠 NPM scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run help` | In bảng mô tả tất cả lệnh kèm banner màu |
| `npm run bootstrap` | `env:init` + `setup` — setup máy dev từ 0 |
| `npm run setup` | `docker:up` + `db:deploy` + seed |
| `npm run dev` | Khởi động cả API + Web (auto-check env, deps, docker) |
| `npm run dev:api` / `dev:web` | Chạy riêng từng workspace |
| `npm run kill:api` / `kill:web` / `kill:all` | Kill process giữ port (fix EADDRINUSE) |
| `npm run docker:up` / `docker:down` | Bật / tắt Postgres + pgAdmin |
| `npm run db:deploy` | Áp migration đã có + regen Prisma Client (sau `git pull`) |
| `npm run db:migrate -- --name xxx` | Tạo migration mới từ schema diff + apply (dev) |
| `npm run db:reset` | Drop DB → apply lại tất cả migration → seed (**không bao giờ chạy prod**) |
| `npm run prisma:studio --workspace api` | Mở Prisma Studio GUI |
| `npm run build` | Build production (web rồi api) |
| `npm run lint:web` | ESLint cho web |
| `npm run test:api` | Jest cho api |

---

## 🔐 Biến môi trường

Hai file `.env` riêng (`apps/api/.env` và `apps/web/.env`) — đều có `.env.example` sibling, `npm run env:init` copy nếu thiếu. **`ADMIN_API_KEY` phải trùng giữa hai file.**

### `apps/api/.env`

| Tên | Mô tả | Bắt buộc |
| --- | --- | :---: |
| `DATABASE_URL` | Postgres connection string | ✅ |
| `PORT` | Cổng API (default `4000`) | — |
| `ADMIN_API_KEY` | Shared secret với web app | ✅ |
| `AI_PROVIDER` | `gemini` \| `openai-compatible` | — |
| `GEMINI_API_KEY` | Khi `AI_PROVIDER=gemini` | ✅ (cho AI) |
| `GEMINI_MODEL` | Default `gemini-2.0-flash` | — |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | Khi `AI_PROVIDER=openai-compatible` (vd Deepseek) | — |
| `ACCESSTRADE_ACCESS_TOKEN` | Token AT publisher | ✅ (cho crawl) |
| `TAVILY_API_KEY` | Search API cho Article research stage | — |
| `UNSPLASH_ACCESS_KEY` | Hero image cho blog | — |
| `CRAWLER_ENABLED` / `CRAWLER_CRON` / `CRAWLER_AI_ENRICH` | Crawler-cycle controls (per-campaign discount threshold lives in `Campaign.filterRules`, not env) | — |
| `COUPON_SYNC_ENABLED` / `COUPON_SYNC_CRON` | `/v1/offers_informations/coupon` poller | — |
| `TOP_PRODUCTS_ENABLED` / `TOP_PRODUCTS_CRON` | `/v1/top_products` daily snapshot | — |
| `RECONCILE_ENABLED` / `RECONCILE_CRON` | `/v1/order-list` ground-truth poller | — |

### `apps/web/.env`

| Tên | Mô tả | Bắt buộc |
| --- | --- | :---: |
| `PORT` | Cổng Next.js (default `3100`) | — |
| `API_BASE_URL` | URL API backend (vd `http://localhost:4000/api/v1`) | ✅ |
| `ADMIN_ROLE` | `viewer` \| `reviewer` \| `admin` | — |
| `ADMIN_API_KEY` | **Phải trùng** với api/.env | ✅ |
| `SITE_URL` | URL công khai (sitemap, OG, canonical) | ✅ ở prod |

> ⚠️ `.env` đã `.gitignore`. Chỉ commit `.env.example`.

---

## 🗃 Mô hình dữ liệu

Schema rút gọn (xem full ở [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma)):

```prisma
// Presentation layer (admin định nghĩa, SEO-facing)
Niche            (id, slug 🔑, name, status, schemaConfig: Json)
 └─ Product      (id, nicheId →, campaignId →?, name, slug, affiliateUrl,
                   scrapedData: JsonB, network)
     ├─ ProductExtraction (rawContent, aiOutput,
     │                     status: DRAFT_RAW | PENDING_REVIEW | PUBLISHED | ERROR)
     ├─ ClickLog          (trackingCode 🔑, ipHash, userAgent, createdAt)
     │   └─ ConversionWebhook (trackingCode →, revenue, status,
     │                         atOrderId, source, reconcileNotes, payload)
     └─ ProductReview     (rating, content, ...)

// Upstream layer (Accesstrade source-of-truth)
Campaign         (id, atCampaignId 🔑, network, merchantName,
                   status: APPLIED|APPROVED|PAUSED|REJECTED|INACTIVE,
                   filterRules: Json, atRawData: Json, ...)
 └─ CampaignNiche  (M:N campaign ↔ niche, có filterRules + priority per pair)

// Catalog mới (sync từ AT)
Coupon           (atCouponId 🔑, merchantSlug, contentHtml, expiresAt, isActive)
TopProductSnapshot (snapshotDate, position, atProductId, ... — daily snapshot)
Shop · Brand · Source · Category  (taxonomy phụ trợ)

// Blog AI (HITL)
Article          (id, slug 🔑, type: BUYING_GUIDE|REVIEW,
                   status: DRAFT|PUBLISHED|ARCHIVED, productIds: String[],
                   aiModel, ...)
 ├─ ArticleSection
 ├─ ArticleEvidence
 └─ ArticleGenerationRun  (multi-stage progress cho Article)
Author           (id, name, ...)

// Hệ thống
PromptTemplate   (name 🔑, content, version, isActive, activatedAt)
CrawlerLog · ReconciliationLog  (audit trail cho cron job)
```

**Bất biến quan trọng:**

- `trackingCode` là **join key xuyên suốt** revenue attribution: click → conversion webhook → reconciler. **Không đổi format** (32 ký tự uuid không dấu gạch) — partner systems expect token đó.
- `Niche.schemaConfig` (Json) định nghĩa schema riêng cho mỗi ngách. AI extractor phải khớp; web đọc qua `normalizeProduct()` trong [`apps/web/lib/format.ts`](apps/web/lib/format.ts) — **đừng bypass**.
- `Campaign` join AT side qua `atCampaignId` (numeric, real AT id). `externalId` slug-based là legacy, chỉ giữ cho backward compat.

---

## 🔄 Luồng dữ liệu

### 1️⃣ Sync campaigns từ Accesstrade

```
Admin /admin/campaigns → "Sync from AT"
  → CampaignSyncService pull /v1/campaigns?approval=successful
  → Upsert theo atCampaignId
  → Admin-managed fields (status, notes, assignments, filterRules) KHÔNG bị đè
  → Admin gán Campaign → Niche → status auto APPROVED
```

### 2️⃣ Crawler cycle (mỗi 6h, env-gated)

```
CrawlerScheduler @Cron(CRAWLER_CRON)
  → Load tất cả CampaignNiche có Campaign.status=APPROVED + atCampaignId + merchantName
  → Per-assignment fetch /v1/datafeeds?campaign=<merchantSlug> với filterRules đẩy xuống AT
  → Sleep 500ms giữa fetch · Limit 100 offer/page
  → Normalize → ImportService → ProductExtraction.status=DRAFT_RAW
  → (Optional) AI enrich qua AiService.parseBySchema → status=PENDING_REVIEW
```

### 3️⃣ Human review (Refinery — HITL gate)

```
Admin /admin (Refinery tab)
  ├─ Approve   → Product.scrapedData = aiOutput; status = PUBLISHED  ✨ go-live
  ├─ Edit+save → chỉnh aiOutput trước khi approve
  ├─ Reject + retry → enqueue lại với active PromptTemplate mới
  └─ Reject    → status = ERROR + errorReason (admin xem ở /admin)
```

### 4️⃣ User click → affiliate redirect

```
[Người dùng bấm "Xem deal"]
  → server action createTrackingRedirect()
      ├─ randomUUID().replace(/-/g, "") → 32 ký tự trackingCode
      ├─ POST /api/v1/tracking/click → tạo ClickLog
      └─ append ?utm_source=<trackingCode> vào affiliateUrl
  → redirect() (308) sang URL đối tác
```

### 5️⃣ Đối soát doanh thu (real-time + ground-truth)

```
[A] Real-time:   Đối tác POST /webhooks/conversion {trackingCode, revenue, status}
                  → ConversionWebhook tham chiếu ClickLog (source="webhook")

[B] Ground-truth: ReconciliationService @Cron(*/30) pull /v1/order-list
                  → Match theo utm_source = trackingCode
                  → Update ConversionWebhook (source="api-reconcile" hoặc "both")
                  → Mismatch revenue > 1₫ → ghi reconcileNotes cho admin

[C] War Room dashboard: monthly revenue, conversion rate, source breakdown
```

### 6️⃣ Article (multi-stage AI authoring)

```
Admin /admin/articles/new (chọn topic, niche, productIds)
  → ArticleService.generateDraft()
      Stage 1: Research (Tavily search)
      Stage 2: Outline (Gemini)
      Stage 3: Draft (Gemini, full markdown)
      Stage 4: Polish (Gemini, fix flow)
  → Stream progress qua /api/articles/.../stream → UI live progress bar
  → status = DRAFT (chưa public)
  → Admin /admin/articles/[id] review Edit/Preview tabs
  → Publish → status = PUBLISHED → /blog/[slug] hiển thị
```

---

## 🎛 Admin panel

Tất cả nằm dưới `/admin` (header-auth bằng `x-admin-role` + `x-admin-key`, robots.txt block index).

| Trang | Vai trò tối thiểu | Chức năng |
| --- | --- | --- |
| `/admin` (Refinery) | `reviewer` | Duyệt `ProductExtraction` từ `PENDING_REVIEW` → `PUBLISHED` |
| `/admin/articles` | `reviewer` | Quản lý blog AI, Article pipeline, publish/archive |
| `/admin/campaigns` | `admin` | Sync campaign từ AT, gán Niche, tinh chỉnh `filterRules` |
| `/admin/niches` | `admin` | Tạo / chỉnh `schemaConfig` cho từng ngách |
| `/admin/products` | `reviewer` | List + edit product đã published |
| `/admin/coupons` | `reviewer` | Duyệt coupon từ AT sync (HITL: `isActive=false` mặc định) |
| `/admin/shops` · `/brands` · `/sources` | `admin` | Taxonomy phụ trợ |
| `/admin/crawler-logs` | `viewer` | Audit cron run (success/error/breakdown per-assignment) |
| `/admin/reconciliation` | `admin` | Trigger reconcile tay, xem `ReconciliationLog.unmatched` |
| `/admin/money-trail` | `viewer` | Click → conversion → revenue ledger |
| `/admin/analytics` (War Room) | `viewer` | KPI dashboard |
| `/admin/categories` (Prompt Studio nằm trong actions) | `admin` | Quản lý `PromptTemplate` versions |

> 🎨 UI convention: `ListPageShell` + `FormDialog` + `RowActions` + `lib/admin/constants.ts` cho magic strings. Không có route `/new` riêng — form mở qua dialog.

---

## 🔌 Tích hợp Accesstrade

Đây là affiliate network active duy nhất hiện tại. Toàn bộ chi tiết endpoint, auth format, rate limit, mapping vào schema xem [`docs/integrations/accesstrade.md`](docs/integrations/accesstrade.md).

| Endpoint AT | Tần suất | Service | Mục đích |
| --- | --- | --- | --- |
| `GET /v1/campaigns` | On-demand | `CampaignSyncService` | Lấy danh sách campaign đã approved cho publisher account |
| `GET /v1/datafeeds` | Cron 6h | `CrawlerService` | Pull product offer per-assignment với `filterRules` push-down |
| `GET /v1/top_products` | Cron 3h sáng | `TopProductsSyncService` | Snapshot top deal tuần (homepage section) |
| `GET /v1/offers_informations/coupon` | Cron 6h | `CouponSyncService` | Voucher per merchant (3-level: merchant → icontext → coupon) |
| `GET /v1/order-list` | Cron 30 phút | `ReconciliationService` | Ground-truth doanh thu, đối soát với webhook |
| Webhook → `/api/v1/webhooks/conversion` | Real-time | `WebhooksController` | Postback CPA/CPS từ AT |

**Rate limit AT**: cap 10 req/phút trên `/offers_informations/*` và `/order-list`. Code có sleep 7s giữa request — đừng bypass.

---

## 🚨 Troubleshooting

<details>
<summary><b>Port bị chiếm (EADDRINUSE)</b></summary>

```bash
npm run kill:all
# hoặc Windows:
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```
</details>

<details>
<summary><b>Postgres không connect được</b></summary>

```bash
# Kiểm tra Docker container có chạy không
docker compose ps
# Restart nếu cần
npm run docker:down && npm run docker:up
# Verify DATABASE_URL
cat apps/api/.env | grep DATABASE_URL
```
</details>

<details>
<summary><b>"PrismaClientInitializationError: DATABASE_URL not found"</b></summary>

File `apps/api/.env` chưa được tạo. Chạy:
```bash
npm run env:init
```
</details>

<details>
<summary><b>Seed báo lỗi không load được .env</b></summary>

Seed script đã wire `dotenv` sẵn. Nếu vẫn lỗi, chạy thủ công:
```bash
cd apps/api
node -r dotenv/config prisma/seed.js
```
</details>

<details>
<summary><b>AI extract trả 429 / quota</b></summary>

`AiService` đã built-in retry 3 lần (backoff 15s/30s/45s). Nếu vẫn 429:
- Check quota Gemini key
- Hoặc switch sang OpenAI-compatible provider:
  ```env
  AI_PROVIDER=openai-compatible
  AI_BASE_URL=https://api.deepseek.com
  AI_API_KEY=...
  AI_MODEL=deepseek-chat
  ```
</details>

<details>
<summary><b>Crawler không trả về sản phẩm nào</b></summary>

- `Campaign.status` phải là `APPROVED` và có `atCampaignId` + `merchantName`
- `CampaignNiche` assignment phải tồn tại
- AT `?campaign=` nhận **merchant slug** (từ `Campaign.merchantName`), KHÔNG phải `atCampaignId` — xem [gotcha #3](docs/integrations/accesstrade.md)
- Check `/admin/crawler-logs` để xem breakdown per-assignment
</details>

---

## 🗺 Roadmap

- [x] Article multi-stage pipeline với live UI progress streaming
- [x] Reconciliation `/order-list` ground-truth
- [x] Coupon sync per merchant + sanitize HTML gate
- [x] Top products daily snapshot
- [ ] Price history chart per product
- [ ] OG image động sinh bằng `next/og`
- [ ] Direct Shopee / Lazada / TikTok Shop integration (hiện đang qua AT)
- [ ] Price alert qua email / Telegram
- [ ] A/B test CTA & landing variant
- [ ] Cron health dashboard với auto-retry crawler
- [ ] Full-text search + faceted filter cross-niche

---

## 🤝 Đóng góp

Pull request rất được chào đón. Trước khi gửi:

```bash
npm run lint:web
npm run test:api
npm run build
```

**Style guide:**
- TypeScript strict, không `any`.
- RSC mặc định; chỉ `"use client"` khi cần browser API / state / event.
- Admin endpoints: zod cho validation, `authorize()` cho per-method gate.
- Public endpoints: class-validator DTO, không re-validate trong controller.
- Sau khi sửa `schema.prisma` → `npm run db:migrate -- --name <slug>`.
- Đọc CLAUDE.md ở root + apps/api + apps/web trước khi đụng pattern lớn.

---

## 📄 License

MIT © [phamgiang-bhdn](https://github.com/phamgiang-bhdn)

<div align="center">

<br />

**Built with care — for a market that deserves better than affiliate spam.**

</div>
