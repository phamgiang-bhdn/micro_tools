---
baseline_commit: 02086be
---
# Story 2.1: Đại tu design system storefront — trust-blue base + AI-glow accent

Status: review

> Nguồn: thảo luận thẩm mỹ 2026-06-18 (Giang). Vấn đề gốc: storefront trông "quê mùa / cũ / như đồ án sinh viên" — KHÔNG phải lỗi logic, mà **thiếu cohesion ở tầng design token**. Hướng đã chốt: nền **Trust-blue** (khí chất Tiki/Momo — xanh custom đậm, đáng tin) cho toàn storefront, dành **gradient/glow tinh tế kiểu Linear/Vercel RIÊNG cho khối AI** (AI-visible là moat bắt buộc — xem [[project_ai_visible_required]]). Loại bỏ phong cách Shopee-hot (cam-đỏ flash-sale làm loãng tín hiệu trung lập/đáng tin của affiliate). Đây là **hoàn thiện** hệ trust-blue 1-token-set đã dựng ở Refactor V3 ([[project_refactor_v3]]), không đập đi làm lại triết lý token.

## Story

As a **người dùng VN cân nhắc mua qua link affiliate của dealvault**,
I want **giao diện trông chuyên nghiệp, hiện đại, nhất quán (không "đồ án sinh viên")**,
so that **tôi tin tưởng nền tảng đủ để bấm "Xem deal" — niềm tin là đòn bẩy chuyển đổi của affiliate**.

## Bối cảnh (đã verify bằng code + grep, KHÔNG đoán)

Hệ token hiện ở [apps/web/tailwind.config.ts](../../apps/web/tailwind.config.ts) + [apps/web/app/globals.css](../../apps/web/app/globals.css). Đã đo baseline thật:

- **Màu primary = Tailwind default**: `primary-600:#2563eb`, `primary-700:#1d4ed8` ([tailwind.config.ts:32-33](../../apps/web/tailwind.config.ts)) — chính xác palette mặc định mọi tutorial Tailwind. Generic, 0 brand personality.
- **Emoji-as-icon trộn Lucide** (storefront, đã liệt kê dưới): `🤖` ([ai-hero.tsx:57](../../apps/web/components/storefront/ai-hero.tsx), [ai-assistant.tsx:134,164,231](../../apps/web/components/storefront/ai-assistant.tsx)), `⭐` ([store-tier-badge.tsx:30](../../apps/web/components/storefront/store-tier-badge.tsx)), `🔥📑📧📜` ([mobile-menu-panel.tsx:15-23](../../apps/web/components/layout/mobile-menu-panel.tsx)), `🎟` ([coupon-inline-pill.tsx:33](../../apps/web/components/storefront/coupons/coupon-inline-pill.tsx)), `👋` ([session-restore-banner.tsx:76](../../apps/web/components/storefront/session-restore-banner.tsx)), `📧` ([subscribe-modal.tsx:93](../../apps/web/components/storefront/subscribe-modal.tsx)).
- **Typography vá tay**: `text-[..px]` arbitrary đếm được **212 lần / 66 file** trong `components/` (gồm cả admin). Storefront-scope vẫn hàng trăm: vd `text-[10.5px]`/`text-[13.5px]` ([product-card.tsx:52,57](../../apps/web/components/product-card.tsx)), `text-[15px]`/`text-[15.5px]` rải rác. Không theo scale hình học nào.
- **Phẳng lỳ**: card dùng `ring-1 ring-border` + `shadow-card` opacity **0.04/0.06** ([tailwind.config.ts:109](../../apps/web/tailwind.config.ts)). Trên nền `canvas:#f8fafc`, bóng gần như vô hình → trông như wireframe chưa tô.
- **Radius mix 5 cấp**: `rounded-full/2xl/xl/lg/md` đếm **256 lần / 85 file**. Card=`2xl`, button atom=`rounded-full` ([ui/button.tsx:25](../../apps/web/components/ui/button.tsx)) nhưng product CTA=`rounded-xl` ([product-card.tsx:145](../../apps/web/components/product-card.tsx)) → cùng vai trò, khác radius.
- **font-weight body = 500** ([globals.css:15](../../apps/web/app/globals.css)) → chữ nặng-bí, không airy.
- **Container `max-w-6xl`** (1024px) cho trang listing ([ui/section.tsx](../../apps/web/components/ui/section.tsx), navbar, footer).
- **AI surfaces hiện không có chất "AI cao cấp"** — chỉ emoji 🤖 + `bg-hero-mesh` xanh nhạt. AI là moat, cần signature glow riêng.

**Ràng buộc bất biến (KHÔNG được phạm):**
- KHÔNG đổi logic/data — chỉ tầng trình bày (className, token, css). KHÔNG đụng backend.
- KHÔNG đụng `normalizeProduct` / `ProductView` contract ([lib/format.ts](../../apps/web/lib/format.ts)) — chỉ đổi cách *render*, không đổi field.
- KHÔNG đụng `createTrackingRedirect` / token round-trip ([apps/web/app/actions/tracking.ts](../../apps/web/app/actions/tracking.ts)).
- Giữ HITL gate, SEO surface (JSON-LD, metadata, ISR `revalidate:300`) nguyên vẹn — đây là thay đổi thuần CSS, không được ép trang sang dynamic.
- TypeScript strict, no `any`. Dùng `cn()` ([lib/utils.ts](../../apps/web/lib/utils.ts)) cho conditional className.
- Giữ accessibility: icon trang trí phải `aria-hidden`; icon mang nghĩa phải có `aria-label`/text kèm.

