# Refactor V3 — Greenfield frontend + scope cut (pre-release)

Quyết định ngày 2026-06-03. App **chưa release, đang dev** → cắt scope bây giờ là rẻ nhất, không có ranking/attribution thật để mất.

## Mục tiêu

Sửa 4 nỗi đau: (1) màu loạn (4 hệ màu chồng nhau), (2) UX/admin sprawl, (3) AI nửa mùa, (4) khó maintain. Nguyên nhân gốc: **quá tải tính năng cho một app 0 user** + frontend chắp vá.

## Phạm vi đã chốt

**GIỮ NGUYÊN (đang chạy, là phần khó):**
- NestJS API core + Prisma core: `Campaign / Product / Niche / CampaignNiche / ClickLog / ConversionWebhook`.
- Accesstrade crawler + client + coupon/top-products sync.
- Refinery AI extraction (`ProductExtraction`, confidence scoring, HITL).
- **Tool / QuizSession scoring + reasoning engine** — đây chính là "AI làm trung tâm", đã có sẵn.
- Article V2 pipeline (`Article` + `ArticleSection` + `ArticleEvidence` + `Author`).

**XÂY LẠI TỪ 0 (`apps/web`):**
- Toàn bộ storefront + admin.
- 1 design system trust-blue duy nhất, dùng chung 2 surface.
- IA gọn, AI-first.

**CẮT (pre-release, 0 user, chỉ làm rối — Phase 5):**
- `ToolEmailDrip`, `PriceWatch`, `Subscriber` drip, `TrackedLink`, `AdSpend`/ROAS, `CommissionRank`, `KeywordTrend`, `KeywordNicheMatch`.
- V1 article format (chỉ giữ V2 sections).
- `WaitlistSignup` + `/coming-soon` (pre-launch validation — giờ launch luôn).
- Gộp taxonomy: `Niche` + 1 khái niệm merchant (gộp `Brand`/`Source`/`Category`/`Shop` đang chồng nhau).
- Ẩn UI reconciliation/money-loop phụ (giữ cron backend).

## Hệ màu (chốt)

| Vai trò | Token | Giá trị |
|---|---|---|
| Primary (tin cậy) | `primary-600` | `#2563eb` (blue) |
| CTA / AI badge (chỉ dành cho "Xem deal" + 🤖) | `cta-500` | `#f59e0b` (amber) |
| Nền trang | `canvas` | `#f8fafc` (slate-50) |
| Card | `surface` | `#ffffff` |
| Text | `ink / ink-soft / ink-mute` | slate-900 / 700 / 500 |
| Border | `border / border-strong` | slate-200 / 300 |
| Semantic | `success / warning / danger / info` | green / amber / red / blue |

Bỏ sạch: `brand` đỏ, `google-*`, `admin` indigo, hero-mesh, glow đỏ, pulse-glow.
Token cũ giữ alias trỏ về hệ mới trong giai đoạn migrate → xoá ở Phase 6.

## Roadmap (ship dần)

- **Phase 1 ✅** — Design tokens trust-blue + globals.css + remap legacy alias.
- **Phase 2 ✅** — Rebuild shared UI atoms trên token mới.
- **Phase 3 ✅ (cốt lõi)** — AI-first storefront: home AI hero, product card, AI result (🤖 AI phân tích), coupon, navbar. Polish phụ (footer, mobile, niche-intro/filter/faq, blog detail) gộp Phase 6.
- **Phase 4 ✅ (shell)** — Slim admin IA (6 nhóm mạch lạc, bỏ nav mục cắt) + canonical shell. Còn: dọn widget dashboard chết + page-level.
- **Phase 5 🚧** — Cắt backend dead code + schema. **ĐÃ XONG** (build pass + schema valid):
  - Xoá service: CommissionRank, KeywordRadar, Opportunity, TrackedLink, ToolEmailDrip.
  - Sửa: admin.controller (bỏ import/constructor/endpoint ad-spend·tracked-links·email-drip·opportunities·sync runner), money-trail (bỏ AdSpend/ROAS), insights.module, tool.module, tracking.controller (bỏ drip).
  - Xoá schema model: ToolEmailDrip+EmailDripStatus, TrackedLink, AdSpend, CommissionRank, KeywordTrend, KeywordNicheMatch, PriceWatch + relations.
  - Xoá web orphan: ai-tool-banner, admin pages waitlist/email-drip/reconciliation.
  - **GIỮ**: Subscriber (newsletter), WaitlistSignup (còn dùng bởi email-capture trang AI result — chưa repoint).
  - **CÒN LẠI Phase 5**: dọn widget dashboard chết (channel-roas/external-link-kpi/commission-keyword trong admin/page.tsx) + dead actions trong admin/actions.ts; repoint email-capture → Subscriber rồi cắt WaitlistSignup; **gộp taxonomy** Brand/Source/Category/Shop → Niche+merchant (DEFER — đổi quan hệ lõi Product + crawler, cần DB + test crawler).
- **Phase 6 ✅ (core)** — Sweep 67 file: `brand-N`→`primary-N`, `google-blue`→`primary-600`; **xoá hẳn scale `brand` + `google`** khỏi tailwind.config (2 palette gây hiểu lầm/deprecated). Lint xác nhận 0 lỗi structural mới.
  - **Giữ có chủ đích** (alias map đúng về cùng palette, tên không gây hiểu lầm): `line`→border, `card`→surface, `accent`→success-green, `admin-*`→slate/blue. Xoá tiếp chỉ là churn rủi ro (vd `-card` đụng class `.surface-card`), 0 lợi ích thị giác.
  - Giữ key khác tên: `bg-brand-gradient` (backgroundImage, giờ xanh) + `shadow-google` (boxShadow trung tính) — vẫn dùng, không phải scale màu.

## ⚠️ BƯỚC THỦ CÔNG cần chạy (CODE đã xong hết, chỉ còn migrate)

**Trạng thái migrate:**
- Dead-feature cut (7 model): DB **đã in-sync** (các model đó chưa từng được migrate vào DB — chỉ drift trong schema). `migrate status` = up to date. KHÔNG cần làm gì.
- Taxonomy cut (Category/Source/Brand + 3 Product FK): các bảng/cột NÀY **có thật trong DB** → cần 1 migration DROP.

**Chạy (vì là DROP cột thật, phải tắt `dev:api` trước — nó giữ prisma client DLL + query các cột sắp drop):**
```
# 1. Tắt dev:api (Ctrl+C ở terminal đang chạy nest)
# 2.
npm run db:migrate -- --name cut_taxonomy
# 3. Bật lại: npm run dev:api
# 4. Test: chạy crawler 1 lần (/admin → "Chạy crawler ngay") → kiểm /admin/products vẫn nạp product OK
```
Prisma tự sinh DROP cho `Category/Source/Brand` + `Product.categoryId/sourceId/brandId` + regen client. Rủi ro thấp: các field này là metadata phụ; crawler vẫn upsert bình thường (chỉ ngừng ghi 4 field đó), storefront đọc qua `scrapedData` nên không ảnh hưởng.

**Còn lại (chưa làm, optional):** repoint email-capture trang AI result (`submitWaitlistAction`) sang `Subscriber` rồi mới cắt `WaitlistSignup` — hiện GIỮ vì còn dùng.

## Bất biến không được phá (contract Accesstrade)

- `trackingCode` = `randomUUID().replace(/-/g,"")` (32 ký tự không dấu) — format AT kỳ vọng.
- `POST /tracking/click` body shape + URL `?utm_source=<code>`.
- `POST /webhooks/accesstrade` request shape.
- Accesstrade API client endpoints/params.
