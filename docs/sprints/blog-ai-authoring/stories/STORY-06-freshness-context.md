# STORY-06 — Freshness context cho AI

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 1.5h
**Dependencies:** none (làm song song với STORY-01).

## Context

Gemini 2.0 training cutoff cách đây cả năm. Nếu prompt không cấp ngày hiện tại + data tươi, AI viết theo trí nhớ cũ — nhắc model 2022-2023, giá lỗi thời, mùa lệch (viết bài tháng 5 mà nói "deal Tết"). Hôm nay 2026-05-15 mà bài nói "vào cuối năm 2024..." là gãy SEO.

## User story

> **As** admin DealVault,
> **I want** AI biết hôm nay là ngày nào, mùa nào, dữ liệu sản phẩm cập nhật bao giờ,
> **so that** bài viết luôn nói chuyện đúng thời điểm, không nhắc tin cũ.

## Acceptance criteria

### AC1 — Inject `currentDate` vào prompt
- Placeholder `{currentDate}` trong template → format `YYYY-MM-DD`.
- Placeholder `{currentMonthYear}` → vd "tháng 5/2026".

### AC2 — Inject `seasonHint`
- Function `getSeasonHint(date)` trả về context tiếng Việt theo tháng:
  - Tháng 1-2: "cận Tết Nguyên Đán, nhu cầu dọn nhà tăng cao"
  - Tháng 3-4: "đầu năm, mùa mưa miền Nam bắt đầu, độ ẩm cao"
  - Tháng 5-6: "vào hè, nắng nóng, cần làm mát không khí"
  - Tháng 7-8: "mùa mưa miền Bắc + nhập học, lễ 2/9"
  - Tháng 9: "cuối hè, deal back-to-school"
  - Tháng 10: "đầu mùa khô miền Nam, ô nhiễm không khí tăng (HN)"
  - Tháng 11: "Black Friday + sale 11.11"
  - Tháng 12: "cuối năm, sale 12.12 + Tết Dương"
- Placeholder `{seasonHint}` trong template.

### AC3 — Inject `priceUpdatedAt`, `crawledAt` per candidate
- Mỗi item trong `{candidatesJson}` (xem STORY-02) include 2 field:
  - `crawledAt`: ISO date — `Product.updatedAt` hoặc `ProductExtraction.updatedAt` mới nhất.
  - `priceUpdatedAt`: ISO date — nếu `scrapedData.priceUpdatedAt` có thì dùng, không thì = crawledAt.

### AC4 — Prompt instruction nghiêm
- Section mới trong template (STORY-08 sẽ làm thực tế):
  ```
  THỜI ĐIỂM VIẾT: Hôm nay là {currentDate} ({currentMonthYear}). {seasonHint}.

  QUY TẮC THỜI GIAN:
  - Chỉ trích dẫn giá/khuyến mãi từ dữ liệu cung cấp dưới đây (đã cập nhật {currentDate}).
  - KHÔNG tự suy diễn giá từ ký ức (giá biến động hàng tuần).
  - KHÔNG nhắc "ra mắt năm 20XX" trừ khi có trong specs.
  - KHÔNG dùng cụm "năm nay", "năm ngoái" — luôn dùng năm cụ thể.
  - Nếu nhắc xu hướng/sự kiện, đảm bảo nó phù hợp với {currentMonthYear}.
  ```

### AC5 — Validator hậu kiểm freshness
- Sau khi parse output, scan `body + blocks` tìm:
  - Regex năm `(20\d{2})`. Mọi năm tìm thấy phải ∈ `[currentYear-1, currentYear]` (cho phép nói "từ 2025" trong bài 2026).
  - Nếu có năm `<= currentYear - 2` → log warning + retry 1 lần với prompt nhấn mạnh.
- Sau retry vẫn fail → vẫn save (đừng chặn), log error.

### AC6 — Helper functions
- File mới: `apps/api/src/services/article/freshness.ts` (hoặc inline trong `article.service.ts`).
- Export:
  - `getCurrentDateInfo()` → `{ date, monthYear, seasonHint, year, month }`.
  - `validateFreshness(text, currentYear)` → `{ ok: boolean, violations: string[] }`.

## Technical breakdown

### Backend (`apps/api/src/services/article.service.ts`)

1. Trước khi build prompt:
   ```ts
   const dateInfo = getCurrentDateInfo();
   const prompt = template
     .replace("{currentDate}", dateInfo.date)
     .replace("{currentMonthYear}", dateInfo.monthYear)
     .replace("{seasonHint}", dateInfo.seasonHint)
     // ...
   ```

2. `buildCandidatesJson` (từ STORY-02) include `crawledAt`, `priceUpdatedAt`.

3. Post-gen:
   ```ts
   const check = validateFreshness(output.body + JSON.stringify(output.blocks), dateInfo.year);
   if (!check.ok && retryCount === 0) {
     // retry với prompt thêm reinforcement
   }
   ```

### Prompt template (STORY-08)

Cập nhật cả `article-buying-guide` và `article-review` với section "THỜI ĐIỂM VIẾT" + "QUY TẮC THỜI GIAN" ở đầu.

## Definition of Done

- [ ] Gen bài random → output không chứa năm `<= 2023` (test với current 2026).
- [ ] Output có dấu vết của seasonHint phù hợp tháng hiện tại (vd tháng 5 → có thể nhắc "vào hè", "nắng nóng").
- [ ] Validator log warning khi phát hiện năm cũ, retry chạy đúng 1 lần.
- [ ] Helper `getCurrentDateInfo()` test bằng manually mock `Date.now()` cho các tháng khác nhau, output season đúng.

## Out of scope

- Auto-refresh bài cũ khi data product đổi giá (sprint sau).
- Hiển thị "Cập nhật: ngày X" trên storefront (đã có publishedAt — đủ cho v1).
- Multi-language season hint (chỉ tiếng Việt).