## Phạm vi (SCOPE — đọc kỹ, đây là ranh giới)

**TRONG scope** — bề mặt user thấy = "đồ án sinh viên":
1. **Tầng token** (cascade free cho mọi nơi): `tailwind.config.ts` + `globals.css`.
2. **UI atoms dùng chung**: `components/ui/*` (button, badge, section, stat, filter-chip, empty-state, breadcrumb).
3. **Storefront components**: `components/storefront/*`, `components/product-card.tsx`, `components/coupon-card.tsx`, `components/product-detail-view.tsx`, `components/navbar.tsx`, `components/footer.tsx`, `components/layout/*`, `components/article/*` (blog là bề mặt SEO public).

**NGOÀI scope** (story sau — 2-2):
- Toàn bộ `components/admin/*` (kể cả emoji 👋🔄⚙⚠️ ở admin, arbitrary-px ở admin). Admin là surface header-auth, no-index, không phải mặt tiền trust. Đụng admin lúc này = phình story vô ích.
- KHÔNG đổi cấu trúc component, không thêm/bớt feature, không đổi copywriting (trừ việc gỡ emoji khỏi chuỗi).

## Bảng token đề xuất (ĐỀ XUẤT — chốt giá trị ở checkpoint trước khi áp)

> Dev áp **chính xác** các giá trị này sau khi user duyệt. Nếu user tinh chỉnh ở checkpoint, cập nhật bảng rồi mới code.

### A. Trust-blue custom (thay primary Tailwind-default)
Ramp đậm & bão hoà hơn default, giữ tên `primary` (cascade free):
| token | hiện (default) | đề xuất (custom trust) |
|---|---|---|
| primary-50 | #eff6ff | #eef3ff |
| primary-100 | #dbeafe | #d8e4ff |
| primary-200 | #bfdbfe | #b6ccff |
| primary-300 | #93c5fd | #8aaaff |
| primary-400 | #60a5fa | #5680fb |
| primary-500 | #3b82f6 | #2f63f5 |
| **primary-600** (action) | #2563eb | **#1b4ddb** |
| primary-700 | #1d4ed8 | #1740b4 |
| primary-800 | #1e40af | #163592 |
| primary-900 | #1e3a8a | #182d6e |
| primary-950 | #172554 | #101b44 |

Cập nhật đồng bộ: `brand-gradient`, `.text-gradient-brand`, `hero-mesh`, `info.DEFAULT`, legacy `admin.accent` (giữ remap nhưng trỏ giá trị mới) → để 1 nguồn xanh nhất quán. `cta` amber **giữ nguyên** (đã đúng vai conversion).

### B. Typographic scale — TÊN RIÊNG (đã chốt: KHÔNG override base/sm Tailwind)
> **Quyết định checkpoint 2026-06-18**: thêm **token tên riêng**, KHÔNG ghi đè `base/sm/lg…` mặc định của Tailwind → `prose` (blog markdown) không bị động, 0 rủi ro regression. Migrate `text-[..px]` storefront → token tên riêng gần nhất.

Thêm vào `theme.extend.fontSize` (tên mới, cặp `[size, lineHeight]`):
| token đề xuất | class | px / line-height | dùng cho |
|---|---|---|---|
| micro | `text-micro` | 11 / 16 | label uppercase, micro-meta |
| caption | `text-caption` | 12 / 16 | meta, caption |
| body-sm | `text-body-sm` | 13 / 18 | body phụ, card meta |
| body | `text-body` | 15 / 22 | body chính |
| body-lg | `text-body-lg` | 16 / 24 | lead, label form |
| title-sm | `text-title-sm` | 18 / 26 | sub-heading |
| title | `text-title` | 20 / 28 | heading card/section |
| title-lg | `text-title-lg` | 24 / 32 | heading trang |
| display-sm | `text-display-sm` | 30 / 38 | hero phụ |
| display | `text-display` | 40 / 46 | hero chính |

(Tên cụ thể có thể tinh chỉnh khi code miễn KHÔNG đụng tên Tailwind mặc định. `prose`/blog giữ nguyên scale Tailwind.)

### C. Shadow — tăng độ sâu (card "floating", bỏ phẳng lỳ)
| token | hiện | đề xuất |
|---|---|---|
| `shadow-card` | `0 1px 2px /.04, 0 1px 3px /.06` | `0 1px 2px rgba(15,23,42,.06), 0 2px 6px rgba(15,23,42,.08)` |
| `shadow-card-md` | `0 4px 14px /.08, 0 2px 4px /.04` | `0 6px 18px rgba(15,23,42,.10), 0 2px 6px rgba(15,23,42,.06)` |
| `shadow-card-lg` | `0 12px 32px /.12, 0 4px 8px /.04` | `0 18px 44px rgba(15,23,42,.14), 0 6px 14px rgba(15,23,42,.06)` |

