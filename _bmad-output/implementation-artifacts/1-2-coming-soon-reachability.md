---
baseline_commit: 11672ea13c77654381031c7a0b62be07adf65720
---
# Story 1.2: Coming-soon reachability + curated routing

Status: review

## Story

As a **người dùng vào danh mục chưa ra mắt**,
I want **thấy trang "Sắp ra mắt" của danh mục đó (kèm form chờ) thay vì 404**,
so that **tôi tin là tính năng đang tới và để lại email, thay vì nghĩ link hỏng**.

## Bối cảnh (đã verify)

- `GET /niches/:slug` ([apps/api/src/modules/niches/niches.controller.ts:46](../../apps/api/src/modules/niches/niches.controller.ts)) throw 404 khi `!niche || niche.status !== "ACTIVE"`. Vì vậy `fetchNicheBySlug` ([apps/web/lib/api.ts:111](../../apps/web/lib/api.ts)) trả `null` cho cả niche INACTIVE lẫn không tồn tại → `/coming-soon/[slug]` ([apps/web/app/coming-soon/[slug]/page.tsx:47](../../apps/web/app/coming-soon/[slug]/page.tsx)) gọi `notFound()`. Trang coming-soon hiện CHỈ render được cho niche ACTIVE — sai đối tượng.
- Home curated grid ([apps/web/app/page.tsx:35-38, 82](../../apps/web/app/page.tsx)) dùng `CURATED_NICHES` (hardcode, xem [apps/web/lib/curated-niches.ts](../../apps/web/lib/curated-niches.ts)) → tile trỏ `/categories/<slug>`; nếu slug đó INACTIVE → 404.

## Acceptance Criteria

1. **API status-only endpoint**: thêm `GET /niches/:slug/meta` (hoặc mở rộng response) trả `{ slug, name, status }` cho **mọi** niche tồn tại (kể cả INACTIVE), **không** include `products`/`scrapedData`.
   - Input: slug của niche INACTIVE tồn tại → Output: `200 { slug, name, status: "INACTIVE" }`.
   - Input: slug ACTIVE → Output: `200 { ..., status: "ACTIVE" }`.
   - Input: slug không tồn tại → Output: `404`.
   - HITL invariant: response KHÔNG chứa bất kỳ product/scrapedData nào (test khẳng định không có key `products`).
2. **Web lib**: thêm `fetchNicheMeta(slug)` trong [lib/api.ts](../../apps/web/lib/api.ts) mirror đúng pattern `fetchNicheBySlug` (try/catch → `null` khi lỗi/404). Trả `{ slug, name, status } | null`.
3. **Coming-soon render INACTIVE**: `/coming-soon/[slug]` dùng `fetchNicheMeta`:
   - niche INACTIVE → render trang coming-soon với `nicheName` thật (Output: 200, có form chờ).
   - niche ACTIVE → `redirect("/categories/<slug>")` (đã ra mắt thì đưa vào trang thật, không kẹt ở coming-soon).
   - slug không tồn tại → `notFound()` (giữ nguyên).
4. **Curated routing**: tile trong curated grid trỏ niche INACTIVE → href `/coming-soon/<slug>`; niche ACTIVE → `/categories/<slug>`. Quyết định dựa trên việc slug có trong list `fetchNiches()` (ACTIVE) hay không — không thêm round-trip per-tile.
   - Input: curated slug không nằm trong active niches → Output: link `/coming-soon/<slug>`.
   - Input: curated slug nằm trong active niches → Output: link `/categories/<slug>`.
5. **API coupon-merchant exists endpoint** (phục vụ story 1-1 decision B — gom vào đây vì cùng họ "meta/exists endpoint", làm API 1 lượt): thêm `GET /coupons/merchants/:slug` trả `{ slug, display, exists }`.
   - Input: slug có ≥1 coupon (KỂ CẢ inactive/expired) → Output: `200 { slug, exists: true, display }`.
   - Input: slug 0 coupon → Output: `200 { slug, exists: false, display: null }`.
   - ⚠️ **Correctness then-chốt**: query đếm tồn tại **KHÔNG** được kèm `isActive`/`expiresAt` — nếu lọc active sẽ báo "không tồn tại" nhầm cho merchant thật đang tạm hết mã (→ 404 oan ở story 1-1).
   - Web: thêm `fetchMerchantExists(slug)` trong [lib/api.ts](../../apps/web/lib/api.ts) mirror `fetchCouponsByMerchant` (try/catch → `{exists:false}` khi lỗi).

## Tasks / Subtasks

