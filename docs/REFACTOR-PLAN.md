# DealVault Refactor Plan — AI-Visible Tool Platform

> **Created:** 2026-05-26
> **Owner:** solo dev
> **Mục tiêu:** Pivot dealvault từ "catalog affiliate đa niche" → "AI decision engine 1 niche → đa niche scale qua config"
> **Timeline:** 6-7 tuần (Epic 0-5), Epic 6 conditional sau validation
> **URL convention:** Tool storefront ở `/ai/[slug]` (KHÔNG dùng `/tools/[slug]` vì legacy 308 redirect → `/categories/[slug]` trong `next.config.ts`).

---

## Vision

**DealVault = AI Tool giúp người Việt chọn đồ điện máy/skincare phù hợp trong 60 giây.**

- Niche launch: **máy lọc nước** (default — swap được nếu validation Epic 0 chọn khác)
- Architecture: niche-agnostic, mở niche mới qua config không cần code
- AI: visible từ ngày launch (chat-first, streaming "thinking", reasoning prominent)
- HITL gate: giữ nguyên — khác biệt vs content farm

## 4 trụ chiến lược

1. **Niche focus, code multi-niche** — launch 1, scale ngang bằng config
2. **Tool là sản phẩm chính** — không phải Product / Article
3. **AI visible từ ngày launch** — chat-first, "AI" là brand
4. **HITL gate sacred** — quality moat

## Keep / Refactor / Build / Kill

| Loại | Asset | Hành động |
|---|---|---|
| KEEP | `Niche` + `schemaConfig` Json động | Giữ nguyên — đã niche-agnostic |
| KEEP | `Product` + `ProductExtraction` HITL pipeline | Giữ nguyên — nguồn data cho Tool |
| KEEP | `ClickLog` + `ConversionWebhook` + `trackingCode` invariant | Giữ nguyên — revenue attribution sacred |
| KEEP | `AiService` (Gemini) + `PromptTemplate` infra | Tái dùng cho Tool prompts |
| KEEP | Admin Refinery + Prompt Studio + Money Trail | Vẫn cần, chỉ thêm Tool Builder |
| KEEP | `Subscriber` model | Reuse cho email capture từ tool |
| REFACTOR | `ClickLog` schema | Thêm `toolId`, `quizSessionId`, `marketplace` |
| REFACTOR | Homepage / `/categories/[slug]` | Đổi từ grid catalog → landing dẫn về Tool |
| REFACTOR | Article pipeline | Giảm output, tăng chất + voice |
| REFACTOR | Brand / tagline / SEO meta | "AI chọn đồ điện máy trong 60s" |
| BUILD | `Tool` entity + `QuizSession` + Tool Builder admin | Module mới, generic per-niche |
| BUILD | `/ai/[slug]` route — chat-first UI + streaming + result | Page mới, AI-visible |
| BUILD | AI prompts: `tool.parseUserInput` + `tool.generateReasoning` + `tool.followUpQA` | Thêm vào PromptTemplate |
| BUILD | `WaitlistSignup` + `/coming-soon/[slug]` | Epic 0 pre-launch validation |
| BUILD | `ReasoningCache` table + cron clean | Giảm AI cost 60-70% |
| KILL | 11/12 niche đang active trên storefront | Disable qua `Niche.status=INACTIVE` (không xoá data) |
| KILL | AI mass-produce article | Google helpful content de-rank |
| KILL | Multi-niche homepage / nav hiện tại | Thay = landing tool đơn |

---

## Convention

- **Size:** S = ≤0.5 ngày · M = 1-2 ngày · L = 3-5 ngày
- **Status:** `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` skipped
- **Dependency:** ghi rõ epic/story trước cần xong
- Stories tuân các rule trong `CLAUDE.md` + memory (project_admin_ui_conventions, feedback_no_ai_retry, project_ai_visible_required, feedback_label_value_contrast, feedback_no_prod_build, feedback_no_auto_infra_start)
- **Tool route**: `/ai/[slug]` (không phải `/tools/[slug]` — clash legacy redirect)
- **Admin route**: `/admin/tools/*` (admin paths không bị legacy redirect)
- **Short URL alias**: `/[short-niche]` (vd `/loc-nuoc` → 307 `/ai/may-loc-nuoc`)

---

# EPIC 0 — Pre-launch Validation

**Mục tiêu:** Validate demand TRƯỚC khi đầu tư 6 tuần code.
**Gate cứng:** ≥50 email/7 ngày → tiếp; < 50 → pivot niche hoặc kill.

## Story 0.1 — Niche selection final [S]

- [ ] **Là** owner, **tôi muốn** chọn niche cuối cùng để launch dựa trên data thực, **để** không build sai hướng.

**Acceptance:**
- [ ] Phân tích 5 niche candidate (máy lọc nước / lọc không khí / máy rửa bát / robot / ghế công thái học)
- [ ] Đánh giá: SEO competition (Ahrefs free / Google "intitle:"), AOV, Accesstrade commission %, recurring potential
- [ ] Chốt 1 niche + ghi rationale vào `docs/CONTEXT.md`
- [ ] Verify Accesstrade có ≥3 campaign active cho niche

**Tech notes:** Update seed nếu cần. Set `Niche.status=ACTIVE` cho niche chọn, `INACTIVE` cho 11 niche còn lại.

---

## Story 0.2 — Pre-launch landing page [M]