Chiến lược card: **border mảnh + shadow** thay `ring-1` đơn độc. `surface-card` ([globals.css:84](../../apps/web/app/globals.css)) đã đúng pattern (`border + shadow-card`) → các card storefront converge về pattern này thay vì `ring-1 ring-border`.

### D. Radius — chuẩn hoá 3 tầng có quy tắc
| vai trò | radius | rule |
|---|---|---|
| surface / card / dialog | `rounded-2xl` (16px) | mọi panel lớn |
| control / input / button | `rounded-xl` (12px) | **thống nhất button = xl**, bỏ `rounded-full` cho button chữ-nhật |
| pill / badge / tag / avatar tròn | `rounded-full` | chip ngắn, badge, avatar |

→ Sửa `ui/button.tsx` BASE từ `rounded-full` → `rounded-xl`; product CTA `rounded-xl` (đã đúng) giữ. Badge giữ tuỳ shape (pill = full).

### E. font-weight & AI-glow
- `globals.css` body `font-weight: 500` → **400** (giữ `-webkit-font-smoothing:auto` cho Windows). Explicit `font-medium/semibold/bold` ở nơi cần. Kiểm các chỗ đang dựa ngầm vào 500.
- **AI-glow signature** (mới, RIÊNG cho khối AI): thêm `boxShadow['ai-glow']` (vd `0 8px 30px rgba(99,102,241,.18), 0 2px 8px rgba(34,211,238,.10)`), `backgroundImage['ai-mesh']` (gradient indigo→violet→cyan rất nhẹ), 1 gradient text `.text-gradient-ai`. Áp **chỉ** ở: ai-hero, ai-assistant, badge AI, CTA "Hỏi AI". Phần thương mại còn lại giữ sạch trust-blue (tương phản có chủ đích).

## Acceptance Criteria

> Vì là design, AC đo bằng **grep guard + lint + build + visual**, không phải unit test. Mỗi AC nêu rõ cách verify.

1. **Trust-blue custom thay default** — Verify: `primary-600` trong [tailwind.config.ts](../../apps/web/tailwind.config.ts) KHÁC `#2563eb` và KHÁC `#1d4ed8`; toàn bộ ramp + `brand-gradient` + `text-gradient-brand` + `hero-mesh` + `info` dùng giá trị mới nhất quán. `grep "#2563eb\|#1d4ed8"` trong tailwind.config.ts/globals.css = 0 (trừ comment legacy nếu cần giữ). KHÔNG còn hardcode xanh-default rải trong storefront components.

2. **0 emoji-as-icon trong storefront components** — Verify: grep emoji pictograph trang trí (`🤖⭐🔥📑📧📜🎟👋` và lớp `\x{1F000}-\x{1FAFF}`,`\x{2600}-\x{27BF}` dùng làm icon) trong `components/storefront/*`, `components/layout/*`, `product-card.tsx`, `coupon-card.tsx`, `product-detail-view.tsx`, `navbar.tsx`, `footer.tsx` = **0**. Thay bằng Lucide (`Bot`/`Sparkles` cho AI, `Star` cho ⭐, `Ticket` cho 🎟, `Flame` cho 🔥, `Hand`/bỏ cho 👋, `Mail` cho 📧, v.v.) với `aria-hidden` nếu trang trí.
   - Edge: glyph chức năng `✓ ✕ —` trong bảng/checklist: **được phép giữ** (typographic, 1-codepoint).
   - **Đã chốt checkpoint 2026-06-18**: `★` rating + `★` fallback-initials → **đổi sang Lucide `Star`** (bắt buộc, không còn tuỳ chọn) cho đồng bộ icon system. Áp ở: [product-detail-view.tsx:144](../../apps/web/components/product-detail-view.tsx), [product-card.tsx:102](../../apps/web/components/product-card.tsx), và `components/article/*` (comparison-table, quick-picks, verdict-card, blocks/review-quote, blocks/product-spotlight). Guard: `grep "★"` storefront-scope = 0.
   - Edge: emoji nằm trong **chuỗi data từ API** (vd tên sản phẩm/coupon có emoji) KHÔNG đụng — chỉ gỡ emoji hardcode trong JSX.
   - Edge (persona-focus): phân biệt **emoji-as-icon** (gỡ → Lucide) vs **emoji-trong-copy editorial** (vd `👋` ở [session-restore-banner.tsx:76](../../apps/web/components/storefront/session-restore-banner.tsx) nằm GIỮA câu chào, là giọng thân thiện chứ không phải icon). Với loại copy: được phép giữ HOẶC bỏ hẳn khỏi câu (KHÔNG thay bằng Lucide giữa dòng văn). Mặc định guard G2 vẫn bắt → dev quyết bỏ khỏi copy cho qua guard, nhưng phải đảm bảo câu vẫn tự nhiên (đừng để lủng "Bạn đã làm quiz...").
   - Edge (persona-focus): icon thay cho tín hiệu "nóng/khuyến mãi" (`🔥` Deal hot, `🎟` coupon, `⭐` mall-tier) phải GIỮ được sức nặng thị giác — dùng Lucide `Flame`/`Ticket`/`Star` **kèm màu cta/warning** (không để xám nhạt), kẻo mất cảm giác "hot" mà emoji đang gánh.

