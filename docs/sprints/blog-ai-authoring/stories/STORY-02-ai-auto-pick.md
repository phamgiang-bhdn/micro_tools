# STORY-02 — AI tự shortlist sản phẩm từ catalog

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 3h
**Dependencies:** STORY-08 (prompt templates) phải merge trước để có template mới.

## Context

Hiện [article.service.ts:110+](apps/api/src/services/article.service.ts#L110) build `productHints` chỉ từ `productIds` admin chọn. AI không thấy product nào khác → không sáng tạo, không tự shortlist được.

Sau STORY-01, form không còn bắt admin chọn productIds. Backend phải tự lấy candidates từ DB và để AI shortlist.

## User story

> **As** admin DealVault,
> **I want** AI tự đọc catalog sản phẩm của tool và chọn 4-6 cái phù hợp nhất với topic,
> **so that** bài có sản phẩm liên quan mà tôi không phải prep gì.

## Acceptance criteria

### AC1 — Backend pull candidates
- Khi `type = BUYING_GUIDE`, backend query top 15 products của `toolId`:
  - Lọc: `scrapedData != null`, có `price > 0`, có `imageUrl`, có `affiliateUrl != null`.
  - Sort: `updatedAt desc` (sản phẩm mới crawl ưu tiên).
  - Tối đa 15 candidates.
- Khi `type = REVIEW`: bỏ qua bước này — chỉ dùng 1 sản phẩm từ `productRef` (xem STORY-03 với case URL mới).

### AC2 — Bơm full candidate context vào prompt
- Replace placeholder `{candidatesJson}` trong prompt template với JSON array:
  ```json
  [
    {
      "id": "uuid",
      "name": "...",
      "brand": "...",
      "price": 5990000,
      "originalPrice": 7990000,
      "discountPercent": 25,
      "priceUpdatedAt": "2026-05-10",
      "crawledAt": "2026-05-12",
      "imageUrl": "https://...",
      "specs": { "key spec 1": "...", "key spec 2": "..." }
    },
    ...
  ]
  ```
- Specs lấy từ `scrapedData` qua helper, giới hạn 8 specs/product để không tràn token.

### AC3 — AI output schema mở rộng
- Thêm `selectedProductIds: string[]` (UUID, 3-6 phần tử) trong `aiOutputSchema` ở [article.service.ts:71-78](apps/api/src/services/article.service.ts#L71-L78).
- AI phải pick từ `candidates` đã cung cấp. Validator hậu kiểm reject nếu có ID không thuộc candidates (trừ case từ `discoveredProducts` — xem STORY-03).
- Pinned products (từ STORY-01 `pinnedProductIds`) phải xuất hiện trong `selectedProductIds`. Validator check: `pinnedProductIds ⊆ selectedProductIds`. Nếu thiếu, retry 1 lần với prompt nhấn mạnh.

### AC4 — Blocks tham chiếu productId hợp lệ
- Sau gen, scan blocks: mọi `product_spotlight.productId` và `comparison.productIds[]` phải nằm trong `selectedProductIds`. Nếu sai, filter bỏ (như logic hiện tại đã có ở [article.service.ts]).

### AC5 — Article persist
- `Article.productIds[]` = `selectedProductIds` (+ discovered IDs sau STORY-04 hoàn tất).
- Bỏ logic cũ dùng `input.productIds` từ controller.

## Technical breakdown

### Backend (`apps/api/src/services/article.service.ts`)

1. **New helper** `buildCandidates(toolId, limit = 15)`:
   ```ts
   private async buildCandidates(toolId: string, limit = 15): Promise<CandidateProduct[]> {
     const products = await this.prisma.product.findMany({
       where: { toolId, /* filters */ },
       orderBy: { updatedAt: "desc" },
       take: limit
     });
     return products.map(p => normalizeForPrompt(p));
   }
   ```

2. **New helper** `normalizeForPrompt(product)` — trích từ `scrapedData` các field cần (price, brand, specs, imageUrl, priceUpdatedAt). Giới hạn specs 8 items.

3. **Refactor** `generateDraft()`:
   - Đọc `toolId` từ input.
   - Gọi `buildCandidates(toolId)` cho BUYING_GUIDE.
   - Inject `{candidatesJson}`, `{pinnedProductIds}` vào template.
   - Đổi `GenerateArticleInput` interface: bỏ `productIds`, thêm `pinnedProductIds?`, `productRef?`.

4. **Update zod** `aiOutputSchema`:
   ```ts
   selectedProductIds: z.array(z.string().uuid()).min(1).max(8),
   ```

5. **New validator** `validatePickedProducts(output, candidates, pinned)`:
   - Mọi `selectedProductIds` ∈ candidates (hoặc discovered, sau STORY-03/04).
   - `pinned ⊆ selectedProductIds`.
   - Nếu fail, throw error có thể retry.

6. **AdminController** [admin.controller.ts]:
   - `generateArticleSchema` (zod) bỏ `productIds`, thêm `pinnedProductIds`, `productRef`.
   - Sau gen, persist `Article.productIds = output.selectedProductIds` (concat thêm discovered IDs ở STORY-04).

## Definition of Done

- [ ] Tạo bài BUYING_GUIDE trên tool `robot-hut-bui-lau-nha` không pin gì → bài có 4-6 product_spotlight, ID đều có trong DB.
- [ ] Tạo bài BUYING_GUIDE pin 2 sản phẩm cụ thể → 2 sản phẩm đó chắc chắn xuất hiện trong blocks.
- [ ] Tool không có sản phẩm đủ điều kiện (0 candidates) → return error friendly "Tool chưa có sản phẩm, vào Refinery thêm trước".
- [ ] Build pass.

## Out of scope

- Discovered products (sản phẩm mới qua web search) — STORY-03.
- Visual rhythm constraint trên blocks — Iter 2.
- Sort theo conversion stats — sprint sau (chưa có data đủ).
