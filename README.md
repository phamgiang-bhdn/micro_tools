<div align="center">

# dealvault

**Affiliate micro-tool platform — Crawl. Extract. Compare. Track.**

So sánh ưu đãi affiliate đa nguồn, trích dữ liệu sản phẩm bằng AI (human-in-the-loop) và đo conversion theo từng cú click.

[![Next.js 15](https://img.shields.io/badge/Next.js-15-000?logo=next.js&logoColor=fff)](https://nextjs.org)
[![NestJS 10](https://img.shields.io/badge/NestJS-10-ea2845?logo=nestjs&logoColor=fff)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=fff)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=fff)](https://postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=fff)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng chính](#-tính-năng-chính)
- [Kiến trúc](#-kiến-trúc)
- [Tech stack](#-tech-stack)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Bắt đầu nhanh](#-bắt-đầu-nhanh)
- [Troubleshooting](#-troubleshooting)
- [Biến môi trường](#-biến-môi-trường)
- [NPM scripts](#-npm-scripts)
- [Mô hình dữ liệu](#-mô-hình-dữ-liệu)
- [Luồng hoạt động](#-luồng-hoạt-động)
- [Roadmap](#-roadmap)
- [Đóng góp](#-đóng-góp)

---

## ✨ Giới thiệu

**dealvault** là một nền tảng *micro-tool* affiliate được thiết kế theo hướng:

> Mỗi micro-tool tập trung 1 ngách — càng chuyên, càng dễ chuyển đổi.

Hệ thống crawl offer từ nhiều mạng affiliate (Accesstrade, Shopee, Tiki…), trích các trường dữ liệu quan trọng (giá, voucher, điểm thưởng, điều kiện…) bằng LLM với schema linh hoạt, **bắt buộc qua một bước duyệt thủ công** trước khi xuất bản. Click ra link affiliate luôn được sinh `trackingCode` duy nhất và đối soát qua webhook conversion.

> Không phải link tổng hợp tay. Không phải clone WordPress. Đây là một sản phẩm engineering có production-mindset: ISR cho SEO, server actions cho redirect tracking, JSON-LD schema.org cho từng sản phẩm, separation rõ giữa data crawler — AI parser — review queue — public storefront.

---

## 🚀 Tính năng chính

### Cho người dùng cuối
- 🏷️ **So sánh đa nguồn** — mỗi micro-tool gom nhiều đối tác về một bảng so sánh duy nhất.
- 🔥 **Deal hot** — tự động xếp hạng theo `% giảm`, độ tươi, chất lượng dữ liệu.
- 🧾 **Trang sản phẩm SEO-ready** — `generateMetadata` động + JSON-LD `Product` / `Offer` / `AggregateRating` cho mỗi item.
- 🔗 **Affiliate redirect có tracking** — server action sinh code duy nhất trước khi `redirect()` sang URL đối tác, kèm `utm_source`.

### Cho operator / admin
- 🤖 **AI extract pipeline** — Gemini bóc tách raw HTML/text → JSON theo `schemaConfig` của từng tool.
- 👀 **Human-in-the-loop Refinery** — mọi kết quả AI mặc định ở trạng thái `PENDING_REVIEW`, cần duyệt mới `PUBLISHED`.
- 🧪 **Prompt Studio** — versioning prompt template, kích hoạt / rollback, test sandbox.
- 💰 **Money Trail** — bảng đối soát click → conversion webhook → doanh thu thực nhận.
- 📈 **War Room** — KPI realtime: monthly revenue, conversion rate, token budget, crawler health.

### Cho hệ thống
- ⚡ **ISR (revalidate 300s)** trên trang public — vừa nhanh, vừa thân thiện crawler.
- 🗺️ **`sitemap.xml` + `robots.txt`** sinh tự động từ database.
- 🛡️ **Admin endpoints** được bảo vệ bằng `x-admin-role` + `x-admin-key`, bị `robots.txt` chặn index.
- 🐳 **Docker compose** kèm Postgres + pgAdmin — `npm run setup` chạy là xong.

---

## 🏗 Kiến trúc

```
            ┌──────────────┐                  ┌────────────────┐
            │   Crawler    │   raw content    │  AI Extractor  │
            │  (cron job)  │ ───────────────► │  (Gemini API)  │
            └──────────────┘                  └────────┬───────┘
                                                       │ JSON theo
                                                       │ schemaConfig
                                                       ▼
   ┌────────────┐   webhook    ┌───────────────────────────────────┐
   │ Affiliate  │ ───────────► │           NestJS API              │
   │  network   │              │  /tools  /tracking  /webhooks     │
   │ (CPS/CPA)  │              │  /admin/refinery /prompts /money  │
   └────────────┘              └──────────────┬────────────────────┘
                                              │ Prisma
                                              ▼
                                       ┌─────────────┐
                                       │ PostgreSQL  │
                                       └──────┬──────┘
                                              │
                ┌─────────────────────────────┴─────────────────────────────┐
                ▼                                                           ▼
       ┌──────────────────┐                                       ┌──────────────────┐
       │ Next.js public   │  ◄──── server action `redirect` ────► │ Affiliate target │
       │  (ISR + SEO)     │       (sinh trackingCode + utm)       │     website      │
       └──────────────────┘                                       └──────────────────┘
                ▲
                │
       ┌────────┴────────┐
       │   Admin panel   │
       │ (refinery / KPI │
       │  / prompt lab)  │
       └─────────────────┘
```

---

## 🧰 Tech stack

| Tầng | Công nghệ |
| --- | --- |
| **Frontend** | Next.js 15 (App Router, RSC, Server Actions) · React 19 · TypeScript · Tailwind CSS · Radix Primitives |
| **Backend** | NestJS 10 · TypeScript · class-validator · Prisma ORM |
| **Database** | PostgreSQL 16 (JSONB cho `scrapedData` / `aiOutput`) |
| **AI** | Google Gemini API (prompt template versioned trong DB) |
| **Infra** | Docker Compose · pgAdmin · npm workspaces |
| **Quan sát** | Built-in NestJS Logger, log có scope theo controller |

---

## 📂 Cấu trúc dự án

```
micro_tools/
├── apps/
│   ├── api/                       # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Category, Product, ClickLog, ConversionWebhook…
│   │   │   ├── migrations/
│   │   │   └── seed.js            # Seed 2 categories + sản phẩm demo
│   │   └── src/
│   │       ├── main.ts            # bootstrap, prefix /api/v1
│   │       ├── modules/
│   │       │   ├── categories/    # GET /categories, GET /categories/:slug
│   │       │   ├── tracking/      # POST /tracking/click
│   │       │   ├── webhooks/      # POST /webhooks/conversion
│   │       │   └── admin/         # /admin/war-room, /refinery, /prompts, /money-trail
│   │       ├── prisma/            # PrismaService singleton
│   │       └── services/
│   │
│   └── web/                       # Next.js public + admin UI
│       ├── app/
│       │   ├── page.tsx           # Hero + category grid + deal hot
│       │   ├── layout.tsx         # Metadata SEO base, OG, Twitter
│       │   ├── sitemap.ts         # /categories + product detail URLs
│       │   ├── robots.ts          # Chặn /admin
│       │   ├── not-found.tsx
│       │   ├── loading.tsx
│       │   ├── error.tsx
│       │   ├── categories/[slug]/page.tsx                # Trang category
│       │   ├── categories/[slug]/[productSlug]/page.tsx  # Chi tiết sản phẩm + JSON-LD
│       │   ├── actions/tracking.ts                       # Server action sinh trackingCode
│       │   └── admin/             # Refinery, Prompt Studio, Money Trail
│       ├── components/
│       │   ├── hero.tsx
│       │   ├── product-card.tsx
│       │   ├── navbar.tsx
│       │   ├── footer.tsx
│       │   └── ui/                # button, badge, card, breadcrumb…
│       └── lib/
│           ├── api.ts             # fetchCategories, fetchCategoryBySlug, featuredProducts
│           ├── format.ts          # formatMoney, normalizeProduct
│           └── types.ts
│
├── scripts/                       # Helpers chạy CLI có banner màu
├── docker-compose.yml             # Postgres + pgAdmin
└── package.json                   # Workspaces gốc (apps/web + apps/api)
```

---

## ⚡ Bắt đầu nhanh

### Yêu cầu
- **Node.js ≥ 20**
- **Docker Desktop** (cho Postgres)
- Một **Gemini API key** (chỉ cần khi muốn dùng AI extract)

### Cài đặt 1 dòng

```bash
git clone https://github.com/phamgiang-bhdn/micro_tools.git
cd micro_tools
npm install
npm run bootstrap
```

`npm run bootstrap` sẽ tự động:
1. Tạo `.env` từ `.env.example` nếu chưa có
2. Bật Postgres + pgAdmin (docker compose)
3. Áp Prisma migrations
4. Seed 5 micro-tools + 19 sản phẩm demo

### Chạy dev

```bash
# Terminal 1 — backend (NestJS, cổng 4000)
npm run dev:api

# Terminal 2 — frontend (Next.js, cổng 3100)
npm run dev:web
```

Mở:
- 🛍️ Public storefront → http://localhost:3100
- 🛠️ Admin panel → http://localhost:3100/admin
- 📡 API → http://localhost:4000/api/v1
-  pgAdmin → http://localhost:5050

---

## Troubleshooting

### Lỗi "EADDRINUSE: address already in use" (port bị chiếm)

Port 4000 hoặc 3100 đang có process khác sử dụng. Tìm và kill process:

**Windows:**
```powershell
# Tìm process chiếm port:
netstat -ano | findstr :4000
netstat -ano | findstr :3100

# Kill process (thay <PID> bằng số tìm được):
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Tìm và kill process:
lsof -i :4000 | awk 'NR>1 {print $2}' | xargs kill -9
```

### Lỗi seed không chạy được (không load được .env)

File `apps/api/prisma/seed.js` đã được fix để tự động load `.env`. Nếu vẫn lỗi, chạy thủ công:

```bash
cd apps/api
node -r dotenv/config prisma/seed.js
```

### Lỗi "Authentication failed" khi connect PostgreSQL

Kiểm tra lại username/password trong `DATABASE_URL`. Đảm bảo:
- PostgreSQL server đang chạy
- Database đã được tạo
- Username/password đúng

Test kết nối:
```bash
psql -U postgres -d affiliate_db -c "SELECT 1;"
```

### Lỗi "PrismaClientInitializationError: DATABASE_URL not found"

Đảm bảo file `apps/api/.env` tồn tại và có `DATABASE_URL`. Kiểm tra:

```bash
cat apps/api/.env | grep DATABASE_URL
```

### Tóm tắt các bước (copy-paste nhanh)

```bash
# 1. Clone & install
git clone https://github.com/phamgiang-bhdn/micro_tools.git
cd micro_tools
npm install

# 2. Cấu hình DATABASE_URL trong apps/api/.env
# Ví dụ: DATABASE_URL="postgresql://postgres:your_password@localhost:5432/affiliate_db?schema=public"

# 3. Generate Prisma Client
npm run db:generate

# 4. Chạy migrations
npm run db:deploy

# 5. Seed dữ liệu mẫu
npm run db:seed

# 6. Chạy dev (2 terminals)
npm run dev:api   # Terminal 1 - Backend port 4000
npm run dev:web   # Terminal 2 - Frontend port 3100

# 7. Nếu port bị chiếm, tìm và kill process:
netstat -ano | findstr :4000    # Tìm PID
netstat -ano | findstr :3100    # Tìm PID
taskkill /PID <PID> /F          # Kill process
```

---

## � Biến môi trường

### `apps/api/.env`
| Tên | Mô tả | Bắt buộc |
| --- | --- | :---: |
| `DATABASE_URL` | Postgres connection string | ✅ |
| `PORT` | Cổng API (mặc định `4000`) | — |
| `GEMINI_API_KEY` | API key cho AI extract / Prompt Studio | ✅ (cho AI) |
| `ADMIN_API_KEY` | Secret chung với frontend cho admin endpoints | ✅ |

### `apps/web/.env`
| Tên | Mô tả | Bắt buộc |
| --- | --- | :---: |
| `PORT` | Cổng Next.js (mặc định `3100`) | — |
| `API_BASE_URL` | URL API backend, vd `http://localhost:4000/api/v1` | ✅ |
| `ADMIN_ROLE` | `viewer` \| `reviewer` \| `admin` | — |
| `ADMIN_API_KEY` | Phải trùng với api `.env` | ✅ |
| `SITE_URL` | URL công khai (dùng cho `sitemap.xml`, OG, canonical) | ✅ ở prod |

> ⚠️ File `.env` đã được `.gitignore`. Chỉ commit `.env.example`.

---

## 🛠 NPM scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run help` | In bảng mô tả tất cả lệnh kèm màu |
| `npm run bootstrap` | `env:init` + `setup` (chuẩn bị máy dev từ 0) |
| `npm run setup` | `docker:up` + `db:deploy` + `db:seed` |
| `npm run docker:up` / `docker:down` | Bật / tắt Postgres + pgAdmin |
| `npm run db:deploy` | Áp Prisma migrations |
| `npm run db:seed` | Seed dữ liệu mẫu |
| `npm run db:generate` | Generate Prisma Client (sau khi đổi `schema.prisma`) |
| `npm run dev:api` / `dev:web` | Chạy dev server |
| `npm run build:api` / `build:web` / `build` | Build production |
| `npm run lint:web` | ESLint cho web |
| `npm run test:api` | Jest cho api |

---

## 🗃 Mô hình dữ liệu

```prisma
Category      (id, slug 🔑, name, status, schemaConfig: Json)
 └─ Product   (id, categoryId →, name, affiliateUrl, scrapedData: JsonB, network)
     ├─ ClickLog        (trackingCode 🔑, ipHash, userAgent, createdAt)
     │   └─ ConversionWebhook (trackingCode →, revenue, status, payload, receivedAt)
     └─ ProductExtraction (rawContent, aiOutput, status: DRAFT_RAW|PENDING_REVIEW|PUBLISHED|ERROR)
PromptTemplate (name 🔑, content, version, isActive, activatedAt)
```

- `schemaConfig` (Json) cho phép mỗi tool định nghĩa schema riêng — AI extract sẽ phải khớp đúng schema này.
- `scrapedData` (JsonB) lưu kết quả đã duyệt — frontend dùng `normalizeProduct()` để hiển thị an toàn dù schema lệch.
- `trackingCode` là unique key xuyên suốt: click → conversion → đối soát doanh thu.

---

## 🔄 Luồng hoạt động

### 1. Crawl & extract
```
cron → fetch HTML offer page → ProductExtraction.rawContent
     → Gemini (active PromptTemplate) → aiOutput (JSON)
     → status = PENDING_REVIEW
```

### 2. Human review
```
Admin /refinery
  ├─ Approve → Product.scrapedData = aiOutput; status = PUBLISHED
  ├─ Reject & retry → enqueue lại với prompt mới
  └─ Reject → status = ERROR + errorReason
```

### 3. User click → affiliate redirect
```
[Click "Xem deal"]
  → server action createTrackingRedirect()
      ├─ uuid → trackingCode (32 ký tự, không dấu gạch)
      ├─ POST /tracking/click → tạo ClickLog
      └─ append ?utm_source=<trackingCode>
  → redirect() sang URL đối tác
```

### 4. Đối soát đơn hàng
```
Đối tác POST /webhooks/conversion {trackingCode, revenue, status}
  → ConversionWebhook tham chiếu ClickLog
  → KPI War Room cập nhật doanh thu / conversion rate
```

---

## 🗺 Roadmap

- [ ] So sánh giá đa shop cho cùng 1 sản phẩm (price-history chart)
- [ ] Tự sinh OG image cho từng sản phẩm (next/og)
- [ ] Tìm kiếm full-text + facet filter
- [ ] Cảnh báo giá (price alert qua email/Telegram)
- [ ] Affiliate adapter cho Shopee / Lazada / Tiki / Amazon
- [ ] A/B test CTA button & landing variant
- [ ] Cron health dashboard + auto-retry crawler

---

## 🤝 Đóng góp

Pull request rất được chào đón. Trước khi gửi:

```bash
npm run lint:web
npm run test:api
npm run build
```

Style: TypeScript strict, không `any`, prefer functional component & server component mặc định.

---

## 📄 License

MIT © [phamgiang-bhdn](https://github.com/phamgiang-bhdn)