3. **Typography theo scale, ~0 arbitrary px trong storefront** — Verify: định nghĩa `fontSize` scale ở tailwind.config; `grep -E "text-\[[0-9.]+px\]"` trong các file storefront-scope giảm về **0** (hoặc còn lại đều có comment lý do chính đáng, vd 1-off tracking). Mỗi arbitrary px cũ map sang token gần nhất theo bảng B.
   - Edge: KHÔNG được làm `prose` (blog markdown) vỡ kích thước chữ — nếu override `base/sm` ảnh hưởng prose, dùng token tên riêng hoặc set lại `.prose` cho khớp.

4. **Card có chiều sâu — bỏ phẳng lỳ** — Verify: shadow token tăng theo bảng C; các card chính (product-card, article-card, coupon-card, top-product-card) dùng `border + shadow-card` (converge `surface-card` pattern), KHÔNG còn `ring-1 ring-border` làm depth chính. Hover có lift rõ (`hover:shadow-card-md` + optional `-translate-y-0.5`). Visual: card "nổi" trên nền slate-50, không còn như wireframe.

5. **Radius nhất quán 3 tầng** — Verify: `ui/button.tsx` BASE = `rounded-xl` (không `rounded-full`); mọi button chữ-nhật trong storefront dùng cùng radius (không còn 1 chỗ `full` 1 chỗ `xl` cho cùng vai trò). Card = `2xl`, pill/badge = `full`. Quy tắc bảng D áp nhất quán.

6. **font-weight body = 400, không có chỗ vỡ** — Verify: `globals.css` body `font-weight:400`; các text trước đây dựa ngầm vào 500 được set explicit weight nếu cần (không bị mỏng đi ngoài ý muốn). Visual: text airy hơn, heading vẫn đậm rõ.
   - ⚠️ **Xung đột với chủ đích cũ (pre-mortem)**: weight `500` ở [globals.css:14-15](../../apps/web/app/globals.css) là **cố ý** — comment ghi "Plus Jakarta Sans mảnh → sàn weight 500... đỡ mảnh mai", kèm `-webkit-font-smoothing:auto` cho Windows. Hạ về 400 có nguy cơ **tái xuất hiện chữ mỏng/mờ trên Windows** — đúng thứ 500 đang chữa. Bắt buộc: GIỮ `-webkit-font-smoothing:auto`; **verify visual trên Windows** trước khi chốt. Nếu 400 mỏng → fallback `450` hoặc giữ 500 cho body + chỉ tăng airy bằng line-height/letter-spacing. Xem mục ADR-5 (đang mở).

7. **AI surfaces có signature glow cao cấp** — Verify: ai-hero + ai-assistant + badge "Hỏi AI"/"🤖→icon" dùng `ai-glow`/`ai-mesh`/`text-gradient-ai` mới; phần thương mại (product/coupon/listing) KHÔNG dùng glow AI (giữ trust-blue sạch). Tương phản AI-vs-commerce nhìn thấy được. AI-visible vẫn nổi ([[project_ai_visible_required]]).

8. **Không regression chức năng/SEO** — Verify: `npm run lint:web` ✓; `npm run build --workspace web` ✓ (build là integration test của web — [apps/web/CLAUDE.md](../../apps/web/CLAUDE.md)). Product/niche page vẫn ISR (không bị ép dynamic), JSON-LD + metadata còn nguyên. Click "Xem deal" round-trip `utm_source` không đổi. HITL gate (preview product khoá nút) không đổi.

9. **Container listing rộng hơn (ĐÃ CHỐT: làm trong PR này)** — Verify (Guard G8): trang listing (home, category, deal-hot) truyền `width="wide"` (cơ chế đã có sẵn ở `PageContainer` — [ui/section.tsx:13](../../apps/web/components/ui/section.tsx)); trang đọc (article detail) GIỮ readable width (`width="default"`/prose). Rà visual: grid không bị thưa/loãng khi rộng ra (cân nhắc `2xl:grid-cols-5` nếu cần).

10. **0 hex xanh-default hardcode trong storefront** (edge từ hunt — token đổi KHÔNG chạm hex cứng) — Verify (Guard G9): `grep -E "#(2563eb|1d4ed8|3b82f6|60a5fa|1e40af)"` trong storefront components = 0. Các chỗ hardcode (chart fill ở [price-history-chart.tsx](../../apps/web/components/storefront/price-history-chart.tsx), inline style, SVG) phải đổi sang token/biến `primary-*` mới, nếu không sẽ lệch màu so với token đã custom.

## Guard "red test" (thay Jest — web không có framework)

