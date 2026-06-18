# Story 1.4: Distinguish empty vs error (rỗng-vì-đang-xây ≠ rỗng-vì-lỗi-tải)

Status: ready-for-dev

## Story

As a **người dùng tới một trang đang trống dữ liệu**,
I want **biết là "đang cập nhật" hay "lỗi tải, thử lại"**,
so that **tôi quyết định đúng: chờ quay lại hay refresh/thử lại — thay vì rời đi vì tưởng site chết**.

## Bối cảnh (đã verify)

- Pattern tốt đã có: home `fetchNiches()` trả `{ niches, loadError }` ([apps/web/lib/api.ts:100](../../apps/web/lib/api.ts)) và home phân biệt `loadError ? "Hệ thống đang bảo trì" : "Đang cập nhật deal mới"` ([apps/web/app/page.tsx:52,123](../../apps/web/app/page.tsx)). **Đây là pattern cần nhân rộng.**
- Các helper khác nuốt lỗi → `[]`/`null` giống hệt "không có data":
  - `fetchAllProductsFlat` ([lib/api.ts:294](../../apps/web/lib/api.ts)) — `fetchNicheBySlug` lỗi → niche bị filter mất, không tín hiệu.
  - AI result fetch product ([apps/web/app/ai/[slug]/result/[sessionId]/page.tsx:34-44, 98-106](../../apps/web/app/ai/[slug]/result/[sessionId]/page.tsx)) — 0 product có thể do quiz-không-match HOẶC API lỗi, cùng 1 message.
  - deal-hot ([apps/web/app/deal-hot/[date]/page.tsx](../../apps/web/app/deal-hot/[date]/page.tsx)) và coupon index ([apps/web/app/khuyen-mai/page.tsx](../../apps/web/app/khuyen-mai/page.tsx)) — empty và error đổ đồng.

## Acceptance Criteria

1. **AI result phân biệt**: trang result render 3 trạng thái khác nhau:
   - product fetch lỗi (API ném) → "Không tải được gợi ý, thử lại" + nút thử lại. (Input: fetch throw → Output: error state, KHÔNG phải "không tìm thấy sản phẩm".)
   - fetch OK nhưng 0 match → "Chưa có sản phẩm khớp nhu cầu" + làm lại quiz. (Input: API trả [] hợp lệ → Output: no-match state.)
   - có product → render bình thường.
2. **deal-hot phân biệt**: ngày hợp lệ nhưng 0 deal:
   - fetch lỗi → error state "Không tải được deal" + thử lại. (Input: helper throw → Output: error.)
   - fetch OK, 0 deal có discount → "Chưa có deal hot ngày này" (giữ copy hiện có) + link ngày khác. (Input: [] hợp lệ → Output: empty.)
3. **coupon index phân biệt**: tương tự — lỗi tải vs "chưa có mã active".
4. **Pattern nhất quán**: dùng cùng shape `{ data, loadError }` (như `FetchNichesResult`) cho các helper được sửa, KHÔNG mỗi nơi một kiểu. Component đọc `loadError` để chọn copy.

### Edge-case đã chốt (từ rà branch)
- **Partial failure ở AI result**: result page fetch nhiều niche (`Promise.all`, [result/.../page.tsx:34-44](../../apps/web/app/ai/[slug]/result/[sessionId]/page.tsx)). Quy ước: nếu **một phần** fetch lỗi nhưng vẫn còn ≥1 product hợp lệ → render phần có được (KHÔNG chặn bằng error-state); chỉ vào error-state khi **toàn bộ** nguồn lỗi và tập kết quả rỗng. Tránh "1 niche lỗi làm hỏng cả trang gợi ý".
- **`loadError` là boolean/message, không phải mã lỗi**: copy hiển thị cho user phải generic ("Không tải được, thử lại"), KHÔNG render `error.message` kỹ thuật (giống bài học ở `app/error.tsx`).

## Tasks / Subtasks

- [ ] Task 1: mở rộng helper trả `{ data, loadError }` cho các nguồn AI-result/deal-hot/coupon (mirror `FetchNichesResult`) (AC #4).
- [ ] Task 2: AI result 3-state (AC #1).
- [ ] Task 3: deal-hot 2-state (AC #2).
- [ ] Task 4: coupon index 2-state (AC #3).

## Dev Notes

- **Mirror**: copy đúng shape `FetchNichesResult = { niches, loadError }` ([lib/api.ts:95](../../apps/web/lib/api.ts)) và cách home tiêu thụ ([page.tsx:52-68](../../apps/web/app/page.tsx)). Empty-state component: [components/ui/empty-state.tsx](../../apps/web/components/ui/empty-state.tsx) (đã có `tone="warning"`; cân nhắc `tone="error"` nếu chưa có — kiểm tra prop hiện hữu trước khi thêm).
- **safeFetch** ([lib/api.ts:6](../../apps/web/lib/api.ts)) ném khi `!response.ok` — đây là điểm bắt để set `loadError`. KHÔNG đổi `safeFetch` (giữ throw); chỉ đổi các wrapper public.
- **KHÔNG** đổi `cache: "no-store"` / ISR `revalidate` (per apps/web/CLAUDE.md: freshness control ở page level).
- Phạm vi: chỉ tách empty-vs-error ở 3 surface nêu trên. Không refactor toàn bộ lib trong story này.

### Project Structure Notes
- `apps/web/lib/api.ts`, `apps/web/app/ai/[slug]/result/[sessionId]/page.tsx`, `apps/web/app/deal-hot/[date]/page.tsx`, `apps/web/app/khuyen-mai/page.tsx`.

### References
- [Source: apps/web/lib/api.ts#fetchNiches] (pattern chuẩn)
- [Source: apps/web/app/page.tsx#L52-L138]

## Dev Agent Record
### Agent Model Used
### Completion Notes List
### File List