- [ ] **Là** visitor tiềm năng, **tôi muốn** xem trang preview tool để hiểu nó làm gì, **và** đăng ký nhận thông báo launch.

**Acceptance:**
- [ ] Route `/coming-soon/[niche-slug]` ở `apps/web`
- [ ] Hero: tagline AI + 1 mock screenshot chat → result
- [ ] Form email + 1 câu khảo sát ("Bạn đang cần chọn loại nào?")
- [ ] Email lưu vào DB (`WaitlistSignup` table)
- [ ] Sau submit: thank-you state inline + share button (Facebook/Zalo)
- [ ] Anti-spam: rate limit IP + honeypot field

**Tech notes:** Server action `submitWaitlist()`. Schema `WaitlistSignup { id, email, nicheId, nicheSlug, surveyAnswer, source, ipHash, userAgent, notified, createdAt }`.

**Dependency:** 0.1

---

## Story 0.3 — Waitlist seeding & measurement [S]

- [ ] **Là** owner, **tôi muốn** đẩy landing tới audience target, **để** đo demand thật.

**Acceptance:**
- [ ] Post landing link ở 3 nơi: Voz (1 box phù hợp), 2-3 group FB target, optional Reddit r/VietNam
- [ ] Admin route `/admin/waitlist` show count + survey breakdown + per-source breakdown
- [ ] **GATE:** sau 7 ngày, nếu < 50 email → STOP. Nếu ≥ 50 → continue Epic 1.

**Tech notes:** Reuse `ListPageShell` pattern.

**Dependency:** 0.2

---

# EPIC 1 — Foundation: Schema + Niche Disable

**Mục tiêu:** Đặt nền data cho Tool module + cô lập 1 niche trên storefront.

## Story 1.1 — Schema Tool + QuizSession + ReasoningCache + WaitlistSignup [M]

- [x] **Là** dev, **tôi muốn** schema generic cho Tool, **để** mở niche mới không cần migration mới.

**Acceptance:**
- [x] Migration thêm 4 model + 1 enum:
  - `Tool { id, slug @unique, nicheId, name, description, tagline, quizSchema Json, scoringRules Json, resultTemplate Json, status ToolStatus, seoTitle, seoDescription, createdAt, updatedAt }`
  - `QuizSession { id, toolId, userInput Json, parsedAttributes Json, recommendedProductIds String[], aiReasonings Json?, source?, referrer?, email?, shareSlug? @unique, ipHash?, userAgent?, reasoningMode?, createdAt, reasoningReadyAt? }`
  - `WaitlistSignup { id, email, nicheId?, nicheSlug, surveyAnswer?, source?, ipHash?, userAgent?, notified, notifiedAt?, createdAt, @@unique([email, nicheSlug]) }`
  - `ReasoningCache { id, productId, profileHash, reasoning, model, hitCount, createdAt, lastHitAt, @@unique([productId, profileHash, model]) }`
  - `ToolStatus enum: DRAFT | PUBLISHED | ARCHIVED`
- [x] Update `ClickLog`: thêm `toolId String? @db.Uuid`, `quizSessionId String? @db.Uuid`, `marketplace String?` + relations + indexes
- [x] Update `Niche`: thêm relations `tools Tool[]`, `waitlistSignups WaitlistSignup[]`
- [ ] **USER ACTION:** chạy `npm run db:migrate --workspace api -- --name add_tool_module` (xem `docs/REFACTOR-COMMANDS.md`)

**Tech notes:** Module mới ở `apps/api/src/modules/tool/`. KHÔNG động `Niche.schemaConfig`.

**Dependency:** Epic 0 pass gate

---

## Story 1.2 — Niche activation filter (reuse `Niche.status`) [S]

- [x] **Là** owner, **tôi muốn** bật/tắt niche trên storefront mà không xoá data.

**Acceptance:**
- [x] Reuse existing `Niche.status: NicheStatus (ACTIVE|INACTIVE)` — KHÔNG thêm `isActive` boolean
- [x] `niches.controller.ts` `getNiches()` đã filter `status: "ACTIVE"`
- [x] `niches.controller.ts` `getNicheBySlug()` thêm guard return 404 nếu `status !== "ACTIVE"`
- [ ] Seed: chỉ niche được chọn ở Epic 0 set `status=ACTIVE`, còn lại `INACTIVE`
- [ ] Admin vẫn thấy tất cả niche (có badge "Inactive" trong `/admin/niches`)

**Tech notes:** File ảnh hưởng: `apps/api/src/modules/niches/niches.controller.ts`. Storefront pages đã dùng `fetchNiches()` mà API đã filter sẵn.

**Dependency:** 1.1

---

## Story 1.3 — Crawl + HITL 30-50 product cho niche launch [L]

- [ ] **Là** owner, **tôi muốn** có catalog đủ cho Tool recommend.

**Acceptance:**
- [ ] Onboard 3-5 Accesstrade campaign cho niche
- [ ] Crawler chạy → ≥50 `ProductExtraction` DRAFT_RAW
- [ ] HITL duyệt ≥30 product PENDING_REVIEW → PUBLISHED qua `/admin/refinery`
- [ ] Product cover đủ phổ rộng (giá rẻ/trung/cao, brand đa dạng)

**Tech notes:** Vận hành, không code. Blocker cho Story 2.3.

**Dependency:** 1.2

---

## Story 1.4 — Disable storefront pages không cần [S]

