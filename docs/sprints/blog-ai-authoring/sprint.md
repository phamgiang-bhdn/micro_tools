# Sprint: Blog AI Authoring — Dynamic & Discovery

**Sprint ID:** `blog-ai-authoring`
**Start:** 2026-05-15
**Target end:** 2026-05-29 (2 tuần)
**Owner:** @igapdev01

> **Naming update (post-sprint):** This document was written before the
> `Tool` -> `Category` rename. Read every occurrence of `Tool`, `toolId`,
> `toolSlug`, `/tools/...` below as `Category`, `categoryId`,
> `categorySlug`, `/categories/...`. The schema rename is atomic and the
> URLs return 308 permanent redirects.

---

## Vấn đề (problem statement)

Blog AI hiện tại bị admin phàn nàn 4 ý:

1. **Bắt admin chọn sản phẩm trước khi gen** — admin không nhớ tên sản phẩm trong catalog. Form ở [new-article-form.tsx:86-108](apps/web/app/admin/articles/new/new-article-form.tsx#L86-L108) yêu cầu tick checkbox.
2. **Bài nhàm chán, như đoạn văn dài** — AI ra nhiều `prose` block liên tiếp. Schema cho phép tới 15 block nhưng AI thường chỉ dùng `prose` + `faq`.
3. **Thông tin cũ** — Gemini training cutoff, không có context giá/model mới. Bài có thể nhắc model 2022-2023.
4. **Không có ảnh sản phẩm dynamic** — chỉ lấy 1 `imageUrl` từ product, không có gallery, không có hero, không có ảnh từ sản phẩm chưa có trong DB.

## Mục tiêu sprint

Biến luồng tạo bài từ **"admin prep catalog → AI viết quanh đó"** sang **"admin nêu chủ đề → AI tự chọn + khám phá sản phẩm + viết với data tươi"**, KHÔNG phá HITL gate (sản phẩm mới vẫn phải qua Refinery duyệt).

## Outcomes đo được

- Admin tạo 1 bài chỉ cần nhập: `type` + `topic` + `tool` (3 field, không cần biết sản phẩm).
- 100% sản phẩm trong bài được AI tự pick (từ DB) hoặc khám phá (từ web search).
- 0% bài chứa tên sản phẩm AI bịa (không có nguồn URL).
- Bài có ít nhất 5 block khác type khác nhau (rhythm visual).
- Bài luôn có ngày tham chiếu = ngày tạo (không trích năm cũ).

## Nguyên tắc bất di

- **HITL gate đứng vững**: sản phẩm AI khám phá → `ProductExtraction.status = PENDING_REVIEW`. Article có thể publish, nhưng block trỏ tới product chưa duyệt sẽ render placeholder/ẩn ở storefront.
- **AI không bịa data**: tên/giá/ảnh/URL đến từ Google Search grounding + scrape thật, không từ trí nhớ model.
- **Whitelist domain**: env `ALLOWED_PRODUCT_DOMAINS`. Backend reject URL ngoài whitelist trước khi scrape.
- **Async by default**: gen bài tốn 30s-3 phút (web search + N scrape). Không block UI.

## Scope — chia 2 iteration

### Iteration 1 (Sprint chính) — Core pipeline

| Story | Tiêu đề | Estimate |
|---|---|---|
| [STORY-01](stories/STORY-01-form-simplification.md) | Đơn giản hóa form tạo bài | 2h |
| [STORY-02](stories/STORY-02-ai-auto-pick.md) | AI tự shortlist sản phẩm từ catalog | 3h |
| [STORY-03](stories/STORY-03-discovered-products.md) | AI khám phá sản phẩm mới qua web search | 4h |
| [STORY-04](stories/STORY-04-ingest-pipeline.md) | Ingest discovered products vào Refinery | 3h |
| [STORY-05](stories/STORY-05-async-generation.md) | Async generate + status tracking | 3h |
| [STORY-06](stories/STORY-06-freshness-context.md) | Freshness context cho AI | 1.5h |
| [STORY-07](stories/STORY-07-auto-cover-image.md) | Auto-pick cover image | 1h |
| [STORY-08](stories/STORY-08-prompt-templates.md) | Update prompt templates | 2h |

**Tổng Iter 1: ~19.5h work.**

### Iteration 2 (Sprint kế tiếp) — Polish & dynamic UX

Note tham chiếu, chưa viết story chi tiết:

- **STORY-09**: Visual rhythm constraints (max 3 prose, cấm 2 prose liên tiếp) + 4 block mới (`tldr`, `spec_table`, `rating_bar`, `price_snapshot`).
- **STORY-10**: Voice per tool — `Tool.voiceGuide` field + seed cho 2 tool v1.
- **STORY-11**: Storefront placeholder cho product PENDING + admin preview với badge.
- **STORY-12**: Image gallery block — mở rộng scraper lưu `images: string[]`, BlockRenderer mới.

## Ngoài scope (sprint sau nữa)

- Outline-first 2 bước (admin duyệt outline trước khi AI viết full).
- Block-level regenerate (nút "Rewrite block này" ở admin editor).
- Schedule publish (`Article.scheduledAt` + cron).
- Cover image upload tay.
- Auto-publish article khi product Refinery duyệt xong.
- AI generate affiliate URL (vẫn để admin gắn tay trong Refinery).

## Rủi ro & mitigation

| Rủi ro | Mitigation |
|---|---|
| Gemini Google Search grounding không bật được cho `gemini-2.0-flash` | Test sớm ở STORY-03; fallback `gemini-2.0-pro` |
| Scrape mới chậm/fail nhiều | Async + per-product timeout 10s + skip không break bài |
| AI chọn URL ngoài affiliate network ta tham gia | Whitelist `ALLOWED_PRODUCT_DOMAINS` ép trong prompt + validate backend |
| Trùng sản phẩm (AI khám phá lại cái đã có) | Dedup theo canonical URL trước khi tạo `Product` mới |
| Article publish với product chưa duyệt → storefront broken | BlockRenderer skip/placeholder block trỏ product != PUBLISHED |
| Cost tăng do search grounding + multi-scrape | Theo dõi sau 1 tuần; cần thì cache search results 24h |

## Định nghĩa "Done" của sprint

- [ ] Tất cả Iter 1 story merged.
- [ ] Build pass: `npm run build`.
- [ ] Tạo thử 3 bài sample (2 BUYING_GUIDE + 1 REVIEW) end-to-end, verify discovered products vào Refinery PENDING.
- [ ] Update `apps/api/CLAUDE.md` + `apps/web/CLAUDE.md` ghi lại flow mới.
- [ ] Update `docs/CONTEXT.md` nếu ảnh hưởng HITL philosophy.

## Cấu trúc story

Mỗi file story theo template:
- **Context** — vì sao cần
- **User story** — As/I want/So that
- **Acceptance criteria** — bullets, có thể verify được
- **Technical breakdown** — file paths, schema changes, code changes
- **Dependencies** — story khác phải xong trước
- **Definition of Done** — checklist cụ thể
- **Estimate** — giờ work

## Thứ tự thực thi đề xuất

```
STORY-08 (prompt templates) ───┐
STORY-06 (freshness)      ─────┤
                                ├──> STORY-02 (auto-pick) ──┐
STORY-01 (form)           ─────┘                            │
                                                            ├──> STORY-05 (async)
STORY-03 (discovery) ──> STORY-04 (ingest) ─────────────────┤
                                                            │
STORY-07 (cover) ───────────────────────────────────────────┘
```

Tức là làm STORY-01, 06, 08 song song trước (không phụ thuộc nhau). Sau đó STORY-02 và STORY-03→04 song song. Cuối cùng STORY-05 + STORY-07 ghép tất cả lại.
