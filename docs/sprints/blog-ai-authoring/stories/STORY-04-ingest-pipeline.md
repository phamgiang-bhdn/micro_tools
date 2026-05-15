# STORY-04 — Ingest discovered products vào Refinery

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 3h
**Dependencies:** STORY-03 (cung cấp `discoveredProducts` array).

## Context

Sau STORY-03, AI trả về `discoveredProducts: [{ name, sourceUrl, reason }]`. Bây giờ backend phải:
1. Scrape mỗi URL để lấy data thật (giá, ảnh, specs).
2. Lưu vào DB như `Product` mới + `ProductExtraction` ở `PENDING_REVIEW` — đúng HITL gate của Refinery.
3. Trả về list `{ placeholder, productId }` để article.service replace placeholder `discovered:<i>` → real UUID trong blocks.

**Quan trọng**: KHÔNG auto-publish product. Phải nằm ở `PENDING_REVIEW` để admin duyệt sau ở Refinery.

## User story

> **As** admin DealVault,
> **I want** mọi sản phẩm AI khám phá được scrape và đưa vào Refinery để tôi duyệt,
> **so that** catalog tự mở rộng theo nội dung blog, nhưng vẫn qua HITL gate.

## Acceptance criteria

### AC1 — Service mới `ProductDiscoveryService`
- File: `apps/api/src/services/product-discovery.service.ts`.
- Method chính:
  ```ts
  async ingestBatch(items: Array<{
    placeholderIndex: number;
    name: string;
    sourceUrl: string;
    reason: string;
    toolId: string;
  }>): Promise<Array<{
    placeholderIndex: number;
    productId: string | null;  // null nếu scrape fail
    status: "created" | "deduplicated" | "failed";
    error?: string;
  }>>
  ```

### AC2 — Domain whitelist enforcement (lần 2 ở backend)
- Trước khi scrape, recheck `sourceUrl` ∈ `ALLOWED_PRODUCT_DOMAINS`. Skip nếu không (defense in depth — STORY-03 đã filter rồi nhưng vẫn check).

### AC3 — Canonical URL dedup
- Normalize URL: strip query string thừa (giữ lại `?itemid=`, `?productId=` quan trọng tùy domain), strip tracking params (`utm_*`, `fbclid`, `gclid`).
- Check `prisma.product.findFirst({ where: { affiliateUrl: { contains: canonicalUrl } } })` — nếu có, return `{ productId: existing.id, status: "deduplicated" }`.

### AC4 — Scrape qua `WebScrapeClient`
- Reuse `apps/api/src/modules/crawler/clients/web-scrape.client.ts`.
- Timeout: 10s/URL. Fail → return `{ productId: null, status: "failed", error: "..." }`. KHÔNG throw — không break cả batch.
- Output expected: `{ rawContent, title, price?, imageUrl?, imageUrls?, specs? }`.

### AC5 — Tạo Product + ProductExtraction
- Tạo `Product`:
  ```ts
  {
    toolId,
    name: scraped.title ?? input.name,
    network: "WEB_SCRAPE",  // hoặc detect từ domain
    affiliateUrl: canonicalUrl,  // URL gốc, admin sẽ replace bằng affiliate link sau ở Refinery
    scrapedData: { price, imageUrl, imageUrls, specs, source: "ai-discovery", discoveryReason: input.reason }
  }
  ```
- Tạo `ProductExtraction`:
  ```ts
  {
    productId,
    rawContent: scraped.rawContent,
    aiOutput: scraped.parsed ?? null,
    status: "PENDING_REVIEW",
    sourceUrl: canonicalUrl
  }
  ```
- Slug auto-generate từ name (kebab-case + unique check trong scope toolId).

### AC6 — Article integrate
- Trong `article.service.ts.generateDraft()`:
  1. Gọi AI gen → có `discoveredProducts` + blocks chứa `discovered:<i>` placeholders.
  2. Gọi `ProductDiscoveryService.ingestBatch(discoveredProducts, toolId)`.
  3. Build map `{ "discovered:0" → uuid1, "discovered:1" → uuid2, ... }`.
  4. Walk blocks, replace placeholder. Block nào có placeholder map về `null` (scrape fail) → REMOVE block đó hoặc replace bằng `callout` warning (chọn cách 1 cho v1).
  5. `Article.productIds` = `selectedProductIds` (từ STORY-02) ∪ `successfullyIngestedIds`.

### AC7 — REVIEW flow với URL mới (từ STORY-01)
- Nếu `productRef` là URL chưa có trong DB:
  - Gọi `ProductDiscoveryService.ingestBatch([{ sourceUrl: productRef, ... }])` **TRƯỚC** khi gen bài.
  - Nếu fail → response error friendly: "Không scrape được URL, vui lòng kiểm tra link hoặc thêm sản phẩm thủ công ở Refinery."
  - Nếu OK → có productId, gen bài như BUYING_GUIDE với candidate = 1 product này.

### AC8 — Log + observability
- Log mỗi ingest: `[ProductDiscovery] toolId=X url=Y status=Z productId=W`.
- Nếu ≥ 50% batch fail → log warning level cao hơn.

## Technical breakdown

### Files mới
- `apps/api/src/services/product-discovery.service.ts` (new).
- `apps/api/src/services/__tests__/product-discovery.service.spec.ts` (optional, sprint chưa bắt buộc).

### Files sửa
- `apps/api/src/modules/app.module.ts`: register `ProductDiscoveryService` provider.
- `apps/api/src/services/article.service.ts`: inject `ProductDiscoveryService`, gọi sau khi AI gen, replace placeholders.
- `apps/api/src/lib/url-whitelist.ts` (chung với STORY-03): thêm `canonicalizeUrl(url)` helper.

### Schema
- Không cần migration mới — reuse `Product` + `ProductExtraction` hiện có.
- `Product.network` thêm value `"WEB_SCRAPE"` (đang là String, không enum, OK).

### Slug generation helper
- Reuse logic ở [admin.controller.ts] hoặc tạo helper chung `ensureUniqueProductSlug(toolId, name)`.

## Definition of Done

- [ ] Tạo bài với topic mới → có ít nhất 1 sản phẩm vào Refinery PENDING_REVIEW.
- [ ] Vào `/admin/refinery` thấy sản phẩm mới với badge "AI Discovery".
- [ ] Scrape fail → block của sản phẩm đó bị remove khỏi article blocks, không break bài.
- [ ] Tạo bài REVIEW với URL mới → product được scrape và article reference đúng productId.
- [ ] Dedup hoạt động: chạy gen 2 lần cùng topic → lần 2 không tạo duplicate product.

## Out of scope

- Generate affiliate URL từ raw URL (admin gắn tay ở Refinery).
- Auto-approve product sau N ngày — sprint sau.
- Sprint 2 sẽ làm UI Refinery badge "AI Discovery" + filter.
