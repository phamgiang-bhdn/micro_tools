---
baseline_commit: 02086be
---
# Story 3.2: Lead-capture ở home empty-state — biến "chờ" thành email đăng ký

Status: review

> Nguồn: party-mode + elicit-batch story 3-1 (R3): reframe "Sắp lên kệ" chỉ là băng dán nếu catalog rỗng kéo dài — user quay lại vẫn thấy hứa suông. 3-2 hoàn thiện: khi home không có deal (pre-launch / grid rỗng), thay vì ngõ cụt → **mời để lại email nhận deal đầu tiên** (thu lead). Phụ thuộc nền 3-1 (đã có nhánh empty `!loadError && sorted.length===0` ở `#all-deals`).

## Story

As a **người dùng vào dealvault lúc chưa có deal (giai đoạn pre-launch)**,
I want **để lại email để được báo khi có deal đầu tiên, ngay tại chỗ — không phải đi tìm**,
so that **tôi không rời đi tay trắng, và dealvault giữ được tôi để quay lại khi có hàng**.

## Bối cảnh (đã verify bằng code — hạ tầng SẴN CÓ, không cần backend mới)

**Cơ chế đã wired end-to-end:**
- **Subscriber (email chung — DÙNG CHO STORY NÀY)**: [subscribe-modal.tsx:63](../../apps/web/components/storefront/subscribe-modal.tsx) POST `/api/subscribe` → route [app/api/subscribe/route.ts](../../apps/web/app/api/subscribe/route.ts) proxy `${API_BASE_URL}/subscribers` (body `{email, source, preferredNiches}`). Backend model `Subscriber` + enum `SubscriberStatus` ([schema.prisma:569,576](../../apps/api/prisma/schema.prisma)). **Không per-niche → hợp cho CTA home-level.**
- **WaitlistSignup (per-niche — KHÔNG dùng ở đây, đã có lối khác)**: `submitWaitlistAction` ([app/actions/waitlist.ts:20](../../apps/web/app/actions/waitlist.ts)) + `WaitlistForm` ([coming-soon/[slug]/waitlist-form.tsx](../../apps/web/app/coming-soon/[slug]/waitlist-form.tsx)). Đã capture per-niche qua chip "Sắp lên kệ" → `/coming-soon/<slug>` (story 1-1/1-2). **3-2 KHÔNG đụng để tránh trùng.**

**Điểm gắn (từ story 3-1):** nhánh empty hợp lệ ở `#all-deals`: `{!loadError && sorted.length === 0 ? <EmptyState title="Đang cập nhật deal mới"/> : null}` ([page.tsx](../../apps/web/app/page.tsx)). Đây là nơi đặt lead-capture — **chỉ nhánh empty, KHÔNG nhánh error** (invariant story 1-4 + AI-first 3-1).

**Anti-spam có sẵn để mirror:** `WaitlistForm` dùng `honeypot` field; action waitlist validate email regex + honeypot ([waitlist.ts:21-30](../../apps/web/app/actions/waitlist.ts)). Subscribe inline nên mirror honeypot.

## Phạm vi (SCOPE)

**TRONG scope:**
- Thêm form lead-capture inline vào **home empty-state** (nhánh `!loadError && sorted.length===0` không có query) — tái dùng cơ chế `/api/subscribe` (Subscriber).
- **Tái dùng, đừng reinvent**: tách logic submit dùng chung giữa `subscribe-modal` và form inline (vd `<SubscribeForm>` chia sẻ), thay vì copy fetch/cookie. Nếu tách tốn → tối thiểu mirror đúng `/api/subscribe` + cookie `dv_subscribed`.

**NGOÀI scope:**
- KHÔNG đụng backend (`Subscriber`/`/subscribers` đã có). KHÔNG thêm migration.
- KHÔNG đụng per-niche waitlist / coming-soon (đã hoạt động).
- KHÔNG đụng nhánh error (loadError), AI hero, tracking/HITL/normalizeProduct.
- KHÔNG bắt buộc đăng nhập / không thu thêm PII ngoài email (+ source).

## Acceptance Criteria

> AC đo bằng: presence/structure, grep reuse, lint/build/guards, + visual. Mỗi AC có case lỗi.