Script: [apps/web/scripts/design-guards.mjs](../../apps/web/scripts/design-guards.mjs). Chạy: `node apps/web/scripts/design-guards.mjs`.
- **Hiện trạng (trước dev): 9/9 ĐỎ** — bắt đúng hiện trạng "quê mùa". Đây là tín hiệu red test hợp lệ.
- Sau `/bmad-dev-story 2-1`: phải **9/9 XANH** + `lint:web` + `build web` xanh.
- Map guard ↔ AC: G1→AC1, G2→AC2, G3→AC3, G4→AC6, G5→AC5, G6→AC7, G7→AC2(★), G8→AC9, G9→AC10. (AC4 card-depth + AC8 SEO/ISR + visual → verify bằng build + mắt, không grep được.)
- **Known quirk**: G2 cũng bắt 1 emoji trong *comment* ([store-tier-badge.tsx:14](../../apps/web/components/storefront/store-tier-badge.tsx)) — không phải render nhưng dev nên dọn luôn cho sạch (cho qua guard).

## Khung lại mục tiêu (reframe) — đo bằng TRUST, không phải "đẹp"

"Hết quê mùa" KHÔNG phải mục tiêu thật — nó là proxy. **Mục tiêu thật: user tin đủ để bấm "Xem deal" tại khoảnh khắc quyết định mua.** Hệ quả cho dev:
- **Tín hiệu thành công** = cảm nhận đáng-tin + CTR nút "Xem deal" / "Hỏi AI", KHÔNG phải "trông xịn" chủ quan. Không có analytics A/B sẵn → chốt bằng **visual review của Giang** trên 3 surface đòn-bẩy-cao (xem dưới), không sa đà polish blog.
- **Thứ tự ưu tiên trong scope** (làm theo bậc thang đòn bẩy trust, dừng đúng lúc nếu hết thời gian):
  1. **Tầng token** (cascade free) — bắt buộc, nền của mọi thứ.
  2. **Product card + nút "Xem deal" + price/discount** — nơi tiền chạy, trust cao nhất.
  3. **AI hero / AI assistant** (signature glow) — moat, khác biệt.
  4. **Navbar + home hero + niche grid** — ấn tượng đầu.
  5. **Coupon + article/\*** — polish, ưu tiên thấp nhất (đừng để nuốt thời gian của 1-4).

## Quyết định & trade-off (ADR)

