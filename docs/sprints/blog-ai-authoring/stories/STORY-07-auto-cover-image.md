# STORY-07 — Auto-pick cover image

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 1h
**Dependencies:** STORY-02 (cần `selectedProductIds`), STORY-04 (cần ingest discovered xong để có ảnh).

## Context

Hiện [blog/[slug]/page.tsx](apps/web/app/blog/[slug]/page.tsx) cover hero dùng ảnh ghép từ products đầu tiên — fail nếu bài không có product. Sau STORY-04, mỗi bài luôn có product (selected + discovered), nên có thể pick 1 ảnh tốt nhất làm cover.

Schema đã có `Article.coverImage String?` (user đã add). Sprint này lo logic auto-pick + render.

## User story

> **As** admin DealVault,
> **I want** mỗi bài có ảnh cover đẹp tự chọn từ sản phẩm chính,
> **so that** bài trông chuyên nghiệp ngay sau khi gen, không phải upload tay.

## Acceptance criteria

### AC1 — Auto-pick logic
- Cuối flow gen bài (`runGenerationJob`), sau khi có `selectedProductIds` + ingested discovered:
  - Lấy product đầu tiên trong `Article.productIds` có `scrapedData.imageUrl` hợp lệ (URL HEAD 200, đã có HEAD check ở article.service hiện tại).
  - Set `Article.coverImage = product.scrapedData.imageUrl`.
- Nếu không product nào có ảnh hợp lệ → `coverImage = null` (storefront fallback).

### AC2 — Storefront render
- [`app/blog/[slug]/page.tsx`] hero section:
  - Nếu `article.coverImage` có → render full-bleed (1200x600 aspect) với gradient overlay + title.
  - Nếu null → fallback ảnh ghép cũ (hiện tại) hoặc gradient pure.
- [`app/blog/page.tsx`] list cards:
  - Card cover priority: `article.coverImage` → `firstProduct.imageUrl` → placeholder SVG.

### AC3 — Metadata
- [`generateMetadata`] trong blog detail page: `openGraph.images = [article.coverImage]` nếu có. Cải thiện share preview.

### AC4 — Re-pick khi update
- Khi admin sửa `productIds` ở editor (STORY-01 hoặc sau), nếu `coverImage` đang trỏ tới product bị bỏ → auto-repick (chọn product đầu tiên còn lại).
- Helper `repickCoverImage(articleId)` trong `ArticleService`.

### AC5 — Admin editor hiển thị cover
- [`app/admin/articles/[id]/article-editor-client.tsx`]: thêm preview cover image ở đầu form, đọc-only (không cho upload tay sprint này).
- Có nút "Re-pick" gọi server action `repickCoverImageAction(id)`.

## Technical breakdown

### Backend

1. **Helper** trong `ArticleService`:
   ```ts
   async pickCoverImage(productIds: string[]): Promise<string | null> {
     for (const pid of productIds) {
       const p = await prisma.product.findUnique({ where: { id: pid } });
       const url = extractImageUrl(p?.scrapedData);
       if (url && await isUrlReachable(url)) return url;
     }
     return null;
   }
   ```
   - `isUrlReachable` reuse HEAD check logic đã có ở article.service.

2. **Tích hợp** vào `runGenerationJob`:
   - Sau khi có final `productIds` → `coverImage = await pickCoverImage(productIds)`.
   - Save vào DB.

3. **New endpoint** `POST /admin/articles/:id/repick-cover`:
   - Auth reviewer+.
   - Re-run `pickCoverImage` với current productIds.
   - Update + return new `coverImage`.

### Frontend

1. **Server action** `repickCoverImageAction(id)` ở [app/admin/actions.ts].
2. **Editor UI** [article-editor-client.tsx]: section "Ảnh cover" với `<img>` preview + nút "Chọn lại từ sản phẩm".
3. **Public blog detail**: replace hero section dùng `article.coverImage` first.
4. **Public blog list**: card cover dùng `article.coverImage` first.

## Definition of Done

- [ ] Gen bài → `coverImage` được set tự động.
- [ ] Storefront blog detail render cover đúng.
- [ ] Storefront blog list card render cover đúng.
- [ ] Bỏ product cover ở editor → repick button hoạt động, chọn ảnh khác.
- [ ] Bài không có ảnh sản phẩm hợp lệ → fallback đẹp, không vỡ layout.

## Out of scope

- Upload cover tay (sprint sau).
- Crop/resize ảnh (dùng nguyên ảnh gốc).
- AI generate cover image (vi phạm "không bịa data" + cost cao).
- Unsplash fallback — sprint sau nếu cần.