1. **CTA lead-capture hiện ở home empty-state (không phải error)** — Verify: khi `!loadError && sorted.length===0` và KHÔNG có query tìm kiếm → trong EmptyState "Đang cập nhật deal mới" có form email "Đăng ký nhận deal đầu tiên". KHÔNG hiện ở nhánh `loadError` (lỗi tải), KHÔNG hiện khi có sản phẩm.
   - Input: 0 product, API OK, không query → Output: form email inline. Input: `loadError` truthy → Output: KHÔNG có form (chỉ thông báo lỗi 3-1). Input: có sản phẩm → Output: KHÔNG có form ở đây.

2. **Submit email hợp lệ → thành công + chống nag lại** — Verify: nhập email đúng định dạng → POST `/api/subscribe` → state "Đã đăng ký, sẽ báo bạn deal đầu tiên" + set cookie `dv_subscribed=1` (mirror subscribe-modal). Lần sau vào → KHÔNG nag form nữa (hiện trạng thái đã đăng ký hoặc ẩn).
   - Input: `a@b.com` → Output: success UI + cookie set; reload → không hiện lại form trống.

3. **Email không hợp lệ → lỗi inline, KHÔNG submit** — Verify: email rỗng/sai định dạng → thông báo "Email không hợp lệ" tại form, KHÔNG gọi `/api/subscribe`. (Validate client mirror regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` như [waitlist.ts:27](../../apps/web/app/actions/waitlist.ts); server cũng validate.)
   - Input: `abc` / rỗng → Output: lỗi inline, 0 request.

4. **Backend fail / mạng lỗi → báo lỗi, GIỮ email đã gõ** — Verify: `/api/subscribe` trả non-ok hoặc throw → state error "Đăng ký lỗi, thử lại sau", KHÔNG mất giá trị email user đã nhập, cho retry.
   - Input: API 502 → Output: error UI + email còn nguyên trong input.

5. **Honeypot chống bot (short-circuit CLIENT-SIDE)** — Verify: form có field honeypot ẩn (mirror `WaitlistForm`); nếu bị điền (bot) → **KHÔNG gọi `/api/subscribe`** (return success giả ngay tại client như [waitlist.ts:21-23](../../apps/web/app/actions/waitlist.ts) `if honeypot.length>0 return {ok:true}`), không chỉ gửi field rồi để backend lo.
   - Input: honeypot có giá trị → Output: 0 request thật, UI "thành công" giả.

6. **Tái dùng — không duplicate logic, KHÔNG phá modal** — Verify (grep): logic submit subscribe (fetch `/api/subscribe` + cookie `dv_subscribed` + honeypot + validate email) dùng CHUNG giữa `subscribe-modal` và form inline (1 component/hàm chia sẻ), KHÔNG copy-paste 2 bản fetch. Nếu tách `<SubscribeForm>` → cả 2 nơi import.
   - ⚠️ **Edge (E1)**: `subscribe-modal` hiện có **niche-picker (`preferredNiches`/`POPULAR_NICHES`)** ([subscribe-modal.tsx](../../apps/web/components/storefront/subscribe-modal.tsx)). Chỉ chia sẻ **lõi email+submit+cookie+honeypot**; modal GIỮ niche-picker (truyền `preferredNiches` xuống form qua prop, hoặc bọc ngoài). Tách form KHÔNG được làm mất tính năng chọn niche của modal. Verify: modal vẫn render + gửi `preferredNiches` như trước.

7. **Không regression** — Verify: `lint:web` ✓; `node apps/web/scripts/design-guards.mjs` 9/9 ✓; `node apps/web/scripts/home-ai-first-guards.mjs` 5/5 ✓ (đặc biệt H4 invariant + H3 lỗi-không-banner-top KHÔNG gãy — form chỉ ở nhánh empty, không phải error). Không đụng tracking/HITL/normalizeProduct/SEO. Home vẫn dynamic do searchParams, đừng làm xấu thêm.

8. **PII & idempotency (repo-risk)** — Verify: email validate server-side (route/action đã có); KHÔNG log email ra client; re-submit cùng email → backend `Subscriber` upsert theo email unique (không tạo trùng — backend lo, chỉ cần không vỡ UI khi trả "đã tồn tại").

## Guard "red test" (thay Jest)

Script: [apps/web/scripts/home-lead-capture-guards.mjs](../../apps/web/scripts/home-lead-capture-guards.mjs). Chạy: `node apps/web/scripts/home-lead-capture-guards.mjs`.
- **Trước dev: 4/4 ĐỎ** (S1-S4). Sau `/bmad-dev-story 3-2`: tất cả XANH.
- Map: S1→AC6/AC5 (subscribe-form chia sẻ + /api/subscribe + honeypot), S2→AC1 (home render form), S3→AC1+invariant (form ở nhánh empty, không nhánh error), S4→AC6 (modal tái dùng form, không duplicate).
- **Phải GIỮ XANH song song**: `design-guards.mjs` 9/9 + `home-ai-first-guards.mjs` 5/5 (đặc biệt **H3/H4** — form KHÔNG được lọt nhánh `loadError`).
- **Không grep được → verify tay**: AC2 (success+cookie), AC3 (validate), AC4 (giữ email khi lỗi), AC7 idempotent, AC1 điều kiện `!query` (form chỉ ở pre-launch empty, KHÔNG ở "không có kết quả tìm kiếm"), E1 (modal niche-picker còn nguyên).

## Tasks / Subtasks

- [x] **Task 1 — Tách `<SubscribeForm>` dùng chung** (AC #6): tạo `subscribe-form.tsx` (email + honeypot + validate regex + POST `/api/subscribe` + cookie `dv_subscribed` + status idle/success/error + useTransition). Lõi chia sẻ.
- [x] **Task 1b — Modal tái dùng** (AC #6, E1): `subscribe-modal` import `<SubscribeForm source="modal_home" preferredNiches={picked}>`, niche-picker truyền qua `children` → GIỮ tính năng chọn niche; gỡ logic submit trùng (onSubmit/submitting/message).
- [x] **Task 2 — Gắn form vào home empty-state** (AC #1): `<SubscribeForm source="home_empty">` trong nhánh `!loadError && sorted.length===0` **và `!query`** ở `#all-deals`. KHÔNG ở nhánh error/search-miss.
- [x] **Task 3 — Trạng thái success/error/validate/honeypot** (AC #2,#3,#4,#5): status idle/success/error, honeypot short-circuit client-side, giữ email khi lỗi, cookie chống nag (useEffect đọc `dv_subscribed`).
- [x] **Task 4 — Gate** (AC #7,#8): `home-lead-capture-guards` 4/4 ✓ · `home-ai-first-guards` 5/5 ✓ (H3/H4 giữ) · `design-guards` 9/9 ✓ · `lint:web` ✓ · `tsc` file-sửa sạch. (Visual → user rà.)

## Dev Notes

- **Tái dùng tối đa**: `WaitlistForm` ([coming-soon/[slug]/waitlist-form.tsx](../../apps/web/app/coming-soon/[slug]/waitlist-form.tsx)) là mẫu UX chuẩn (useTransition + honeypot + status) — mirror cấu trúc, nhưng đổi action sang `/api/subscribe` (Subscriber chung) vì home không gắn 1 niche. ĐỪNG dựng pattern mới.
- **Cookie**: dùng đúng `dv_subscribed` + helper [lib/cookies.ts](../../apps/web/lib/cookies.ts) (`getCookie`/`setCookie`) như subscribe-modal — không tự set document.cookie.
- **Chỉ nhánh empty**: form KHÔNG được lọt vào nhánh `loadError` (sẽ phá thông điệp lỗi 3-1 + gây nhiểu nhầm "đăng ký để sửa lỗi"). Guard `home-ai-first-guards` H3/H4 phải vẫn xanh.
- **Client component**: form cần `useState`/submit → `"use client"`; đặt trong `#all-deals` (đã là RSC) như 1 island, không ép cả page client.
- **Không test web**: verify = lint + guards + visual.

### Project Structure Notes
- Sửa: `apps/web/components/storefront/subscribe-modal.tsx` (tách form), thêm `apps/web/components/storefront/subscribe-form.tsx` (mới, chia sẻ), `apps/web/app/page.tsx` (gắn vào empty-state).
- Giữ nguyên: backend, `/api/subscribe` route, waitlist/coming-soon, AI hero.

### References
- [Source: apps/web/components/storefront/subscribe-modal.tsx#L56-L70] (submit `/api/subscribe` + cookie — logic cần tách dùng chung)
- [Source: apps/web/app/api/subscribe/route.ts] (proxy `/subscribers`)
- [Source: apps/web/app/coming-soon/[slug]/waitlist-form.tsx] (mẫu UX honeypot + useTransition + status để mirror)
- [Source: apps/web/app/page.tsx] (nhánh empty `!loadError && sorted.length===0` — điểm gắn từ story 3-1)
- [Source: apps/api/prisma/schema.prisma#L569-L587] (Subscriber model)
- Phụ thuộc: [[3-1-home-ai-first]] (nền empty-state). Định vị: [[project_design_overhaul_2_1]].

## Dev Agent Record
### Agent Model Used
claude-opus-4-8[1m]

### Completion Notes List
- **AC6+E1 (Task 1,1b)**: tạo `subscribe-form.tsx` — lõi chia sẻ (email + honeypot + validate `EMAIL_RE` + POST `/api/subscribe` + cookie `dv_subscribed` + status). `subscribe-modal` import lại + truyền niche-picker (`POPULAR_NICHES`/`picked`) qua **children** + `preferredNiches={picked}` → **giữ nguyên tính năng chọn niche**; gỡ `onSubmit`/`submitting`/`message` trùng. 1 nguồn fetch duy nhất (guard S4 xanh).
- **AC1 (Task 2)**: `<SubscribeForm source="home_empty">` render trong nhánh `!loadError && sorted.length===0` **và `!query`** ở `#all-deals` ([page.tsx](../../apps/web/app/page.tsx)). KHÔNG ở nhánh `loadError` (S3/H3/H4 xanh), KHÔNG ở "không có kết quả tìm kiếm" (`!query`).
- **AC2 (Task 3)**: email hợp lệ → POST → success "Đã đăng ký — sẽ báo bạn deal đầu tiên" + cookie `dv_subscribed=1`. `useEffect` đọc cookie → đã đăng ký thì hiện luôn trạng thái success (không nag form trống).
- **AC3**: validate `^[^\s@]+@[^\s@]+\.[^\s@]+$` client-side trước POST; sai → "Email không hợp lệ", 0 request. (`noValidate` để dùng validate riêng.)
- **AC4**: `/api/subscribe` lỗi → status error "Đăng ký lỗi, thử lại sau", **giữ email đã gõ** (không reset state) → retry được.
- **AC5**: honeypot field ẩn (`name="company"`, off-screen, `tabIndex=-1`); bị điền → **short-circuit client-side, KHÔNG POST** (mirror waitlist action).
- **AC7**: `home-lead-capture-guards` 4/4 ✓, `home-ai-first-guards` 5/5 ✓ (H3/H4 không gãy — form chỉ ở nhánh empty), `design-guards` 9/9 ✓, `lint:web` ✓, `tsc` file-sửa 0 lỗi.
- **AC8**: email validate cả client (form) lẫn server (route/action có sẵn); không log email; re-submit cùng email → backend `Subscriber` upsert (UI không vỡ).
- **Bất biến**: KHÔNG đụng backend/`/api/subscribe` route, tracking/HITL/normalizeProduct/SEO. Cookie qua `lib/cookies.ts` helper. Home vẫn dynamic do searchParams (không xấu thêm).
- ⚠️ **User rà visual**: empty pre-launch có form · error KHÔNG form · search-miss KHÔNG form · đã-đăng-ký không nag · modal niche-picker còn nguyên.

### File List
- apps/web/components/storefront/subscribe-form.tsx (A) — lõi chia sẻ email+honeypot+submit+cookie
- apps/web/components/storefront/subscribe-modal.tsx (M) — tái dùng SubscribeForm, giữ niche-picker
- apps/web/app/page.tsx (M) — SubscribeForm ở home empty-state (!query, !error)
- _bmad-output/planning-artifacts/implementation-readiness-report-3-2.md (A) — thỏa team-gate
- apps/web/scripts/home-lead-capture-guards.mjs (A, từ /story-ready) — guard regression

### Change Log
- 2026-06-18: Tạo story 3-2 qua /story-ready, grounded vào hạ tầng Subscriber/waitlist thật. Chốt cơ chế Subscriber chung (per-niche đã có). Status → ready-for-dev.
- 2026-06-18: Checkpoint duyệt ("ok") + cơ chế Subscriber chung. Edge-hunt: E1 (chia sẻ form không được phá niche-picker của modal → AC6 siết), E2 (honeypot short-circuit client-side → AC5 siết). Guard `home-lead-capture-guards.mjs` (4/4 ĐỎ). Readiness: PASS.
- 2026-06-18: IMPLEMENT (/bmad-dev-story 3-2). Tách `subscribe-form.tsx` lõi chia sẻ; modal tái dùng (giữ niche-picker); form ở home empty-state (!query/!error); honeypot+validate+giữ-email+cookie. Guards 4/4 + 5/5 + 9/9, lint ✓, tsc sạch. Status → review.
