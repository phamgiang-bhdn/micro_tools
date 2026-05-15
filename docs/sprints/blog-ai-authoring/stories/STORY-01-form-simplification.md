# STORY-01 — Đơn giản hóa form tạo bài blog

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 2h
**Dependencies:** none (có thể làm song song)

## Context

Form hiện tại ở [new-article-form.tsx:86-108](apps/web/app/admin/articles/new/new-article-form.tsx#L86-L108) hiển thị **toàn bộ danh sách sản phẩm dưới dạng checkbox**, bắt admin tự tick sản phẩm muốn nhắc trong bài. Vấn đề:

- Admin không nhớ tên sản phẩm trong catalog (sẽ có hàng chục/trăm).
- AI bị ràng buộc cứng vào productIds admin chọn → không sáng tạo, không khám phá được.
- Với REVIEW, lẽ ra chỉ cần 1 sản phẩm — checkbox là sai UX.

## User story

> **As** admin DealVault,
> **I want** form tạo bài chỉ cần nhập type + topic + tool (và optional pin/ref),
> **so that** tôi không phải nhớ tên sản phẩm và bắt đầu được nhanh.

## Acceptance criteria

### AC1 — Form BUYING_GUIDE rút gọn
- Input: `type` (radio), `topic` (textarea, required, min 5 chars), `tool` (select, **required**).
- Input optional: `pinnedProductIds` — combobox searchable, multi-select, gõ tên để autocomplete từ DB. Mặc định trống. Tooltip: *"Ép AI phải nhắc tới các sản phẩm này. Để trống = AI tự chọn."*
- Bỏ hoàn toàn checkbox list cũ.

### AC2 — Form REVIEW rút gọn
- Input: `type` (radio = REVIEW), `topic` (optional), `productRef` (1 input).
- `productRef` là combobox searchable: gõ tên sản phẩm → autocomplete từ DB. Cho phép paste URL Shopee/Tiki/Lazada chưa có trong DB (validate là URL whitelist).
- `tool` không cần chọn — backend infer từ productRef.

### AC3 — Autocomplete API
- Endpoint mới: `GET /admin/products/search?q=<query>&toolId=<id>&limit=20`.
- Trả: `[{ id, name, slug, toolName, imageUrl?, price? }]`.
- Match fuzzy theo `name` (Postgres `ILIKE %q%` đủ cho v1, không cần full-text).
- Auth: header admin chuẩn.

### AC4 — UI hiển thị tử tế
- Combobox dùng `<datalist>` HTML native hoặc Radix Combobox đơn giản (không thêm dep nặng).
- Selected pinned products hiện dạng chip có nút X để bỏ.
- Hint dưới mỗi input: ví dụ rõ ràng tiếng Việt.

### AC5 — Server action update
- `generateArticleAction` ở [app/admin/actions.ts] nhận body mới:
  - BUYING_GUIDE: `{ type, topic, toolId, pinnedProductIds[] }`
  - REVIEW: `{ type, topic?, productRef }`
- KHÔNG còn nhận `productIds` từ form (AI sẽ tự pick — xem STORY-02).

## Technical breakdown

### Backend (`apps/api/src/`)

1. **New endpoint** `GET /admin/products/search` trong [admin.controller.ts](apps/api/src/modules/admin/admin.controller.ts):
   ```ts
   @Get("products/search")
   async searchProducts(
     @Query("q") q: string,
     @Query("toolId") toolId?: string,
     @Query("limit") limit?: string,
     @Headers("x-admin-role") role?: string,
     @Headers("x-admin-key") apiKey?: string
   )
   ```
   - Auth: `["viewer", "reviewer", "admin"]`.
   - Validate query bằng zod (q min 1 char, limit 1-50).
   - Query: `prisma.product.findMany({ where: { name: { contains: q, mode: 'insensitive' }, toolId? }, take: limit, include: { tool: { select: { name: true } } } })`.
   - Return normalized: `{ id, name, slug, toolName, imageUrl, price }` (lấy từ `scrapedData` qua helper).

2. **Update zod schema** `generateArticleSchema` trong admin.controller:
   - Bỏ field `productIds`.
   - Thêm `pinnedProductIds: z.array(z.string().uuid()).max(10).optional()`.
   - Thêm `productRef: z.string().optional()` (cho REVIEW — UUID hoặc URL).

### Frontend (`apps/web/`)

1. **Tách form theo type**: 2 component con render conditional theo radio.
2. **New component** `components/admin/product-combobox.tsx` (client) — debounced autocomplete gọi `/admin/products/search` qua admin action.
3. **Update** [new-article-form.tsx](apps/web/app/admin/articles/new/new-article-form.tsx):
   - Xóa toàn bộ block "Sản phẩm gợi ý" (line 86-108).
   - Thêm `<ProductCombobox>` cho pinnedProductIds (BUYING_GUIDE) và productRef (REVIEW).
4. **Server action mới** `searchProductsAction(q, toolId)` trong [app/admin/actions.ts](apps/web/app/admin/actions.ts).
5. **Update** `generateArticleAction` — không gửi productIds nữa, gửi pinnedProductIds + productRef.

### Validation rule

- Nếu REVIEW + productRef là URL → check domain ∈ `ALLOWED_PRODUCT_DOMAINS` (env). Reject nếu không.
- Nếu REVIEW + productRef là UUID → verify product tồn tại trong DB trước khi qua AI.

## Definition of Done

- [ ] Form mới render đúng theo radio chọn.
- [ ] Combobox search hoạt động, autocomplete < 500ms cho query 3 chars trên dataset thật.
- [ ] Tạo thử bài BUYING_GUIDE không pin gì → submit OK, gen bắt đầu.
- [ ] Tạo thử bài REVIEW chọn sản phẩm có sẵn trong DB → submit OK.
- [ ] Tạo thử bài REVIEW paste URL chưa có trong DB → submit OK (sẽ trigger discovery — STORY-03).
- [ ] Lint pass: `npm run lint:web`.
- [ ] Build pass: `npm run build`.

## Out of scope

- Validate slug uniqueness trước submit (làm sau ở STORY khác).
- Suggest tool tự động từ topic (làm ở STORY-02 hoặc sau).
- Lưu draft form trước khi submit.
