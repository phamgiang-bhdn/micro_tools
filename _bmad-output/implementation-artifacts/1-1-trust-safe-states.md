---
baseline_commit: 11672ea13c77654381031c7a0b62be07adf65720
---
# Story 1.1: Trust-safe states (404 → ngữ cảnh + lead capture)

Status: review

## Story

As a **người dùng tới một URL storefront không còn data (niche chưa mở, mã hết hạn, phiên AI hết hạn)**,
I want **thấy trang giải thích đúng tình trạng kèm lối đi tiếp (chờ/khám phá/làm lại) thay vì 404 chung chung**,
so that **tôi giữ niềm tin vào site và còn cơ hội chuyển đổi (để email / xem mục khác / làm lại quiz)**.

## Bối cảnh (đã verify)

- `/categories/[slug]` ([apps/web/app/categories/[slug]/page.tsx:93](../../apps/web/app/categories/[slug]/page.tsx)) `if (!niche) notFound()` — không phân biệt INACTIVE vs không tồn tại (vì API 404 cả hai; phụ thuộc story 1-2 để có `fetchNicheMeta`).
- `/khuyen-mai/[merchantSlug]` ([apps/web/app/khuyen-mai/[merchantSlug]/page.tsx:28](../../apps/web/app/khuyen-mai/[merchantSlug]/page.tsx)) `if (coupons.length === 0) notFound()` — merchant hết mã active = 404.
- `/ai/[slug]/result/[sessionId]` ([apps/web/app/ai/[slug]/result/[sessionId]/page.tsx:28](../../apps/web/app/ai/[slug]/result/[sessionId]/page.tsx)) và `/r/[shareSlug]` ([apps/web/app/r/[shareSlug]/page.tsx:29](../../apps/web/app/r/[shareSlug]/page.tsx)) → `notFound()` khi session/share null.
- 404 chung: [apps/web/app/not-found.tsx](../../apps/web/app/not-found.tsx) "Trang này có thể đã bị gỡ…".

## Acceptance Criteria

1. **Niche INACTIVE → coming-soon**: trên `/categories/[slug]`, nếu `fetchNicheBySlug` trả null thì gọi `fetchNicheMeta(slug)` (từ story 1-2):
   - meta.status === "INACTIVE" → `redirect("/coming-soon/<slug>")`.
   - meta === null (không tồn tại) → `notFound()`.
   - (niche ACTIVE → render bình thường, không đổi.)
2. **Coupon-merchant rỗng → trang "chưa có mã" (CHỈ khi merchant tồn tại — decision B)**: phân biệt merchant-có-thật vs slug-lạ:
   - Input: merchant **tồn tại** (có ≥1 Coupon row với `merchantSlug` đó, bất kể active) nhưng 0 mã đang active → Output: 200, "Hiện <merchant> chưa có mã đang dùng" + link "← Xem mã các shop khác" (`/khuyen-mai`).
   - Input: slug **không tồn tại** (0 Coupon row nào) → Output: `notFound()` (KHÔNG render 200 — tránh vô hạn URL hợp lệ / soft-404 / lãng phí crawl budget).
   - Cần API check tồn tại merchant (xem Dev Notes — endpoint mới, KHÔNG dùng `/coupons` vì nó lọc active).
   - SEO: trang "chưa có mã" (merchant thật) set `robots: { index: false }` **có điều kiện** khi 0 mã active.
   - **Copy phải khác biệt rõ** với `not-found.tsx` và với error-state (story 1-4): user đọc 1 giây phải biết "shop có thật, chỉ là tạm hết mã" — KHÔNG tái dùng câu "đường dẫn không đúng".
3. **Session/share hết hạn → trang "phiên hết hạn"**: tạo trạng thái riêng (không phải 404 generic) cho result/share null:
   - Input: sessionId/shareSlug không còn → Output: trang "Phiên gợi ý đã hết hạn" + CTA "Làm lại quiz" trỏ `/ai/<slug>` (result) hoặc `/` (share khi không suy ra được tool).
   - SEO: trang hết hạn set `robots: { index: false, follow: false }` (nội dung phù du, không được vào index; link share thường có `?source=share-link`).