- [ ] **Là** owner, **tôi muốn** ẩn route catalog generic, **để** user chỉ thấy tool flow.

**Acceptance:**
- [ ] Homepage redirect `/` → `/ai/[niche-tool-slug]` (hoặc render inline tool landing)
- [ ] `/categories/[slug]` giữ cho SEO (không xoá) nhưng CTA chính chuyển sang "Dùng AI Tool"
- [ ] Nav simplify: bỏ menu niche dropdown, thay = "AI Tool" + "Blog"
- [ ] Sitemap update: thêm `/ai/[slug]` entries, vẫn giữ `/categories/[slug]` entries

**Tech notes:** Đừng xoá file route — chỉ thay content. Update `apps/web/app/sitemap.ts`.

**Dependency:** 1.2

---

# EPIC 2 — Tool Builder Admin + Scoring Engine

**Mục tiêu:** Admin tự soạn Tool cho bất kỳ niche nào, không cần dev.

## Story 2.1 — Admin Tool list + CRUD [M]

- [ ] **Là** admin, **tôi muốn** CRUD Tool qua UI.

**Acceptance:**
- [ ] Route `/admin/tools` — list Tool theo niche (filter, status badge)
- [ ] Modal tạo Tool mới: name, slug, niche, description, tagline, status
- [ ] Edit / archive Tool
- [ ] Tuân `ListPageShell` + `FormDialog` + `RowActions` (project_admin_ui_conventions)
- [ ] Constants thêm vào `lib/admin/constants.ts`: `TOOL_STATUS_VALUES`, `TOOL_STATUS_META`, `TOOL_STATUS_OPTIONS`

**Tech notes:** Endpoint thêm vào `AdminController` ở `apps/api/src/modules/admin/admin.controller.ts` (giữ pattern hiện tại), zod validation. Server actions qua `adminFetch()`.

**Dependency:** 1.1

---

## Story 2.2 — Quiz schema builder UI [L]

- [ ] **Là** admin, **tôi muốn** soạn câu hỏi quiz qua form, không chỉnh JSON tay.

