# STORY-03 — AI khám phá sản phẩm mới qua web search

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 4h
**Dependencies:** STORY-08 (prompt), STORY-04 (ingest pipeline) sẽ tiêu thụ output của story này.

## Context

Hiện AI chỉ "nhắc" sản phẩm đã có trong DB. Khi viết bài về chủ đề mới (ví dụ "robot hút bụi cho nhà nuôi mèo"), DB có thể chỉ có 5 sản phẩm cũ → bài nghèo, không cạnh tranh được SEO. Cần AI tự tra web tìm sản phẩm phù hợp.

**Quan trọng**: AI KHÔNG bịa data. Tất cả sản phẩm AI đề xuất phải có `sourceUrl` trỏ tới trang sản phẩm thật, từ Google Search grounding.

## User story

> **As** admin DealVault,
> **I want** AI tự tra web tìm sản phẩm mới khi catalog không đủ,
> **so that** bài luôn có đủ sản phẩm để so sánh, và những cái mới được kéo vào Refinery cho tôi duyệt sau.

## Acceptance criteria

### AC1 — Bật Google Search grounding cho Gemini
- Khi gọi `AiService.generateJson` từ `ArticleService.generateDraft`, thêm option `tools: [{ googleSearch: {} }]`.
- Verify Gemini 2.0 Flash support tool này — nếu không, dùng `gemini-2.0-pro` cho article generation (configurable qua env `GEMINI_ARTICLE_MODEL`).
- Tool này có thể không tương thích với `responseMimeType: "application/json"`. Fallback: yêu cầu AI trả raw text JSON, backend parse lỏng hơn.

### AC2 — Schema output mở rộng
- `aiOutputSchema` thêm field:
  ```ts
  discoveredProducts: z.array(z.object({
    name: z.string().min(2).max(200),
    sourceUrl: z.string().url(),
    reason: z.string().min(5).max(300),
    brand: z.string().max(80).optional(),
    estimatedPriceVnd: z.number().int().positive().optional()
  })).max(8).optional().default([])
  ```
- Mỗi item là 1 sản phẩm AI khám phá ngoài candidates. Có thể trống nếu candidates đủ.

### AC3 — Domain whitelist
- Env mới: `ALLOWED_PRODUCT_DOMAINS=shopee.vn,tiki.vn,lazada.vn,shopee.com.my` (csv).
- Inject vào prompt: `{allowedDomains}` — yêu cầu AI chỉ trích `sourceUrl` từ các domain này.
- Backend validate hậu kiểm: filter bỏ `discoveredProducts` có domain ngoài whitelist (log warning, không retry).

### AC4 — Reason bắt buộc
- Mỗi discovered product phải có `reason` (vì sao chọn vào bài) — dùng cho admin review ở Refinery, để biết AI đề xuất sản phẩm này trong context bài nào.

### AC5 — Limit & guard
- Max 8 discovered/bài (tránh AI spam scrape).
- Nếu candidates ≥ 8 sản phẩm phù hợp → prompt khuyến khích AI dùng candidates trước, chỉ discover khi cần đa dạng angle (vd "cao cấp", "giá rẻ", "model mới").

### AC6 — REVIEW với URL mới
- Khi STORY-01 form REVIEW nhận `productRef` là URL chưa có trong DB:
  - Backend coi như 1 `discoveredProduct` đã ép sẵn: `{ name: "(unknown — sẽ scrape)", sourceUrl: productRef, reason: "Admin chỉ định cho bài review", required: true }`.
  - Đẩy vào pipeline ingest (STORY-04) trước khi gọi AI viết bài.
  - Sau scrape có Product UUID, gọi AI gen với productId thật.

### AC7 — AI không hallucinate productId
- Trong blocks, nếu AI tham chiếu sản phẩm khám phá, dùng placeholder `discovered:<index>` (vd `discovered:0`) thay vì UUID.
- Sau khi ingest (STORY-04) map placeholder → real UUID rồi mới persist blocks.

## Technical breakdown

### Backend

1. **`ai.service.ts`** — thêm option pass-through cho `generateJson`:
   ```ts
   async generateJson<T>(prompt: string, opts?: { useSearch?: boolean }): Promise<T>
   ```
   Khi `useSearch=true`, config model với `tools: [{ googleSearch: {} }]`.

2. **`article.service.ts`**:
   - Update `aiOutputSchema` (thêm `discoveredProducts`).
   - Gọi `generateJson(prompt, { useSearch: true })`.
   - Trước khi return: filter `discoveredProducts` theo `ALLOWED_PRODUCT_DOMAINS`.
   - Nếu output blocks có `discovered:<i>` placeholder, giữ nguyên — STORY-04 sẽ replace.

3. **New util** `lib/url-whitelist.ts`:
   ```ts
   export function isAllowedDomain(url: string, allowed: string[]): boolean
   export function getAllowedDomains(): string[]
   ```
   Đọc env `ALLOWED_PRODUCT_DOMAINS` (csv), normalize lowercase, match exact hoặc subdomain.

4. **Prompt update** (STORY-08 sẽ làm):
   - `{allowedDomains}` placeholder.
   - Section "Khám phá sản phẩm mới" với rule rõ ràng.

### Test scenarios

1. Topic "robot hút bụi giá dưới 5 triệu" trên tool có ≥10 candidates phù hợp → AI dùng candidates, không discover.
2. Topic "robot hút bụi cho nhà nuôi 2 mèo" trên tool ít candidates phù hợp → AI discover 2-3 sản phẩm Shopee/Tiki.
3. AI cố trả URL từ amazon.com → backend filter bỏ.

## Definition of Done

- [ ] Bật Google Search grounding, có thể gọi và parse output.
- [ ] Output schema validate đúng với `discoveredProducts` array.
- [ ] Domain whitelist filter hoạt động (test bằng env tạm có/không có domain).
- [ ] Topic catalog đủ → `discoveredProducts = []`, không spam.
- [ ] Topic catalog thiếu → `discoveredProducts` có 1-4 sản phẩm, mỗi cái có URL hợp lệ.

## Out of scope

- Scrape thực sự URL → STORY-04.
- Generate affiliate URL cho sản phẩm mới — admin tự gắn trong Refinery (sprint sau).
- Cache search results 24h — sprint sau khi đo được cost.