4. **404 thật vẫn rõ ràng**: URL rác (slug không tồn tại ở niche / session / **coupon-merchant**) đều ra `not-found.tsx` — copy KHÔNG được mâu thuẫn với các trạng thái mới (giữ "đường dẫn không đúng"). (Theo decision B, coupon-merchant lạ KHÔNG còn là ngoại lệ — nó 404 như các loại khác.)
5. **Status code & redirect type đúng**: redirect niche INACTIVE → coming-soon dùng `redirect()` mặc định (**307 tạm thời**, KHÔNG permanent/308 — niche có thể ACTIVE sau, không được để CDN/cache đóng băng). Trang empty/expired trả **HTTP 200** (không phải 404) nhưng đã `noindex` để tránh soft-404 SEO.
6. **Đo được ngõ cụt (instrumentation)**: mỗi lần rơi vào 1 trong các trạng thái mới (INACTIVE redirect / coupon trống / session hết hạn) phải phát 1 tín hiệu đo được (tối thiểu `console.info` có tag, vd `[dead-end] kind=...`) để sau này biết tần suất + tỉ lệ "cứu" được thành lead. Input: user hit trạng thái X → Output: 1 log/event có `kind`.

### Edge-case đã chốt (từ rà branch)
- **Coupon-merchant — decision B (đã chốt 2026-06-18)**: `fetchCouponsByMerchant` (qua `/coupons`) trả `[]` cho cả "merchant thật hết mã" lẫn "slug lạ" → KHÔNG đủ để phân biệt. Vì vậy cần **endpoint check tồn tại merchant** (xem Dev Notes). Hành vi: merchant thật + 0 mã active → 200 empty + noindex; slug lạ → `notFound()`. ⟹ **Case 17 áp dụng cho cả coupon-merchant** (slug lạ → 404 như niche/session). Đánh đổi: tốn 1 API call check tồn tại trên đường này, nhưng chặn được vô hạn URL hợp lệ.
- **Không loop redirect**: `/categories/<x>` → `/coming-soon/<x>` chỉ khi niche null (INACTIVE); `/coming-soon/<x>` → `/categories/<x>` chỉ khi meta ACTIVE. Một niche không thể đồng thời INACTIVE-ở-categories và ACTIVE-ở-coming-soon trong cùng request ⟹ không vòng lặp (chỉ race hiếm khi admin flip status giữa 2 fetch — tự khỏi ở request sau).

## Elicitation log (2026-06-18)

> ✅ **Đã quyết (2026-06-18): chọn B.** Coupon-merchant 200-empty CHỈ khi merchant tồn tại (có ≥1 Coupon row); slug lạ → `notFound()`. Lý do: chặn vô hạn URL hợp lệ + soft-404 + lãng phí crawl budget. Đánh đổi (chấp nhận): thêm 1 API call check tồn tại. Đã fold vào AC #2, #4, Edge-case, Dev Notes, Task 2.

