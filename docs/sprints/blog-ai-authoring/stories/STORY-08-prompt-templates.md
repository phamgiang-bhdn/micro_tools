# STORY-08 — Update prompt templates

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 2h
**Dependencies:** none (làm song song; nhưng STORY-02/03/06 cần template mới để chạy đúng).

## Context

Prompt templates `article-buying-guide` và `article-review` đang lưu trong `PromptTemplate` table (admin Prompt Studio quản lý). Hiện template chưa biết các placeholder mới:
- `{candidatesJson}` (STORY-02)
- `{currentDate}`, `{currentMonthYear}`, `{seasonHint}` (STORY-06)
- `{allowedDomains}` (STORY-03)
- `{pinnedProductIds}` (STORY-01/02)
- `{voiceGuide}` (Iter 2 — placeholder để optional)

Cũng cần rule mới:
- Yêu cầu `selectedProductIds` + `discoveredProducts` trong output.
- Visual rhythm (Iter 2, để placeholder cho rõ).
- Quy tắc thời gian (STORY-06).

## User story

> **As** dev đang triển khai pipeline mới,
> **I want** prompt templates với placeholder và instructions đầy đủ,
> **so that** AI output đúng schema mới (selectedProductIds, discoveredProducts) và bài chất lượng.

## Acceptance criteria

### AC1 — Template `article-buying-guide` mới
Cấu trúc:

```
THỜI ĐIỂM VIẾT: Hôm nay {currentDate} ({currentMonthYear}). {seasonHint}.

NHIỆM VỤ
Viết bài cẩm nang mua hàng tiếng Việt cho topic: "{topic}".
Tool/niche: {toolName} ({toolSlug}).

NGUỒN DỮ LIỆU
Catalog hiện có của shop (đã crawl, giá đã cập nhật):
{candidatesJson}

Sản phẩm admin yêu cầu BẮT BUỘC xuất hiện trong bài:
{pinnedProductsList}

DOMAIN ĐƯỢC PHÉP TRA WEB
Khi cần khám phá sản phẩm mới, CHỈ dùng URL từ các domain sau:
{allowedDomains}

QUY TẮC THỜI GIAN
- Chỉ trích giá/khuyến mãi từ {candidatesJson} (priceUpdatedAt đã ghi).
- KHÔNG suy diễn giá từ ký ức.
- KHÔNG nhắc "ra mắt năm 20XX" trừ khi có trong specs.
- KHÔNG dùng "năm nay/năm ngoái" — luôn năm cụ thể.

QUY TẮC SẢN PHẨM
1. Đọc {candidatesJson}. Shortlist 4-6 sản phẩm phù hợp nhất với topic. Đưa ID vào field "selectedProductIds".
2. {pinnedProductsList} BẮT BUỘC nằm trong shortlist (nếu có).
3. Nếu catalog không đủ angle (vd thiếu phân khúc giá rẻ / cao cấp / model mới), TRA WEB Google Search để bổ sung. Mỗi sản phẩm khám phá thêm phải:
   - Có sourceUrl thật (từ search result), thuộc {allowedDomains}.
   - Có name chính xác như trên trang.
   - Có reason ngắn (1 câu) — vì sao đưa vào bài.
   - KHÔNG bịa, KHÔNG suy diễn.
4. Tổng sản phẩm trong bài: 4-8.
5. Trong blocks, tham chiếu sản phẩm cũ bằng UUID từ {candidatesJson}, sản phẩm mới bằng placeholder "discovered:0", "discovered:1"...

CẤU TRÚC BÀI (3-15 blocks, dùng đa dạng type, KHÔNG hai prose liên tiếp)
- Mở: hero_quote HOẶC callout(info) — hook người đọc.
- TLDR/Tóm tắt: callout(tip) HOẶC prose ngắn — 3-5 ý chính.
- Tiêu chí chọn: criteria_grid với 4-6 tiêu chí.
- Top sản phẩm: product_spotlight cho mỗi pick (có angle, pros, cons).
- So sánh: comparison block với productIds (2-4 sản phẩm).
- FAQ: 3-5 câu hỏi thường gặp.
- Verdict: tóm tắt + "Best for" / "Not for".

VOICE
{voiceGuide}
(Nếu trống: giọng thân thiện, dùng "mình/bạn", dẫn ví dụ thực tế người Việt.)

OUTPUT
Trả JSON đúng schema:
{
  "title": "...",
  "slug": "kebab-case",
  "excerpt": "...",
  "metaTitle": "...",
  "metaDescription": "...",
  "selectedProductIds": ["uuid1", "uuid2", ...],
  "discoveredProducts": [
    { "name": "...", "sourceUrl": "https://...", "reason": "...", "brand": "?", "estimatedPriceVnd": 12345 }
  ],
  "blocks": [...]
}
```

### AC2 — Template `article-review` mới
Tương tự nhưng:
- 1 sản phẩm chính (từ `productRef` của admin).
- Có thể `discoveredProducts` 1-3 sản phẩm để so sánh đối thủ.
- Cấu trúc bài: hands-on intro → spec table (Iter 2) → trải nghiệm thực tế → pros_cons → comparison với đối thủ → verdict.
- Voice: cá nhân hơn, "mình đã dùng", "trong 2 tuần thử nghiệm".

### AC3 — Migration seed
- Update [`prisma/seed.js`] hoặc tạo migration data riêng (seed-prompts.js) cập nhật 2 row `PromptTemplate` với content mới.
- Bump `version`, set `isActive = true`, deactivate version cũ.
- Idempotent: chạy nhiều lần không gây trùng.

### AC4 — Admin Prompt Studio test
- Vào `/admin/prompts` → thấy template mới.
- Test gen bài thử với template mới → output có `selectedProductIds` + `discoveredProducts`.

### AC5 — Backup template cũ
- Trước khi deactivate, đảm bảo `PromptTemplate` cũ vẫn còn (cùng `name`, `version` thấp hơn, `isActive = false`). Có thể revert nếu template mới hỏng.

## Technical breakdown

### File mới
- `apps/api/prisma/seed-prompts-v2.js` — script update prompts (chạy được tay).

### Cách chạy
```bash
node apps/api/prisma/seed-prompts-v2.js
```

Hoặc gắn vào `apps/api/prisma/seed.js` (kiểm tra version trước khi insert).

### Test plan
1. Chạy seed → check `PromptTemplate` table có 2 row mới active, 2 row cũ inactive.
2. Tạo bài thử qua admin UI → response output có schema mới.
3. Validate với zod schema từ STORY-02 → pass.

## Definition of Done

- [ ] 2 template `article-buying-guide` v2 + `article-review` v2 active trong DB.
- [ ] Gen bài test cho mỗi type → output có đủ field schema mới.
- [ ] Template cũ vẫn còn (inactive) để revert nếu cần.
- [ ] Script seed idempotent (chạy 2 lần không tạo duplicate).

## Out of scope

- Visual rhythm hard constraint trong template (Iter 2 sẽ ép qua zod + retry).
- Voice guide content cho từng tool (Iter 2 — STORY-10).
- Multi-language template (chỉ tiếng Việt).
- A/B test prompt versions (chưa cần ở scale này).
