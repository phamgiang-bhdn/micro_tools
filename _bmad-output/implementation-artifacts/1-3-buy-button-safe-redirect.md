# Story 1.3: Buy-button safe redirect (đường tiền không im lặng thất bại)

Status: ready-for-dev

## Story

As a **người dùng bấm "Mua ngay" trên trang sản phẩm**,
I want **luôn được chuyển sang sàn, hoặc thấy thông báo rõ nếu link đang lỗi**,
so that **tôi không bị kẹt im lặng (bấm xong không có gì xảy ra) và mất niềm tin**.

## Bối cảnh (đã verify)

- `buyAction` trong [apps/web/components/product-detail-view.tsx:56-63](../../apps/web/components/product-detail-view.tsx) gọi `createTrackingRedirect({...})` rồi `redirect(tracked.finalUrl)` **không guard**.
- `createTrackingRedirect` ([apps/web/app/actions/tracking.ts:74-76](../../apps/web/app/actions/tracking.ts)) trả `{ trackingCode:"", finalUrl:"" }` khi `affiliateUrl` rỗng → `buyAction` gọi `redirect("")` → lỗi runtime (bong lên `app/error.tsx`), không phải UX có chủ đích.
- Wrapper anh em `trackAndRedirectAction` ([tracking.ts:37](../../apps/web/app/actions/tracking.ts)) ĐÃ guard `if (!tracked.finalUrl) return;` — `buyAction` cần đối xử nhất quán nhưng phải có phản hồi cho user (return rỗng sẽ "im lặng").
- Fallback timeout/non-ok ([tracking.ts:123-145](../../apps/web/app/actions/tracking.ts)) đã trả `finalUrl = affiliateUrl + sub1` → vẫn redirect được, KHÔNG nằm trong scope sửa (đã đúng, chỉ mất attribution row — chấp nhận).

## Acceptance Criteria

1. **affiliateUrl rỗng → không `redirect("")`**: khi `tracked.finalUrl` rỗng, `buyAction` KHÔNG gọi `redirect("")`. Thay vào đó đưa user tới trạng thái lỗi rõ ràng.
   - Input: product có `affiliateUrl` rỗng/null, user submit form → Output: không có runtime redirect-empty; user thấy thông báo "Link mua đang lỗi, thử lại sau" (hoặc redirect về trang sản phẩm với query `?buy=error` để render banner).
2. **Happy path không đổi**: `affiliateUrl` hợp lệ → vẫn `redirect(finalUrl)` với `utm_source=<32 hex>` + `sub1=<channel>` y như hiện tại (trackingCode round-trip không đổi).
   - Input: affiliateUrl hợp lệ → Output: redirect tới URL có `utm_source` 32 ký tự không dấu gạch.
3. **Phòng thủ tại nguồn (tùy chọn, cùng PR)**: cân nhắc để `createTrackingRedirect` ném/đánh dấu lỗi rõ ràng thay vì trả `finalUrl:""` mơ hồ — nhưng KHÔNG đổi shape `TrackingResult` đang được `trackAndRedirectAction` dùng (giữ tương thích). Nếu đổi, cập nhật cả 2 call-site.
4. **Sticky mobile CTA đồng bộ**: form sticky ([product-detail-view.tsx:273](../../apps/web/components/product-detail-view.tsx)) dùng cùng `buyAction` → tự hưởng fix, không có nhánh xử lý riêng bị bỏ sót.

### Edge-case đã chốt (từ rà branch)
- **affiliateUrl chỉ có whitespace** (`" "`): `!input.affiliateUrl` không bắt được (whitespace truthy) → `new URL(" ")` throw → catch trả raw → redirect rác. Guard phải dùng `affiliateUrl.trim()` (hoặc kiểm tra ở cả `createTrackingRedirect` lẫn `buyAction`).
- **Redirect báo lỗi cần URL trang sản phẩm**: `buyAction` đang là closure có `niche.slug` + `productRaw.slug`/`product.id` → dựng được `/categories/<niche.slug>/<slug ?? id>?buy=error` để quay lại render banner. Đảm bảo dùng `product.slug ?? product.id` (fallback id như route đang hỗ trợ).

## Tasks / Subtasks

- [ ] Task 1: guard `finalUrl` rỗng trong `buyAction` (AC #1, #4).
- [ ] Task 2: cơ chế báo lỗi cho user (banner qua searchParam hoặc trang lỗi nhẹ) (AC #1).
- [ ] Task 3: (tùy chọn) làm rõ tín hiệu lỗi ở `createTrackingRedirect` mà không phá `TrackingResult` (AC #3) — nếu làm, sửa cả `trackAndRedirectAction`.
- [ ] Task 4: kiểm tra không hồi quy round-trip trackingCode (AC #2).

## Dev Notes

- **Invariant trackingCode**: KHÔNG đổi `randomUUID().replace(/-/g,"")`, không đổi thứ tự append `utm_source`/`sub1`, không đổi round-trip click→ClickLog. Chỉ thêm guard.
- **Mirror**: guard theo đúng cách `trackAndRedirectAction` đã làm (`if (!tracked.finalUrl) ...`), nhưng thêm phản hồi UX thay vì `return` câm.
- **Server action**: `buyAction` là inline `"use server"` trong component RSC — giữ nguyên vị trí, không tách file (mirror cấu trúc hiện có).
- **Lưu ý Next**: `redirect()` ném `NEXT_REDIRECT` (bình thường). Đừng bọc `redirect` trong try/catch nuốt lỗi.

### Project Structure Notes
- `apps/web/components/product-detail-view.tsx`, `apps/web/app/actions/tracking.ts`.

### References
- [Source: apps/web/components/product-detail-view.tsx#L56-L63]
- [Source: apps/web/app/actions/tracking.ts#L74-L76]
- [Source: apps/web/CLAUDE.md#Server-actions] (không refactor token shape)

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
