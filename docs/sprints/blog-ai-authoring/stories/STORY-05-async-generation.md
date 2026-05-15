# STORY-05 — Async generate + status tracking

**Sprint:** [blog-ai-authoring](../sprint.md)
**Estimate:** 3h
**Dependencies:** STORY-02, STORY-04 (gen logic xong rồi mới wrap async).

## Context

Sau STORY-03 + STORY-04, mỗi lần gen bài tốn:
- 1 call Gemini với Google Search grounding (~20-40s).
- 1-8 call scrape sản phẩm mới (~10s/cái).
- Tổng có thể 1-3 phút.

Hiện endpoint [admin.controller.ts → POST /admin/articles/generate] là synchronous — request giữ 3 phút sẽ timeout hoặc tệ UX. Cần làm async:
1. Endpoint trả response ngay với `articleId` + status `GENERATING`.
2. Background job làm phần nặng.
3. Admin UI poll status, render khi xong.

## User story

> **As** admin DealVault,
> **I want** bấm "Sinh bằng AI" và được redirect ngay sang trang detail thấy progress,
> **so that** tôi không phải chờ request treo, biết được đang gen tới đâu.

## Acceptance criteria

### AC1 — Schema đã có
- `ArticleStatus.GENERATING`, `ArticleStatus.FAILED` đã có (đã add).
- `Article.generationError` đã có (đã add).
- Không cần migration mới.

### AC2 — Endpoint generate async
- `POST /admin/articles/generate` flow mới:
  1. Validate body (zod).
  2. Tạo `Article` ngay với:
     - `status: "GENERATING"`
     - `title: "(đang sinh) " + topic.slice(0, 50)`
     - `slug: temp-<random>` (sẽ replace sau)
     - `body: ""`, `blocks: null`
     - `type`, `toolId` từ input
  3. Trả response `202 { id, status: "GENERATING" }`.
  4. Background: `setImmediate(() => runGeneration(articleId))` — không await.

### AC3 — Background job
- Function `runGeneration(articleId)` trong `ArticleService` (hoặc service riêng):
  1. Load article.
  2. Gọi pipeline gen (candidates → AI → ingest discovered).
  3. Update article với output: title, slug (unique check), excerpt, blocks, body, metaTitle, metaDescription, productIds, coverImage (từ STORY-07), aiModel, aiPromptName, status = `DRAFT`.
  4. Lỗi: update `status = "FAILED"`, `generationError = err.message`.

### AC4 — Endpoint poll status
- `GET /admin/articles/:id/status`:
  - Auth viewer+.
  - Return `{ id, status, generationError?, title, slug }`.
  - Lightweight (không trả blocks/body).

### AC5 — UI new article flow
- Sau submit form ở STORY-01:
  - Server action gọi `POST /admin/articles/generate`, nhận `{ id }`.
  - `redirect("/admin/articles/" + id)` — sang trang detail ngay.
- Trang detail [`app/admin/articles/[id]/page.tsx`]:
  - Nếu `status === "GENERATING"`: render component `<ArticleGenerationProgress />` (client), poll `/admin/articles/:id/status` mỗi 3s.
  - Khi status đổi sang `DRAFT` → reload page (server refresh). Khi `FAILED` → hiển thị lỗi + nút "Thử lại" (POST `/admin/articles/:id/retry`).

### AC6 — Retry endpoint
- `POST /admin/articles/:id/retry`:
  - Auth reviewer+.
  - Only allowed if `status === "FAILED"`.
  - Set status back to `GENERATING`, clear `generationError`, trigger `runGeneration(id)`.

### AC7 — Cleanup logic
- Articles ở `GENERATING` > 10 phút → coi như stale, mark `FAILED` với error `"Timeout (process bị restart?)"`.
- Đơn giản hóa cho v1: check lazy khi load article (nếu `status === "GENERATING"` và `updatedAt < now - 10min` → tự đổi sang FAILED).
- Background cleanup cron — sprint sau.

### AC8 — UI: list page hiển thị status
- [`app/admin/articles/page.tsx`] cập nhật badge:
  - `GENERATING` — badge xanh "Đang sinh" + spinner nhỏ.
  - `FAILED` — badge đỏ "Lỗi" + tooltip lý do.
  - Filter có thêm option `GENERATING | FAILED`.

## Technical breakdown

### Backend

1. **`article.service.ts`**: tách logic gen ra method `runGenerationJob(articleId)`. Caller cũ (`generateDraft`) → giữ làm internal cho test, nhưng public flow đi qua async.

2. **`admin.controller.ts`**:
   - Đổi `POST /admin/articles/generate` handler:
     ```ts
     const article = await prisma.article.create({ ... GENERATING ... });
     setImmediate(() => articleService.runGenerationJob(article.id).catch(e => logger.error(...)));
     return { id: article.id, status: "GENERATING" };
     ```
   - Thêm `GET /admin/articles/:id/status`.
   - Thêm `POST /admin/articles/:id/retry`.

3. **Stale detection helper**: trong `GET /admin/articles/:id` & `:id/status`, nếu detect stale → cập nhật + return new status.

### Frontend

1. **`app/admin/articles/[id]/page.tsx`** (RSC): khi load article, nếu `status === "GENERATING"`, render placeholder + mount `<ArticleGenerationProgress articleId={id} />` client component.

2. **New component** `app/admin/articles/[id]/generation-progress-client.tsx`:
   - `useEffect` poll mỗi 3s qua server action `pollArticleStatusAction(id)`.
   - Khi `status` đổi → `router.refresh()`.
   - Hiển thị spinner + text "AI đang đọc catalog, tra cứu web, viết bài..." + step labels.
   - Khi `FAILED` → hiển thị error + nút retry.

3. **Server actions** (`app/admin/actions.ts`):
   - `pollArticleStatusAction(id)`.
   - `retryArticleGenerationAction(id)`.

4. **`app/admin/articles/page.tsx`**: thêm badge cho `GENERATING | FAILED`.

## Definition of Done

- [ ] Submit form → redirect sang `/admin/articles/<id>` trong < 500ms.
- [ ] Trang detail hiển thị progress, poll status đều.
- [ ] Khi gen xong → page tự refresh, hiển thị bài.
- [ ] Khi gen fail → hiển thị lỗi + retry hoạt động.
- [ ] List page filter status `GENERATING | FAILED` hoạt động.
- [ ] Build pass.

## Out of scope

- Cancel generation giữa chừng.
- Progress fine-grained (step "candidates done", "AI done", "scraping 2/3"). Sprint sau có thể làm với SSE.
- Queue persistence (giờ dùng in-process `setImmediate`. Nếu API restart giữa gen → bài stuck GENERATING → cleanup logic xử lý).
- BullMQ/Redis queue — sprint sau khi traffic tăng.