- [x] Task 1: API meta endpoint (AC #1)
  - [x] Thêm handler `@Get(":slug/meta")` trong `niches.controller.ts`, `select: { slug, name, status }`, 404 nếu không có row.
  - [x] Đặt route TRƯỚC `@Get(":slug")` hoặc dùng path phân biệt để Nest không match nhầm.
- [x] Task 2: web lib `fetchNicheMeta` (AC #2)
- [x] Task 3: coming-soon dùng meta + redirect ACTIVE (AC #3)
- [x] Task 4: curated grid routing theo status (AC #4) — sửa nơi build `curatedTiles` ([page.tsx:35](../../apps/web/app/page.tsx)) và component `CuratedNicheGrid`.
- [x] Task 5: coupon-merchant exists endpoint (AC #5) — `@Get("merchants/:slug")` trong [coupons.controller.ts](../../apps/api/src/modules/coupons/coupons.controller.ts) dùng `findFirst({ where: { merchantSlug }, select: { merchantDisplay: true } })`; web `fetchMerchantExists`. (Red test API đã có: `coupons.controller.merchant.spec.ts`.)

## Dev Notes

- **Mirror**: endpoint mới theo đúng style `getNicheBySlug` (try/catch, `HttpException(NOT_FOUND)`), inject `PrismaService`. `fetchNicheMeta` mirror `fetchNicheBySlug` ([lib/api.ts:111](../../apps/web/lib/api.ts)).
- **HITL gate**: tuyệt đối không trả product trong endpoint meta — chỉ slug/name/status. Đây là điểm review chính.
- **RSC**: coming-soon + home đều là server component; `redirect` từ `next/navigation`.
- **Không** đổi `GET /niches` (vẫn ACTIVE-only) và không đổi `GET /niches/:slug` (vẫn 404 INACTIVE để bảo vệ product/SEO).

### Edge-case đã chốt (từ rà branch)
- **Nest route ordering**: `:slug` chỉ match 1 segment nên `/niches/foo/meta` không bị `@Get(":slug")` nuốt; vẫn nên khai báo `@Get(":slug/meta")` để rõ ràng. Test bằng request thật (e2e) là phần web — ở API chỉ unit test method.
- **Lộ tên niche INACTIVE (roadmap)**: endpoint meta sẽ tiết lộ tên các niche chưa ra mắt nếu ai đoán slug. Chấp nhận: trang `/coming-soon` vốn đã công khai chúng (mục đích thu waitlist). KHÔNG trả thêm field nào ngoài slug/name/status.
- **Endpoint là PUBLIC, không auth** (giống các `/niches*` khác) — KHÔNG thêm `x-admin-*`.

### Project Structure Notes
- API: `apps/api/src/modules/niches/niches.controller.ts`. Web: `apps/web/lib/api.ts`, `apps/web/app/coming-soon/[slug]/page.tsx`, `apps/web/app/page.tsx`, `apps/web/components/storefront/curated-niche-grid.tsx`.

### References
- [Source: apps/api/src/modules/niches/niches.controller.ts]
- [Source: apps/web/lib/api.ts#fetchNicheBySlug]
- [Source: docs/project-context.md#Invariants]

## Dev Agent Record
### Agent Model Used
claude-opus-4-8[1m]
### Completion Notes List
- API: thêm `GET /niches/:slug/meta` (getNicheMeta, select slug/name/status, 404 nếu null, HITL không lộ products) + `GET /coupons/merchants/:slug` (getMerchantExists, `findFirst` đếm MỌI coupon — KHÔNG lọc isActive/expiresAt).
- Web: `fetchNicheMeta` + `fetchMerchantExists` (fail → null / exists:false). Coming-soon dùng meta: slug lạ → notFound, ACTIVE → redirect `/categories`, INACTIVE → render. Curated grid routing theo status ở cả 2 call-site (home + niche-empty fallback).
- 7 red test API (niches.controller.meta + coupons.controller.merchant) → **xanh hết** sau implement.
- Gate: `npm run test:api` (7/7 pass), `npm run lint:web` (✓, chỉ warning `<img>` cũ). Không chạy prod build (theo preference user dùng dev local).
### File List
- apps/api/src/modules/niches/niches.controller.ts (M)
- apps/api/src/modules/coupons/coupons.controller.ts (M)
- apps/web/lib/api.ts (M)
- apps/web/app/coming-soon/[slug]/page.tsx (M)
- apps/web/components/storefront/curated-niche-grid.tsx (M)
- apps/web/app/page.tsx (M)
- apps/web/app/categories/[slug]/page.tsx (M)
- apps/api/src/modules/niches/niches.controller.meta.spec.ts (A, từ story-ready)
- apps/api/src/modules/coupons/coupons.controller.merchant.spec.ts (A, từ story-ready)

### Change Log
- 2026-06-18: Implement story 1-2 (2 endpoint API meta/exists + web wiring + curated routing). Status → review.
- 2026-06-18: Apply code-review findings: #4 khuyen-mai dùng `React.cache` 1 fetch chung (noindex + render không lệch); #5 coming-soon `React.cache` dedup `fetchNicheMeta`; #6 `buildCuratedTiles` + `CuratedNicheTile` chuyển vào `lib/curated-niches.ts`; #7 `getMerchantExists` thêm `orderBy merchantDisplay nulls:last` (display deterministic).