**Acceptance:**
- [ ] Trang `/admin/tools/[id]/quiz` — list câu hỏi, drag-drop reorder (optional, có thể list + button up/down nếu drag-drop tốn time)
- [ ] **Quiz cap 3 câu cốt lõi (required) + 2 câu refine (optional)** — không quá 5 câu để giữ completion rate
- [ ] Modal thêm câu hỏi: text, type (single/multi/number/range/**picture**), options, attribute mapping, weight (1-10), required flag
- [ ] **Picture-based options**: mỗi option có icon/emoji + short label (vd: 🚰 Nước máy / ⛲ Giếng khoan / ❓ Không rõ)
- [ ] **"Không rõ" option** luôn được suggest tự động cho câu single-select
- [ ] **Language guideline**: câu hỏi phải theo language buyer, không spec engineer (vd: "Mấy người dùng?" không phải "Lưu lượng L/h?")
- [ ] Preview live: side panel render quiz như user thấy
- [ ] Save → update `Tool.quizSchema` Json

**Tech notes:** Form dùng `react-hook-form` + `zod`. Picture type render emoji hoặc URL ảnh nhỏ.

**Dependency:** 2.1

---

## Story 2.3 — Scoring engine [M]

- [ ] **Là** dev, **tôi muốn** engine chấm điểm product theo user input.

**Acceptance:**
- [ ] Service `apps/api/src/modules/tool/scoring.service.ts`:
  ```ts
  scoreProducts(tool: Tool, userAttributes: Record<string, any>, products: ProductView[]): {productId, score, matchedCriteria[], confidenceLabel}[]
  ```
- [ ] Algorithm: weighted sum theo `tool.scoringRules` × user input × product attributes (via `normalizeProduct`)
- [ ] Trả về top N (config `tool.resultTemplate.topN`) + breakdown từng criteria + confidence label theo threshold
- [ ] Match types: `exact | range_overlap | gte | lte | string_contains | tag_match`
- [ ] Unit test: 5-10 case (user input → expected ranking) — không mock DB, dùng fixture

**Tech notes:** Engine deterministic, không AI ở đây. Skip product `Product.isPublic=false` hoặc niche INACTIVE.

**Dependency:** 1.1, 1.3

---

## Story 2.4 — Tool preview admin route [S]

- [ ] **Là** admin, **tôi muốn** test tool TRƯỚC khi publish.

**Acceptance:**
- [ ] Route `/admin/tools/[id]/preview` — render quiz như user thấy + submit chạy scoring engine + show ranked result
- [ ] Không tạo `QuizSession` row (preview mode flag)
- [ ] Show debug: score breakdown, AI prompt sẽ gọi (Epic 3)

**Tech notes:** Reuse component user-facing từ Epic 4 với prop `previewMode={true}`.

**Dependency:** 2.2, 2.3

---

# EPIC 3 — AI Integration

**Mục tiêu:** AI visible và thật — chat parse + reasoning per product + fallback graceful.
**Rule:** Tuân `project_ai_visible_required` + `feedback_no_ai_retry` (cho extraction; Tool có graceful fallback vì user-facing realtime).

## Story 3.1 — Prompt: tool.parseUserInput [M]

- [ ] **Là** dev, **tôi muốn** AI parse câu mô tả tự do thành structured attributes.

**Acceptance:**
- [ ] Thêm `PromptTemplate` row `tool.parseUserInput` qua `/admin/prompts` (đã có Prompt Studio)
- [ ] Prompt nhận: `userMessage` + `quizSchema` (list attribute cần extract)
- [ ] Output JSON khớp schema, có field `confidence` per attribute
- [ ] Method `AiService.parseToolInput(message, tool)` — wrap `AiService.generateJson()` với constraint prompt
- [ ] Fail → return null (UI fallback sang quiz)
- [ ] Test: 5 input case VN thực tế ("nhà 80m² có mèo…")

**Tech notes:** Model: Gemini `gemini-2.0-flash` (default codebase). Cache không cần (mỗi input unique).

**Dependency:** 2.3

---

## Story 3.2 — Prompt: tool.generateReasoning [M]

- [ ] **Là** user, **tôi muốn** thấy AI giải thích vì sao gợi ý sản phẩm này cho TÔI.

**Acceptance:**
- [ ] `PromptTemplate` row `tool.generateReasoning`
- [ ] Input: `product` (normalized) + `userAttributes` + `matchedCriteria`
- [ ] **Output ngắn**: 1 câu chính (≤25 từ) + điểm trừ inline `(💡 ...)` nếu có. KHÔNG dài dòng 3 câu.
- [ ] Constraint: reasoning phải reference ≥1 fact từ user input (test gắt — log mismatch)
- [ ] Method `AiService.generateToolReasoning(...)` — fail → template fallback có sẵn (vd: "Top {matchedCriteria[0]} + {matchedCriteria[1]}")
- [ ] **Mobile-first**: reasoning hiện đầy đủ trên mobile không cần expand

**Tech notes:** AiService dùng Gemini. Mỗi session = 3 calls (1/card). Cache aggressively (Story 3.3).

**Dependency:** 2.3, 3.1

---

## Story 3.3 — Reasoning cache layer [M]

- [ ] **Là** owner, **tôi muốn** cache reasoning, **để** không gọi AI lại cho cùng (product × profile).

**Acceptance:**
- [ ] `ReasoningCache` table đã có schema (Story 1.1)
- [ ] Hash function: sort + serialize key user attributes → sha256
- [ ] Hit → update `hitCount + 1`, `lastHitAt = now`
- [ ] Cron clean stale > 30 ngày
- [ ] Hit rate metric trong War Room

**Tech notes:** `profileHash` tune sau 100 session đầu — quá đặc thù = 0 hit, quá generic = reasoning sai.

**Dependency:** 3.2

---

## Story 3.4 — Streaming "AI thinking" UI [M]

- [ ] **Là** user, **tôi muốn** thấy AI đang phân tích, **để** không bỏ trang khi chờ.

**Acceptance:**
- [ ] Component `<AIThinkingStream>` show từng dòng với delay 200-400ms
- [ ] Dòng nội dung từ scoring engine — vd: "✓ Lọc theo ngân sách: còn 23 sản phẩm"
- [ ] Hiện trong khi BE chạy parse + scoring + reasoning (parallel)
- [ ] Skeleton card cho top N product trong lúc reasoning stream
- [ ] **Optimistic UI**: card render NGAY (<1s) bằng scoring rule; AI reasoning fill vào sau 2-3s

**Tech notes:** Fake stream OK (không cần SSE/WebSocket phase này). Mục tiêu UX perceived performance.

**Dependency:** 3.1, 3.2

---

# EPIC 4 — Storefront UX (AI-visible)

**Mục tiêu:** Hero hybrid (quiz visible + chat fallback), result page 1+2 hierarchy, brand "AI" rõ.

## Story 4.1 — Hero hybrid (quiz visible + chat fallback) [L]

- [ ] **Là** visitor 40+ tuổi (target buyer), **tôi muốn** thấy ngay câu hỏi đơn giản để bắt đầu, KHÔNG phải đối mặt với 1 chat box trống.

**Acceptance:**
- [ ] Route `/ai/[slug]` — hero hybrid:
  - Tagline AI prominent ("🤖 AI chọn máy lọc nước trong 60s")
  - **3 câu cốt lõi visible ngay trên hero** (tap-to-answer, không phải gõ)
  - Câu 1 default-selected option phổ biến → user chỉ cần tap "Tiếp" nếu lười đọc
  - Sau khi trả 3 câu → button "🤖 Hỏi AI →" primary
  - **Phân cách "─── Hoặc mô tả tự nhiên ───"** dưới block quiz
  - Chat box rows=2 (compact) với placeholder ví dụ cụ thể
- [ ] Trust badges ngay dưới hero: "✓ Phân tích từ N sản phẩm thật · ✓ Đã giúp X gia đình chọn" (X = waitlist count fake-it-till-make-it)
- [ ] Voice input button — **OPTIONAL phase 2**, không trong story này
- [ ] Mobile-first: 3 câu fit trong viewport 1 màn (≤700px), chat box dưới fold
- [ ] Header tối giản trong tool flow: chỉ logo + 1 link "Blog"
- [ ] Submit (cả 2 path) → render `<AIThinkingStream>` → result

**Tech notes:** Brand prominent (logo + tagline). KHÔNG để chat box trống làm hero — VN buyer 40+ không quen describe-yourself-to-AI.

**Dependency:** 3.1, 3.4

---

## Story 4.2 — Quiz alternative flow (5 câu step-by-step) [M]

- [ ] **Là** visitor (không quen 3-câu hero), **tôi muốn** làm quiz 1-câu-1-step.

**Acceptance:**
- [ ] Route `/ai/[slug]/quiz` — 1 câu/screen, progress bar "Câu X/Y"
- [ ] Render từ `tool.quizSchema` dynamic
- [ ] Skip button cho câu optional
- [ ] Submit step cuối → cùng pipeline như hero/chat

**Tech notes:** Swipe transition mobile (CSS only, không cần lib).

**Dependency:** 2.2, 2.3

---

## Story 4.3 — Result page với 1+2 hierarchy [L]

- [ ] **Là** user, **tôi muốn** biết NGAY "mua con nào", không phải so 3 lựa chọn equal.

**Acceptance:**
- [ ] Route `/ai/[slug]/result/[sessionId]`
- [ ] **Hierarchy 1+2**:
  - **#1 card full-width, ảnh lớn, prominent** — default recommendation
  - **#2 và #3 nhỏ hơn ở dưới** ("Hoặc xem 2 lựa chọn khác ↓"), card 50% width, có thể collapse
- [ ] Mỗi card: ảnh + tên + giá + AI reasoning box (border + 🤖 icon) + **confidence dạng TEXT** + CTA "Xem giá"
- [ ] **Confidence text** (không phải %):
  - score ≥ 0.85 → "🤖 **Rất phù hợp** với nhu cầu của bạn"
  - score 0.65-0.85 → "🤖 **Phù hợp** với nhu cầu của bạn"
  - score < 0.65 → "🤖 Có thể cân nhắc"
- [ ] **Optimistic UI**: card render NGAY (<1s) bằng scoring rule; AI reasoning stream vào sau 2-3s không chặn render
- [ ] **Sticky CTA mobile**: "🛒 Xem giá ngay" sticky bottom khi scroll khỏi #1
- [ ] CTA click → `createTrackingRedirect()` → `ClickLog` (với `toolId`, `quizSessionId`, `attributionSource` (= source UTM), `marketplace`)
- [ ] Nếu reasoning fail → template fallback hiện ra (user không biết AI fail)
- [ ] Label/value contrast tuân `feedback_label_value_contrast`
- [ ] **Question refine inline** (câu 4-5 optional): show ở bottom result page "Tinh chỉnh thêm: …?" → re-rank không reload

**Tech notes:** Reuse `normalizeProduct()` ở `apps/web/lib/format.ts`. KHÔNG hardcode field name.

**Dependency:** 3.2, 4.1

---

## Story 4.4 — Email capture INLINE (không modal interrupt) [M]

- [ ] **Là** owner, **tôi muốn** capture email user, **để** build asset compounding — nhưng KHÔNG làm UX khó chịu bằng modal.

**Acceptance:**
- [ ] **Inline form** cuối result page (sau 3 product card), trước related articles
- [ ] **TUYỆT ĐỐI KHÔNG** modal popup/interrupt
- [ ] Email lưu vào `QuizSession.email` + tạo `Subscriber` row link với niche
- [ ] Validation: email format, anti-spam (honeypot + rate limit IP)
- [ ] Thank-you state inline: "✓ Đã đăng ký — sẽ gửi alert khi có deal phù hợp"

**Tech notes:** Reuse `Subscriber` model (codebase đã có `subscribers` module). Cron daily check price → email alert.

**Dependency:** 4.3

---

## Story 4.5 — Multi-marketplace price comparison [M]

- [ ] **Là** user, **tôi muốn** xem giá ở Tiki/Shopee/Lazada cùng lúc.

**Acceptance:**
- [ ] Product card show giá ở 2-4 sàn (đã có affiliate link)
- [ ] Highlight "Rẻ nhất hôm nay: [sàn] [giá] (rẻ hơn [sàn khác] X%)"
- [ ] Mỗi sàn = affiliate link riêng, tracked với `marketplace` field trong ClickLog
- [ ] Nếu chỉ 1 sàn có data → ẩn comparison, show 1 CTA bình thường
- [ ] Mobile: chỉ show top 2 sàn (rẻ nhất + nhì), tap "Xem thêm" expand

**Tech notes:** Cần extend `Product.scrapedData` với `marketplaceListings: [{marketplace, price, url, lastChecked}]`. Crawler/admin nhập manual phase 1.

**Dependency:** 4.3, 1.1

---

## Story 4.6 — Viral share button + OG dynamic [M]

- [ ] **Là** user vừa nhận kết quả AI, **tôi muốn** share cho bạn bè để xin ý kiến.

**Acceptance:**
- [ ] Result page có button "Chia sẻ kết quả" → copy link `/r/[shareSlug]`
- [ ] Share link redirect tới result page với view-only mode
- [ ] OG image dynamic generated (`next/og` ImageResponse): show top 3 product + "AI gợi ý cho [profile]"
- [ ] Hỗ trợ share Facebook / Zalo (native share API mobile) / copy link
- [ ] Track share event + clicks-from-share

**Tech notes:** Shortcode 6-8 char, lưu trong `QuizSession.shareSlug`. OG image cache CDN.

**Dependency:** 4.3

---

## Story 4.7 — Rebrand homepage + meta [S]

- [ ] **Là** visitor, **tôi muốn** hiểu ngay dealvault làm gì khi vào homepage.

**Acceptance:**
- [ ] Homepage = landing tool đơn (Story 4.1) với brand prominent
- [ ] Tagline: "AI chọn [niche] trong 60 giây" mọi nơi (header, meta, OG)
- [ ] Logo có icon 🤖 hoặc ✨
- [ ] Trust section dưới hero: "Phân tích từ N sản phẩm thật, không quảng cáo"
- [ ] SEO meta title/description nhấn AI

**Tech notes:** Update `apps/web/app/page.tsx`, `apps/web/app/layout.tsx` meta, `public/og-image.png`.

**Dependency:** 4.1

---

## Story 4.8 — Short URL + OG image dynamic per Tool [M]

- [ ] **Là** owner share link trên TikTok/FB/Zalo, **tôi muốn** link ngắn + preview image đẹp.

**Acceptance:**
- [ ] Route alias ngắn: `/[short-niche]` redirect 307 tới `/ai/[full-slug]` (vd: `/loc-nuoc` → `/ai/may-loc-nuoc`)
- [ ] OG image dynamic dùng `next/og` cho mọi `/ai/[slug]`:
  - Tagline + niche name + screenshot mock 3 product card
  - Size 1200x630 chuẩn FB/Zalo
- [ ] Twitter card meta đầy đủ
- [ ] Test preview trên Zalo, FB, Telegram (manual)

**Tech notes:** `next/og` ImageResponse trong `app/ai/[slug]/opengraph-image.tsx`. Cache CDN.

**Dependency:** 4.1

---

## Story 4.9 — Trust transparency section [S]

- [ ] **Là** user (lần đầu thấy DealVault), **tôi muốn** biết AI dựa trên data gì, **để** không nghĩ "site lạ, lừa đảo".

**Acceptance:**
- [ ] Section "🤖 AI dựa trên..." trên result page:
  - "{N} sản phẩm trong database (đã admin duyệt)"
  - "Spec từ trang chính hãng"
  - "Giá hôm nay từ {sàn list}"
  - "{M} đánh giá thật từ Tiki/Shopee"
- [ ] Link "Quy trình duyệt sản phẩm" → trang explain HITL process (1 trang ngắn)
- [ ] Trust badge giữa hero và quiz: "✓ Không quảng cáo · ✓ Spec verified · ✓ Cập nhật hàng tuần"

**Tech notes:** Số N, M lấy từ DB count. Trang quy trình mới: `/ve-chung-toi/quy-trinh`.

**Dependency:** 4.3

---

## Story 4.10 — Interstitial redirect với save-link CTA [M]

- [ ] **Là** user click "Xem giá", **tôi muốn** có cơ hội lưu lại result trước khi mất context sang Tiki.

**Acceptance:**
- [ ] Trước khi redirect Tiki/Shopee, hiện interstitial 2s
- [ ] Lưu link = copy URL `/r/[shareSlug]` vào clipboard + show toast "✓ Đã copy link"
- [ ] User có thể skip → redirect ngay
- [ ] Tracking event "interstitial_save_clicked" để đo
- [ ] Mobile: interstitial full-screen, desktop: modal

**Tech notes:** ClickLog vẫn tạo NGAY khi click CTA (không chờ interstitial). Interstitial chỉ là UI delay, không block tracking.

**Dependency:** 4.3, 4.6

---

## Story 4.11 — QuizSession restore từ localStorage [S]

- [ ] **Là** user quay lại site sau khi click sang Tiki/Shopee, **tôi muốn** thấy lại result cũ, không phải làm quiz lại.

**Acceptance:**
- [ ] Khi tạo `QuizSession` → lưu `{sessionId, shareSlug, timestamp, nicheSlug}` vào localStorage key `dealvault:last-session`
- [ ] Homepage / tool page có banner nhỏ nếu detect localStorage:
  - "👋 Bạn đã làm quiz {nicheSlug} {X giờ trước}. [Xem lại kết quả]"
- [ ] Click → redirect tới `/ai/[slug]/result/[sessionId]`
- [ ] TTL 7 ngày; sau đó xoá tự động

**Tech notes:** Client-side only. KHÔNG dùng cookie (Safari ITP block).

**Dependency:** 4.3

---

## Story 4.12 — Sticky CTA mobile [S]

- [ ] **Là** user trên mobile scroll xuống đọc reasoning, **tôi muốn** CTA luôn tay với.

**Acceptance:**
- [ ] Khi scroll khỏi #1 card trên mobile → CTA "🛒 Mua trên {sàn rẻ nhất} — {giá}" sticky bottom
- [ ] Click sticky CTA → cùng flow như click card CTA (tracking + redirect)
- [ ] Desktop: không cần sticky (viewport đủ thấy)
- [ ] Smooth fade-in animation khi xuất hiện

**Tech notes:** `position: fixed; bottom: 0` với safe-area-inset cho iOS notch.

**Dependency:** 4.3

---

# EPIC 5 — Analytics + Distribution

**Mục tiêu:** Đo được full funnel + bắt đầu kéo traffic về.

## Story 5.1 — Tool funnel analytics dashboard [M]

- [ ] **Là** owner, **tôi muốn** thấy funnel start → complete → click → conversion.

**Acceptance:**
- [ ] Trang `/admin/tools/[id]/analytics`
- [ ] Metric: quiz starts, completes, completion rate, avg time, clicks (per product), conversions
- [ ] Filter theo source (`utm_source` / referrer)
- [ ] Filter theo date range (7d/30d/all)
- [ ] Show top 5 product được recommend / click / convert

**Tech notes:** Query `QuizSession` + join `ClickLog` + `ConversionWebhook` qua `quizSessionId`. Cache revalidate 1h.

**Dependency:** 4.3

---

## Story 5.2 — Per-source tracking [S]

- [ ] **Là** owner, **tôi muốn** biết kênh nào ra tiền (TikTok vs SEO vs FB).

**Acceptance:**
- [ ] Mọi link share/marketing có `?source=<kênh>` (vd: `?source=tiktok-video-1`)
- [ ] `QuizSession.source` lưu giá trị
- [ ] Dashboard breakdown conversion theo source
- [ ] Doc convention naming source trong `docs/CONTEXT.md`

**Tech notes:** Middleware Next read `?source=` param + set cookie 30 ngày (hoặc localStorage để bypass Safari ITP).

**Dependency:** 5.1

---

## Story 5.3 — KOL outreach prep [S]

- [ ] **Là** owner, **tôi muốn** danh sách 20-30 KOL nhỏ để outreach.

**Acceptance:**
- [ ] Spreadsheet (Notion / `docs/kol-outreach.md`) với: tên, kênh, follower, contact, niche fit
- [ ] Template message outreach (revenue share, không upfront)
- [ ] Tracking outreach status: sent / replied / converted

**Tech notes:** Không phải task code. Dependency của 5.5.

**Dependency:** Epic 0 pass

---

## Story 5.4 — TikTok content batch [M]

- [ ] **Là** owner, **tôi muốn** 5 video TikTok demo tool.

**Acceptance:**
- [ ] Script 5 video: angle khác nhau (problem-aware, solution demo, comparison, testimonial mock, deal alert)
- [ ] Quay + edit (CapCut)
- [ ] Post 1 video / ngày × 5 ngày, mỗi video có UTM `?source=tiktok-v<n>`
- [ ] Đo view / CTR link bio sau 7 ngày

**Tech notes:** Skill gating — có thể thuê freelancer 500k-2tr/video hoặc partner KOL.

**Dependency:** 4.7

---

## Story 5.5 — Launch ngày D [M]

- [ ] **Là** owner, **tôi muốn** launch tool tới audience đã warm.

**Acceptance:**
- [ ] Flip `Niche.status = ACTIVE` cho niche launch
- [ ] Email blast tới waitlist (Epic 0) với link tool
- [ ] Post 3 nơi đã seed Epic 0.3 + 5 nơi mới
- [ ] Activate KOL partnership (5.3)
- [ ] Post TikTok video #1 (5.4)
- [ ] Monitor War Room 4-6 tiếng đầu, fix bug nóng nếu có

**Tech notes:** Rollback plan: critical bug → flip `Niche.status = INACTIVE`, show coming-soon page lại.

**Dependency:** 4.7, 5.1, 5.3, 5.4

---

## Story 5.6 — Inventory check cron (blacklist OOS product) [M]

- [ ] **Là** owner, **tôi muốn** không recommend product hết hàng.

**Acceptance:**
- [ ] Nest scheduler chạy mỗi 6h
- [ ] Check inventory status từ Tiki/Shopee API (hoặc scrape) cho mọi `Product` PUBLISHED
- [ ] Set flag `Product.scrapedData.inventoryStatus: IN_STOCK | OOS | UNKNOWN`
- [ ] Scoring engine (Story 2.3) skip product OOS
- [ ] Admin alert nếu > 30% product OOS trong 1 niche

**Tech notes:** Tiki có API public; Shopee cần scrape. Phase 1 chỉ check Tiki, đủ.

**Dependency:** 1.3, 2.3

---

# EPIC 6 — Engagement Layer (conditional)

**⚠️ GATE:** Chỉ làm Epic 6 nếu sau 1 tuần launch có ≥ 5 conversion thật.

## Story 6.1 — Follow-up chat trên result page [M]

- [ ] **Là** user vừa xem result, **tôi muốn** hỏi AI thêm.

**Acceptance:**
- [ ] Sticky chat widget góc phải dưới result page
- [ ] Suggested questions: "So sánh #1 vs #2", "Có con rẻ hơn không?", "[câu hỏi đặc thù niche]"
- [ ] AI trả lời chỉ từ product attributes đã HITL (constraint prompt)
- [ ] Mỗi câu hỏi = 1 AI call, log vào `QuizSession.followUpQuestions[]` (cần extend schema)

**Tech notes:** Cost guard: limit 5 câu/session.

**Dependency:** 4.3

---

## Story 6.2 — "Hỏi AI thêm về con này" per card [S]

- [ ] **Là** user, **tôi muốn** hỏi sâu về 1 sản phẩm cụ thể.

**Acceptance:**
- [ ] Button "💬 Hỏi thêm" trên mỗi product card
- [ ] Modal mini-chat focused vào product đó
- [ ] AI có context: product spec + user profile + reasoning đã sinh
- [ ] Track engagement metrics

**Tech notes:** Reuse infra 6.1.

**Dependency:** 6.1

---

## Story 6.3 — Email drip cho recurring revenue [M]

- [ ] **Là** owner, **tôi muốn** auto-email user về thay lõi/filter (niche recurring).

**Acceptance:**
- [ ] Cron job (Nest scheduler) chạy daily check
- [ ] User mua máy lọc nước/không khí → schedule email "đến lúc thay lõi" sau 6 tháng
- [ ] Email có affiliate link đặt lõi
- [ ] Track open / click / conversion từ email source

**Tech notes:** Service email (Resend / SendGrid). Manual blast trước, automate sau khi list > 500.

**Dependency:** 4.4

---

## Story 6.4 — A/B test reasoning template vs AI [S]

- [ ] **Là** owner, **tôi muốn** đo AI reasoning có thật sự tăng CTR vs template.

**Acceptance:**
- [ ] Feature flag `useAIReasoning: boolean` per session (50/50 split)
- [ ] Lưu `QuizSession.reasoningMode: 'ai' | 'template'`
- [ ] So sánh CTR + conversion rate 2 nhóm sau 2 tuần
- [ ] Decision: nếu AI uplift < 10% → fallback template, giữ AI chỉ cho follow-up chat

**Tech notes:** Tránh confirmation bias.

**Dependency:** 5.1, post-launch data

---

## Story 6.5 — Post-click email drip (3 ngày, 7 ngày) [M]

- [ ] **Là** owner, **tôi muốn** bring user back sau khi họ click sang Tiki/Shopee.

**Acceptance:**
- [ ] Khi user có email + click affiliate → schedule 2 email:
  - Day 3: "Bạn đã chọn {product} chưa? Nếu cần so sánh lại hoặc hỏi thêm…" + link `/r/[shareSlug]`
  - Day 7: "{N} deal mới tuần này cho {niche}" + 3 product mới nhất
- [ ] Email có UTM `?source=email-drip-d{X}`
- [ ] Unsubscribe link bắt buộc (chống spam list)
- [ ] Track open/click rate per email type

**Tech notes:** Resend hoặc SendGrid. Nest scheduler + email queue table.

**Dependency:** 4.4, 5.5

---

## Story 6.6 — Zalo OA integration (optional, phase later) [L]

- [ ] **Là** VN user, **tôi muốn** nhận thông báo qua Zalo (kênh quen), không phải email.

**Acceptance:**
- [ ] Result page có button "📱 Nhận thông báo qua Zalo"
- [ ] Click → redirect Zalo OA follow flow
- [ ] Map user Zalo ID ↔ QuizSession để gửi message (reuse `Subscriber.zaloUserId`)
- [ ] Send broadcast: deal alert, thay lõi reminder, niche mới
- [ ] Comply Zalo OA policy (không spam, có opt-out)

**Tech notes:** Phase rất sau — cần Zalo OA verified (~2-4 tuần setup), tốn phí. Chỉ làm nếu validate email rate < 5%.

**Dependency:** 6.5

---

# Tổng kết

| Epic | # stories | Tổng effort | Gate |
|---|---|---|---|
| 0. Validation | 3 | ~1 tuần | ≥50 email/7 ngày |
| 1. Foundation | 4 | ~1 tuần | Schema migrated, 30+ product PUBLISHED |
| 2. Tool Builder | 4 | ~1-1.5 tuần | Admin tự soạn được Tool đầu tiên |
| 3. AI Integration | 4 | ~1 tuần | Reasoning thật, fallback graceful |
| 4. Storefront UX | 12 | ~2-2.5 tuần | Tool launch-ready, brand AI rõ |
| 5. Analytics + Distribution | 6 | ~1 tuần | Launch day, ≥100 quiz start tuần 1 |
| 6. Engagement (conditional) | 6 | ~1.5 tuần | CHỈ nếu ≥5 conversion tuần 1 |

**Tổng: ~7-8 tuần solo dev** (Epic 0-5), Epic 6 sau validation.

## Dependency graph

```
Epic 0 ───► Epic 1 ───► Epic 2 ───► Epic 3
                │            │           │
                └────────────┼──────────►Epic 4 ───► Epic 5 ──(gate)──► Epic 6
                             │           ▲
                             └───────────┘
```

Epic 2 + 3 có thể chạy song song. Epic 4 cần cả 2.

## Success metrics — gates trước khi mở niche thứ 2

Sau 6 tuần, **không mở niche mới** trừ khi đạt:

| Metric | Threshold |
|---|---|
| Quiz/chat completion rate | ≥ 40% |
| Result → affiliate click CTR | ≥ 15% |
| Click → conversion (Accesstrade postback) | ≥ 1% |
| ≥ 5 conversion thật trong tuần 6 | (chứ không phải 0) |
| Cost AI / session | ≤ $0.01 |

## Risk register

| Risk | Mitigation |
|---|---|
| Distribution không lên (TikTok/SEO không kéo traffic) | Pre-launch validation (Epic 0) + multi-source (5.2) + KOL (5.3) |
| Accesstrade economics tệ (validation rate thấp) | Multi-marketplace (4.5) — Tiki/Shopee/Lazada direct |
| AI cost spiral | Cache (3.3), template fallback, A/B test (6.4) |
| Solo dev burnout | Time-box từng epic, checkpoint cuối epic |
| AI hype timing cool down | Launch nhanh trong 6 tuần (đừng kéo dài) |
| Conflict route `/tools/[slug]` legacy 308 redirect | Đã switch sang `/ai/[slug]` |

## Không làm trong refactor này

- ❌ Refactor admin UI / Refinery — đã tốt (project_admin_ui_conventions)
- ❌ Migration đụng tới `trackingCode` contract (sacred)
- ❌ Mobile app, multi-language, social login, crypto, premium subscription, B2B SaaS pivot
- ❌ Mở 2 niche song song tuần 1-6
- ❌ AI mass-produce article (Google de-rank)

---

**Last updated:** 2026-05-26