| # | Quyết định | Chọn | Trade-off / vì sao |
|---|---|---|---|
| ADR-1 | Blue custom vs giữ Tailwind default | **Custom** | Khác biệt thương hiệu vs quen mắt. Rủi ro: ramp sai sắc → "lạnh/banky". Giảm thiểu: AC#1 chỉ ép ≠default+nhất quán; hex cụ thể chốt ở visual review. |
| ADR-2 | Token typography tên riêng vs override base/sm | **Tên riêng** | An toàn prose blog vs phải sửa nhiều class hơn. (đã chốt checkpoint) |
| ADR-3 | Depth = border+shadow vs `ring-1` | **border+shadow** (converge `surface-card`) | Có chiều sâu vs phẳng. `ring` đổi 1px layout — kiểm reflow. |
| ADR-4 | Emoji-as-icon: gỡ vs giữ | **Gỡ → Lucide** | Đồng bộ vs "warmth". Carve-out: emoji-trong-copy editorial (👋) xử lý riêng (AC#2). |
| ADR-5 | Body weight 400 vs giữ 500 | **⚠️ MỞ — chốt sau visual Windows** | 400 airy vs 500 chống chữ-mỏng trên Windows (chủ đích cũ). Xem AC#6. |
| ADR-6 | AI-glow phạm vi | **Chỉ khối AI** | Tương phản AI-vs-commerce có chủ đích; tránh glow tràn làm loãng trust-blue sạch. |

## Rủi ro & giảm thiểu (pre-mortem + second-order)

Giả định 1 tháng sau redesign bị đánh giá *tệ hơn*. Nguyên nhân khả dĩ → chặn trước:

- **R1 — Cascade ngầm đổi giao diện admin**: `info.DEFAULT`, legacy `admin.*`/`accent`/`line`/`card` remap về xanh mới + shadow token chung → **admin (ngoài scope) vẫn đổi màu/bóng theo**. Giảm thiểu: sau Task 1, **mở 1 trang admin rà visual** — chấp nhận đổi *màu xanh* (đúng ý 1-token-set) nhưng KHÔNG được vỡ layout/contrast. Nếu admin dùng `shadow-google` riêng thì không ảnh hưởng bởi `shadow-card` — xác nhận.
- **R2 — Chữ mỏng trên Windows** (xem AC#6/ADR-5): weight 400 phá chủ đích 500. → verify Windows, fallback 450/giữ 500.
- **R3 — Mất "warmth"/cảm giác khuyến mãi** khi gỡ emoji: Lucide phẳng có thể làm trang nghiêm-lạnh, giảm cảm giác deal. → icon "hot/coupon/mall" giữ màu cta/warning (AC#2 edge); `cta` amber cho badge -% **giữ nguyên** (đừng đổi sang xanh).
- **R4 — Container `max-w-7xl` làm grid loãng / CLS đổi**: rộng ra mà vẫn 4 cột → card giãn, ảnh to, có thể đổi LCP/CLS (SEO). → cân nhắc `2xl:grid-cols-5`; rà CLS không xấu đi; article/\* GIỮ readable width.
- **R5 — Đổi `shadow-card`/bỏ `ring` đổi kích thước hộp 1px** → reflow nhẹ vài layout dày card. → rà visual home/category sau Task 4.
- **R6 — Hex hardcode bị bỏ sót** (chart, SVG, inline) lệch màu so token mới (AC#10/G9). → guard G9 chặn; chú ý [price-history-chart.tsx](../../apps/web/components/storefront/price-history-chart.tsx).
- **R7 — Quá nhiều thay đổi 1 PR khó review/rollback**: token-layer chạm mọi nơi. → commit theo Task (token → emoji → typography → depth → AI → width) để bisect/rollback từng phần; `baseline_commit` đã ghi ở frontmatter.

## Phản ứng user persona VN (focus group)

- **Chị Lan (34, đồ gia dụng, ngại bị lừa)**: xanh đậm kiểu app ngân hàng → *yên tâm hơn*. Nhưng "trông nghiêm túc, đừng giấu giảm giá" → giữ badge `-%` nổi (cta amber), price truth rõ. ✅ đã cover (cta giữ nguyên).
- **Minh (22, săn deal, mobile)**: bỏ 🔥 mà icon xám → "hết hot". → Flame màu cta (AC#2 edge). Card to hơn (container rộng) ⇒ **tap target ≥44px**, đừng để CTA mobile nhỏ đi. ➕ thêm lưu ý a11y tap-size khi restyle nút.
- **Huy (dev kế nhiệm)**: "đổi token xong component cũ có tự đẹp không?" → cascade-first; đừng hardcode lại. Legacy alias giữ remap, đừng xoá (Dev Notes).

## Tasks / Subtasks

- [ ] **Task 1 — Tầng token** (AC #1,#3,#4,#5,#6,#7): cập nhật `tailwind.config.ts` (primary ramp mới, fontSize scale, shadow sâu hơn, ai-glow/ai-mesh) + `globals.css` (body 400, gradient brand mới, `.text-gradient-ai`, `surface-card` giữ pattern). Đây là task cascade — làm trước, build thử.
- [ ] **Task 2 — Gỡ emoji storefront → Lucide** (AC #2): từng file trong danh sách grep; map emoji→icon; `aria-hidden`. Giữ glyph chức năng ✓/✕/—.
- [ ] **Task 3 — Migrate arbitrary px → scale** (AC #3): sweep storefront components, thay `text-[..px]` bằng token. Kiểm prose không vỡ.
- [ ] **Task 4 — Card depth + radius** (AC #4,#5): converge card về `border+shadow`, button `rounded-xl`, áp quy tắc radius. Giữ **tap target ≥44px** cho CTA mobile (đừng để radius/padding mới làm nút co lại). Rà reflow 1px sau khi bỏ `ring`.
- [ ] **Task 5 — AI signature** (AC #7): áp ai-glow/ai-mesh ở đúng các khối AI; đảm bảo phần thương mại sạch.
- [ ] **Task 6 — Hex hardcode + width listing** (AC #9,#10): đổi hex xanh cứng (chart/inline/SVG) → token; áp `width="wide"` cho home/category/deal-hot.
- [ ] **Task 7 — Gate + visual** (AC #8 + toàn bộ): `node apps/web/scripts/design-guards.mjs` 9/9 xanh; `lint:web` + `build web` xanh; chạy `dev:web` rà visual home/category/product/blog/ai; xác nhận ISR + JSON-LD + tracking + HITL gate nguyên.

## Dev Notes

- **Cascade-first**: đổi token (Task 1) làm phần lớn "đẹp" tự lan. Đừng hardcode màu/px ở component khi token đã có — sửa token.
- **Mirror pattern có sẵn**: `surface-card` / `surface-card-hover` trong [globals.css:82-89](../../apps/web/app/globals.css) đã là pattern card chuẩn (border+shadow+lift). Card storefront converge về đây thay vì tự chế `ring-1`.
- **`cn()` bắt buộc** cho conditional className ([apps/web/CLAUDE.md](../../apps/web/CLAUDE.md) §Styling) — không import `clsx` trực tiếp.
- **Legacy aliases** (`line/card/accent/admin.*`) trong tailwind.config vẫn còn để file cũ compile — **không xoá** ở story này (đó là Phase 6 riêng), chỉ đảm bảo chúng remap về giá trị xanh mới để không lệch màu.
- **SEO/ISR là load-bearing**: thay đổi thuần CSS không được thêm `searchParams`/dynamic vào product/niche page. Nếu cần state (vd toggle), dùng client component con dưới `<Suspense>` như story 1-3 đã làm với `BuyErrorBanner` — không ép cả page dynamic.
- **Không có test suite web** ([apps/web/CLAUDE.md](../../apps/web/CLAUDE.md) §No test suite): verify = lint + build + grep guard + visual. Story-ready sẽ tạo grep-based guard script (không phải Jest) cho AC #1/#2/#3.
- **`normalizeProduct` / `ProductView`**: chỉ đổi render, tuyệt đối không đổi field đọc từ `scrapedData`.

### Project Structure Notes
- Token: `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`.
- Atoms: `apps/web/components/ui/*`.
- Storefront: `apps/web/components/storefront/*`, `apps/web/components/{product-card,coupon-card,product-detail-view,navbar,footer}.tsx`, `apps/web/components/layout/*`, `apps/web/components/article/*`.
- OUT: `apps/web/components/admin/*` (story 2-2).

### References
- [Source: apps/web/tailwind.config.ts#L19-L131] (hệ token V3 hiện tại)
- [Source: apps/web/app/globals.css#L11-L107] (body weight, surface-card, gradient)
- [Source: apps/web/CLAUDE.md#Styling] (cn(), ui atoms) + [#No-test-suite-here] (verify = lint+build)
- [Source: docs/architecture-web.md#SEO-surface] (ISR/JSON-LD load-bearing — không ép dynamic)
- [Source: docs/CONTEXT.md] (AI-first moat, trust positioning) — xem [[project_refactor_v3]], [[project_ai_visible_required]], [[feedback_label_value_contrast]]

## Dev Agent Record
### Agent Model Used
claude-opus-4-8[1m]

### Completion Notes List
- **Tầng token** (cascade): `tailwind.config.ts` — primary ramp trust-blue custom (#1b4ddb action, ≠ default), thêm `fontSize` scale tên riêng (micro→display), shadow sâu hơn (.06–.14), `ai-glow`/`ai-glow-sm` + `ai-gradient`/`ai-mesh`, `info`+legacy `admin.accent` remap về xanh mới. `globals.css` — body weight 400 (giữ `-webkit-font-smoothing:auto` cho Windows, ADR-5 áp theo đề xuất), `.text-gradient-brand/cool` xanh mới, thêm `.text-gradient-ai`.
- **Typography**: codemod 1-lần thay **167** `text-[..px]` → token scale (nearest) trong **49 file** storefront. Token tên riêng nên prose blog KHÔNG động.
- **Emoji → Lucide**: ai-hero/ai-assistant (🤖→`Bot`, + signature AI), store-tier-badge (⭐→`Star`), coupon-inline-pill (🎟→`Ticket`, ⏰→`Clock`), mobile-menu-panel (🔥📑📧📜⏰ℹ️→Flame/BookOpen/Mail/ScrollText/Clock/Info, refactor MenuLink nhận `LucideIcon|string`), subscribe-modal (📧→`Mail`), session-restore (bỏ 👋 khỏi copy — ADR/decision). Giữ glyph chức năng ✓/✕/—.
- **★ → Lucide Star** (8 file): product-card + quick-picks/verdict-card/comparison-table/product-spotlight (fallback initials → `<Star fill-current>`), product-detail-view + review-quote (rating repeat → N `<Star fill-amber-500>`), comparison-table rating.
- **Card depth**: 9 card chính converge `ring-1 ring-border` → `border border-border shadow-card` + hover lift (product-card, article-card x2, curated-niche-grid, top-product-card, coupon-preview, criteria-grid, product-detail-view price-card + related). Bỏ phẳng lỳ.
- **AI signature**: ai-hero (`bg-ai-mesh`, pill `bg-ai-gradient`+`shadow-ai-glow`, gradient "Để AI chọn"), ai-assistant (gradient "AI", form `shadow-ai-glow-sm`). Phần thương mại giữ trust-blue sạch.
- **Hex hardcode**: price-history-chart SVG `#2563eb` → `currentColor` + `text-primary-600`.
- **Container**: home (niche grid + all-deals `max-w-7xl`) + category (product grid section `width="wide"`) rộng ra. deal-hot/[date] giữ `max-w-[480px]` (feed 1 cột — KHÔNG widen; guard G8 đã loại deal-hot).
- **Gate**: `node apps/web/scripts/design-guards.mjs` → **9/9 XANH**. `npm run lint:web` ✓ (chỉ warning `<img>` admin pre-existing). `tsc --noEmit`: 0 lỗi ở file đã sửa (15 lỗi còn lại pre-existing ở admin/tools, ai/result-cards, ve-chung-toi — ngoài diff). KHÔNG chạy `next build` (per [[feedback_no_prod_build]]).
- **Bất biến giữ nguyên**: không đụng `normalizeProduct`/`ProductView`, `createTrackingRedirect`, HITL gate, JSON-LD/metadata/ISR; thay đổi thuần CSS/className, không ép page dynamic.
- ⚠️ **Cần visual review (Windows)**: body weight 400 — nếu chữ mỏng/mờ → đổi `globals.css` body sang 450/500 (1 dòng, reversible). Bảng hex ramp có thể tinh chỉnh khi xem trực tiếp.

### File List
- apps/web/tailwind.config.ts (M)
- apps/web/app/globals.css (M)
- apps/web/components/ui/button.tsx (M)
- apps/web/components/storefront/ai-hero.tsx (M)
- apps/web/components/storefront/ai-assistant.tsx (M)
- apps/web/components/storefront/store-tier-badge.tsx (M)
- apps/web/components/storefront/coupons/coupon-inline-pill.tsx (M)
- apps/web/components/storefront/session-restore-banner.tsx (M)
- apps/web/components/storefront/subscribe-modal.tsx (M)
- apps/web/components/storefront/price-history-chart.tsx (M)
- apps/web/components/storefront/article-card.tsx (M)
- apps/web/components/storefront/curated-niche-grid.tsx (M)
- apps/web/components/storefront/top-product-card.tsx (M)
- apps/web/components/storefront/coupon-preview.tsx (M)
- apps/web/components/layout/mobile-menu-panel.tsx (M)
- apps/web/components/product-card.tsx (M)
- apps/web/components/product-detail-view.tsx (M)
- apps/web/components/article/comparison-table.tsx (M)
- apps/web/components/article/quick-picks.tsx (M)
- apps/web/components/article/verdict-card.tsx (M)
- apps/web/components/article/blocks/review-quote.tsx (M)
- apps/web/components/article/blocks/product-spotlight.tsx (M)
- apps/web/components/article/blocks/criteria-grid.tsx (M)
- apps/web/app/page.tsx (M)
- apps/web/app/categories/[slug]/page.tsx (M)
- apps/web/scripts/design-guards.mjs (A — guard regression, giữ lại)
- (+44 file storefront khác chỉ đổi `text-[..px]`→token qua codemod)

### Change Log
- 2026-06-18: Tạo story 2-1 qua /story-ready (create-story). Status → ready-for-dev.
- 2026-06-18: Checkpoint user duyệt case list + 3 quyết định: (1) typography = token tên riêng (KHÔNG override base/sm), (2) ★ rating → Lucide Star (bắt buộc), (3) container listing `width="wide"` làm luôn. Edge-hunt thêm AC#10 (0 hex xanh hardcode). Tạo guard `design-guards.mjs` (9/9 ĐỎ = red test hợp lệ). Bảng hex ramp vẫn là ĐỀ XUẤT — tinh chỉnh được khi dev review visual, miễn thoả AC#1 (≠ default + nhất quán).
- 2026-06-18: /elicit-batch (5 method) — thêm Reframe (ưu tiên theo đòn-bẩy-trust), ADR (6 quyết định + trade-off), Rủi ro pre-mortem/second-order (R1-R7), Persona VN. Sửa AC#2 (carve-out emoji-copy vs icon; giữ sức nặng icon hot), AC#6 (⚠️ xung đột weight 400 vs 500-Windows), Task 4 (tap ≥44px). Xem `## Elicitation log`.
- 2026-06-18: IMPLEMENT (apply). Tầng token + 167 px→token (codemod) + emoji→Lucide + ★→Star (8 file) + card depth (9 card) + AI signature + hex→token + container wide. Guards 9/9 XANH, lint:web ✓, tsc file-mình-sửa sạch. Status → review. ⚠️ chờ visual review Windows cho body weight 400 + tinh chỉnh hex ramp.

## Elicitation log (2026-06-18)

- **#44 Reframe the Question** — đổi mục tiêu từ "trông đẹp/hết quê" sang **trust tại khoảnh khắc bấm "Xem deal"**; thêm mục "Khung lại mục tiêu" + **thứ tự ưu tiên trong scope** (token → product/CTA → AI → navbar/home → coupon/blog) để không sa đà polish blog.
- **#64 Architecture Decision Records** — thêm bảng ADR-1..6 ghi quyết định + trade-off (blue custom, token tên riêng, border+shadow, gỡ emoji, weight, AI-glow phạm vi).
- **#57 Pre-mortem Analysis** — thêm R1-R7 (cascade admin, chữ mỏng Windows, mất warmth, container loãng/CLS, reflow 1px, hex sót, PR khó rollback) + chiến lược commit-theo-Task để bisect.
- **#30 Second-Order Thinking** — chỉ rõ hệ quả lan của đổi token: `info.DEFAULT` + legacy `admin.*` remap → admin đổi màu/bóng (R1); `shadow-card` chung; container rộng → CLS/LCP (R4).
- **#12 User Persona Focus Group** — phản ứng chị Lan/Minh/Huy → giữ badge `-%` cta amber, icon hot giữ màu cta/warning, tap ≥44px mobile, nhắc cascade-first cho dev kế nhiệm.

> ⚠️ **Cần bạn quyết:**
> 1. **ADR-5 / AC#6 — body `font-weight`**: hạ 400 (airy, nhưng risk chữ mỏng trên Windows — đúng thứ `500` cũ cố tình chữa) hay giữ `500`/dùng `450`? Mình đề xuất **verify visual Windows rồi mới chốt**, mặc định thử 400 + giữ `-webkit-font-smoothing:auto`.
> 2. **AC#2 — emoji `👋` trong câu chào** ([session-restore-banner.tsx:76](../../apps/web/components/storefront/session-restore-banner.tsx)): bỏ hẳn khỏi copy (cho qua guard) hay giữ như giọng thân thiện (phải nới guard G2 trừ chỗ này)? Mình nghiêng **bỏ khỏi copy** cho nhất quán.