- **Inversion Analysis** — hỏi "điều gì *đảm bảo* user vẫn mất niềm tin?": (1) copy empty/expired trùng giọng 404 → thêm yêu cầu **copy phải khác biệt rõ** (AC #2, #4); (2) ship 1-1 trước khi 1-2 xong → redirect coming-soon lại 404 → nhấn mạnh phụ thuộc + degradation (xem Cascading bên dưới).
- **Pre-mortem Analysis** — giả định đã ship & thất bại: (1) **soft-404 SEO** do trả 200 cho trang mỏng → AC #5 (noindex + status code đúng); (2) **redirect bị cache vĩnh viễn** nếu lỡ dùng 308 → AC #5 chốt 307 tạm; (3) **không đo được** bao nhiêu user rơi ngõ cụt → AC #6 instrumentation.
- **Stakeholder Lens Rotation** — user / Google / admin / business: Google cần status code đúng (AC #5); coming-soon là landing có thật → **được index** (khác trang empty/expired → noindex); business muốn đo "cứu" được bao nhiêu lead (AC #6); admin flip ACTIVE → link coming-soon cũ tự về categories (đã có ở 1-2 AC #3).
- **Cascading Failure Simulation** — 1-1 phụ thuộc `fetchNicheMeta` (1-2): nếu API `/niches/:slug/meta` 500/timeout → `fetchNicheMeta` null → niche INACTIVE bị coi như không tồn tại → `notFound()`. **Degradation chấp nhận được** (lúc API sập thì 404 thay vì coming-soon). ⚠️ **SPOF mới**: đường 404 của `/categories/*` giờ thêm 1 API call → bot quét URL rác tạo **2 call/URL** → khuyến nghị mitigation ở Dev Notes (cache/short-circuit slug rõ ràng không hợp lệ).
- **Second-Order Thinking** — hệ quả bậc 2: (1) chuyển 404→200 khắp nơi làm phình "trang hợp lệ" → **crawl budget** (xem mục ⚠️ quyết định); (2) **không thêm** các trạng thái empty/expired/coming-soon-redirect vào `sitemap.ts`; (3) noindex của coupon-merchant phải **có điều kiện** (`coupons.length===0` tại render-time trong `generateMetadata`) để khi có mã lại tự index — không hardcode noindex cho cả route.

## Tasks / Subtasks

- [x] Task 1: niche INACTIVE branch trên `/categories/[slug]` (AC #1) — phụ thuộc `fetchNicheMeta` (story 1-2).
- [x] Task 2: coupon-merchant (AC #2, decision B) — (a) API endpoint (đã làm ở story 1-2); (b) web `fetchMerchantExists`; (c) merchant thật + 0 mã → empty-state + noindex; (d) slug lạ → `notFound()`.
- [x] Task 3: session/share expired state (AC #3) — component dùng chung `<ExpiredSessionNotice/>`, render từ cả result page và `/r/[shareSlug]`. (Result page vốn đã `noindex,nofollow` ở generateMetadata; share giữ nguyên.)
- [x] Task 4: rà copy not-found vs trạng thái mới (AC #4) — 3 giọng khác nhau: 404 "đường dẫn không đúng" / empty "chưa có mã đang dùng" / expired "phiên gợi ý đã hết hạn".
- [x] Task 5: status code + redirect type (307 mặc định của `redirect()`) + instrumentation `[dead-end] kind=...` (AC #5, #6).
- [x] Task 6: `sitemap.ts` dùng `fetchNiches()` (ACTIVE-only) nên coming-soon/empty/expired KHÔNG lọt sitemap — không cần sửa. API call thêm chỉ chạy trên đường miss (Cascading mitigation đã thoả).

## Dev Notes

- **Mirror**: empty-state dùng component có sẵn [components/ui/empty-state.tsx](../../apps/web/components/ui/empty-state.tsx) (đang dùng ở niche/home). `redirect`/`notFound` từ `next/navigation`. `generateMetadata` + `robots:{index:false}` theo pattern đã có ở [categories/[slug]/[productSlug]/page.tsx:31](../../apps/web/app/categories/[slug]/[productSlug]/page.tsx).
- **Phụ thuộc**: AC #1 cần `fetchNicheMeta` của story 1-2 → dev story 1-2 trước.
- **API mới cho decision B (AC #2)** → **đã gộp vào story 1-2 (AC #5)**: `GET /coupons/merchants/:slug` trả `{ slug, display, exists }`, `exists` đếm MỌI coupon (KHÔNG lọc `isActive`/`expiresAt`). Web `fetchMerchantExists(slug)`. ⟹ dev story **1-2 trước** rồi mới tới 1-1 (1-1 phụ thuộc cả `fetchNicheMeta` lẫn `fetchMerchantExists`). Red test API: `coupons.controller.merchant.spec.ts`.
- **Không** đổi HITL/API; chỉ đổi cách web render khi data rỗng.
- **ISR**: các trang này có `revalidate` (niche 300, coupon 1800) — empty-state vẫn nằm trong cùng page, không cần đổi revalidate.
- **Mitigation SPOF (từ Cascading)**: đường 404 của `/categories/*` giờ gọi thêm `fetchNicheMeta`. Để bot quét URL rác không nhân đôi tải API: chỉ gọi `fetchNicheMeta` khi `fetchNicheBySlug` null (đúng như AC #1, đã là 1 call thêm chỉ trên miss), và dựa vào ISR/cache của Next cho các slug lặp. Không thêm vòng fetch nào khác trên đường này.
- **sitemap**: KHÔNG thêm coming-soon-redirect / empty / expired vào [app/sitemap.ts](../../apps/web/app/sitemap.ts) (chỉ niche/product/blog/coupon thật mới vào sitemap).

### Project Structure Notes
- `apps/web/app/categories/[slug]/page.tsx`, `apps/web/app/khuyen-mai/[merchantSlug]/page.tsx`, `apps/web/app/ai/[slug]/result/[sessionId]/page.tsx`, `apps/web/app/r/[shareSlug]/page.tsx`, có thể thêm `apps/web/components/storefront/expired-session-notice.tsx`.

### References
- [Source: apps/web/app/categories/[slug]/page.tsx#L93]
- [Source: apps/web/app/khuyen-mai/[merchantSlug]/page.tsx#L28]
- [Source: docs/CONTEXT.md] (lý do trust là non-negotiable)

## Dev Agent Record
### Agent Model Used
claude-opus-4-8[1m]
### Completion Notes List
- Task 1: `/categories/[slug]` khi `fetchNicheBySlug` null → gọi `fetchNicheMeta` (chỉ trên miss); INACTIVE → `redirect("/coming-soon/<slug>")` (307), không tồn tại → `notFound()`. Log `[dead-end] kind=niche-inactive`.
- Task 2 (decision B): `/khuyen-mai/[merchantSlug]` 0 mã active → `fetchMerchantExists`; merchant thật → EmptyState "chưa có mã" (200) + `generateMetadata` noindex có điều kiện; slug lạ → `notFound()`. Log `[dead-end] kind=coupon-merchant-empty`.
- Task 3: `ExpiredSessionNotice` mới; result page session null → notice (CTA `/ai/<slug>`), share null → notice (CTA `/`). Log `[dead-end] kind=session-expired|share-expired`. Slug-mismatch ở result vẫn `notFound()` (URL sai thật).
- Task 4-6: 3 giọng copy phân biệt; redirect 307 mặc định; sitemap không đụng (ACTIVE-only đã loại).
- Phụ thuộc story 1-2 (đã ở review): `fetchNicheMeta` + `fetchMerchantExists` + 2 endpoint API.
- Gate: `npm run lint:web` ✓ (chỉ warning `<img>` cũ). Không chạy prod build (preference user dùng dev local) — nên chạy `npm run dev:web` để xác nhận runtime nếu cần.
### File List
- apps/web/app/categories/[slug]/page.tsx (M)
- apps/web/app/khuyen-mai/[merchantSlug]/page.tsx (M)
- apps/web/app/ai/[slug]/result/[sessionId]/page.tsx (M)
- apps/web/app/r/[shareSlug]/page.tsx (M)
- apps/web/components/storefront/expired-session-notice.tsx (A)
- apps/web/components/storefront/merchant-no-coupons-notice.tsx (A, code-review #8)
- apps/web/lib/dead-end.ts (A, code-review #8 — logDeadEnd typed)

### Change Log
- 2026-06-18: Implement story 1-1 (niche INACTIVE→coming-soon, coupon-merchant decision B, session/share expired notice, 307+instrumentation). Status → review.
- 2026-06-18: Apply code-review (high-effort) findings: #1 share-expired `noindex,nofollow`; #2 `fetchMerchantExists` trả null khi API lỗi → degrade "chưa có mã" thay vì 404; #3 coming-soon `noindex` (thin/duplicate); #6 tách `buildCuratedTiles`; #8 `logDeadEnd` typed + tách `<MerchantNoCouponsNotice>`. Lint + 7 test API xanh.
