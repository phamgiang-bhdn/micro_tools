# Article V2 — Multi-Agent Authoring System

**Status:** Spec v1 (2026-05-19). Sprint 1 implementation in progress.
**Owner:** dealvault platform team.
**Audience:** anyone touching `apps/api/src/services/article*`, `apps/api/src/modules/admin/admin.controller.ts` article handlers, hoặc `apps/web/app/admin/articles/**`.

---

## 1. Motivation

Hệ thống Article hiện tại (one-shot Gemini call → blocks JSON → DRAFT → admin publish) bị 6 vấn đề:

1. **One-shot generation** — không có vòng research → outline → draft → critique → fix → bài "nhạt".
2. **Không có web search thực** — AI chỉ thấy product trong DB + tự "đoán" discovered products → stale + hallucinate.
3. **Không có review user thật** — bài review chỉ là AI prose dựa trên `Product.scrapedData` → thin-content, không có UGC moat.
4. **Gate review yếu** — DRAFT có thể PUBLISH thẳng không qua reviewer (`admin.controller.ts:842`) — khác hẳn Refinery có HITL bắt buộc.
5. **Validation chỉ là zod shape** — không check word count thật, URL liveness, duplicate, EEAT signal.
6. **UX admin nghèo nàn** — form nhập topic → chờ → editor markdown; không thấy progress, không retry block riêng, không edit block-level.

Hệ quả: scale ra 100 bài thì "100 bài như 1" — Google đánh thin-content nặng, không có signal EEAT, attribution kém.

## 2. Goals

- **Original research** mỗi bài: ≥3 data point độc nhất (review thật, snapshot giá, stat tổng hợp).
- **Latest info** qua web search realtime, không phụ thuộc model knowledge cutoff.
- **HITL gate cứng**, parity với Refinery — không có path bypass.
- **Anti-mono-voice**: angle uniqueness, author rotation, structural variation, n-gram + embedding dedup.
- **Visual & structural diversity**: section linh hoạt + TOC + ảnh từ multi-source với attribution.
- **Traceable**: mọi claim cite được, mọi stage retry được.

## 3. Architecture

### 3.1 Pipeline overview

```
[1. Brief Builder] → [2. Research Agent] → [3. Review Scraper]
   → [4. Outline Agent] → [5. Image Agent] → [6. Writer Agent]
   → [7. Critic Agent] ⇄ [Writer revise loop, max 2]
   → [8. Fact-Check Agent] → [9. HITL Review] → PUBLISHED
```

Mỗi stage là 1 module riêng (`apps/api/src/modules/article-pipeline/stages/<stage>.ts`) implements interface `PipelineStage`:

```ts
interface PipelineStage<Ctx> {
  name: ArticlePipelineStage; // enum
  run(ctx: Ctx): Promise<StageResult<Ctx>>;
}
```

Stage runner (`pipeline.runner.ts`) load Article, lookup status, dispatch tới stage tương ứng, persist output vào `ArticleGenerationRun`. Mỗi stage có thể retry độc lập qua admin endpoint.

### 3.2 State machine

```
DRAFT_BRIEF
  ↓ (Brief Builder approves angle uniqueness)
RESEARCHING
  ↓ (Research Agent done — ≥3 sources gathered)
REVIEWS_SCRAPED
  ↓ (Review Scraper done — ≥10 reviews/product hoặc skip nếu type=BUYING_GUIDE without products)
OUTLINE_READY
  ↓ (Outline Agent done — sections + summaries + evidence_refs)
IMAGES_READY
  ↓ (Image Agent done — mỗi section ≥1 ảnh hoặc visual placeholder)
DRAFTING
  ↓ (Writer Agent done all sections)
SELF_CRITIQUED
  ↓ (Critic pass hoặc đã exhaust revise quota → flag)
FACT_CHECKED
  ↓ (Fact-Check pass)
PENDING_REVIEW           ← gate cứng, replaces DRAFT
  ↓ admin approve
PUBLISHED

# Side states
NEEDS_REVISION   ← Critic / Fact-Check fail nhiều lần → human takeover
FAILED           ← stage throw không recover được
ARCHIVED         ← admin archive
```

`ArticleStatus` enum thêm: `DRAFT_BRIEF | RESEARCHING | REVIEWS_SCRAPED | OUTLINE_READY | IMAGES_READY | DRAFTING | SELF_CRITIQUED | FACT_CHECKED | PENDING_REVIEW | NEEDS_REVISION`. Giữ `DRAFT | PUBLISHED | ARCHIVED | FAILED | GENERATING` (legacy, deprecated nhưng không drop ngay — backward compat với articles cũ).

### 3.3 Data model

#### `Article` (mở rộng)

Thêm fields:
- `briefJson Json?` — output của Brief Builder (thesis, persona, target keywords, intent, layout variant, author id).
- `outlineJson Json?` — output Outline Agent (sections tree + evidence refs).
- `authorId String? @db.Uuid` — FK Author.
- `layoutVariant String?` — `magazine | technical | narrative | comparison-heavy | listicle`.
- `wordCount Int?` — computed sau writer/critic.
- `readabilityScore Float?` — Flesch reading ease.
- `evidenceFreshAt DateTime?` — timestamp gần nhất fact-check pass (cho refresh cron).
- `revisionCount Int @default(0)` — số lần writer-critic loop chạy.

#### `Section` (mới)

```prisma
model ArticleSection {
  id              String   @id @default(uuid()) @db.Uuid
  articleId       String   @db.Uuid
  anchorSlug      String           // dùng cho URL hash #anchorSlug
  heading         String
  summary         String           // 1-2 câu cho TOC
  order           Int
  blocks          Json     @db.JsonB   // ArticleBlock[] (giữ schema cũ + thêm block mới)
  evidenceRefs    String[] @db.Uuid    // refs vào ArticleEvidence.id
  wordCount       Int      @default(0)
  status          String   @default("DRAFTING") // DRAFTING | WRITTEN | APPROVED | NEEDS_REVISION
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  article         Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([articleId, anchorSlug])
  @@index([articleId, order])
}
```

`Article.body` (markdown fallback) vẫn giữ cho SEO + storefront fallback khi sections empty (backward compat).

#### `Author` (mới)

```prisma
model Author {
  id              String   @id @default(uuid()) @db.Uuid
  slug            String   @unique
  name            String
  bio             String?
  avatarUrl       String?
  voiceProfile    Json     @db.JsonB    // tone, vocab, sentenceLen, quirks
  expertiseNiches String[] @db.Uuid     // Niche.id list
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  articles        Article[]
}
```

`voiceProfile` shape:
```ts
{
  tone: "serious" | "witty" | "technical" | "conversational" | "storytelling";
  vocabRange: "casual" | "neutral" | "formal";
  sentenceLength: "short" | "medium" | "long" | "mixed";
  englishLoanwords: "minimal" | "moderate" | "frequent";
  openingPatterns: string[];  // pick từ pool: question, anecdote, stat, contrarian, news-hook, scenario, myth-bust
  quirks: string[];           // ["hay dùng dấu —", "kết bài bằng câu hỏi mở"...]
}
```

#### `ArticleEvidence` (mới — moat chính)

```prisma
enum EvidenceType {
  FACT          // spec, news, comparison
  REVIEW        // user review (verbatim quote)
  PRICE         // price snapshot
  SPEC          // technical spec
  IMAGE         // image with attribution
  NEWS          // recent news headline
}

model ArticleEvidence {
  id            String       @id @default(uuid()) @db.Uuid
  articleId     String       @db.Uuid
  type          EvidenceType
  productId     String?      @db.Uuid       // optional FK Product
  sourceUrl     String
  sourceDomain  String                       // hostname for filter
  title         String?
  payload       Json         @db.JsonB       // shape per type
  contentHash   String                       // SHA256 of payload — dedupe
  fetchedAt     DateTime     @default(now())
  expiresAt     DateTime?                    // null = không expire
  factCheckPassed Boolean    @default(false)
  factCheckedAt DateTime?
  article       Article      @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId, type])
  @@index([contentHash])
  @@index([sourceDomain])
}
```

#### `ProductReview` (mới — cào từ ngoài)

```prisma
model ProductReview {
  id            String   @id @default(uuid()) @db.Uuid
  productId     String   @db.Uuid
  source        String                    // "shopee" | "tiki" | "lazada" | "accesstrade" | "manual"
  sourceUrl     String?
  author        String?
  rating        Decimal?  @db.Decimal(3, 2)
  title         String?
  body          String
  verifiedBuyer Boolean   @default(false)
  reviewDate    DateTime?
  scrapedAt     DateTime  @default(now())
  sentiment     String?                   // "positive" | "neutral" | "negative" (sau khi NLP)
  topicTags     String[]                  // ["pin", "lực hút", "ồn"...]
  raw           Json?     @db.JsonB
  product       Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, source, author, body])  // dedupe
  @@index([productId, source])
  @@index([productId, rating])
}
```

#### `ArticleGenerationRun` (mới — observability)

```prisma
model ArticleGenerationRun {
  id            String   @id @default(uuid()) @db.Uuid
  articleId     String   @db.Uuid
  stage         String                     // ArticlePipelineStage value
  agent         String                     // identifier ("brief-builder", "research-tavily"...)
  model         String?                    // gemini-2.0-flash, etc.
  promptName    String?
  inputHash     String?
  inputSize     Int?
  outputSize    Int?
  durationMs    Int?
  costEstimate  Decimal?  @db.Decimal(10, 6)
  success       Boolean   @default(false)
  errorReason   String?
  startedAt     DateTime  @default(now())
  finishedAt    DateTime?
  article       Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([articleId, startedAt])
  @@index([stage, success])
}
```

### 3.4 Block schema mở rộng

Giữ 9 block hiện tại (`hero_quote, criteria_grid, product_spotlight, callout, prose, comparison, pros_cons, faq, verdict`). Thêm:

```ts
// Image with attribution (license-aware)
{ type: "image", src, alt, caption?, attribution, license, sourceUrl, width, height }

// Gallery
{ type: "image_gallery", items: ImageBlock[], layout: "grid" | "carousel" }

// Verbatim review quote with citation
{ type: "review_quote", productId, author?, rating?, body, sourceUrl, verifiedBuyer }

// Price history sparkline
{ type: "price_history", productId, points: [{date, price}], note? }

// External citation inline
{ type: "citation", claim, sourceUrl, sourceTitle, fetchedAt }

// Section TL;DR (đầu mỗi section, render cũng vào TOC)
{ type: "section_tldr", bullets: string[] }
```

## 4. Stage specs

### 4.1 Brief Builder (`stages/brief-builder.ts`)

**Input:** `{ type, topic, nicheId?, productRef?, pinnedProductIds[] }`.

**Output (`briefJson`):**
```ts
{
  thesis: string;            // 1 câu khẳng định độc nhất
  intent: "transactional" | "commercial-investigation" | "comparison" | "informational";
  targetKeywords: string[];  // SEO keyword chính + LSI
  competitorUrls: string[];  // để Research Agent đối chiếu
  persona: { name, painPoint, budget?, expertise };
  layoutVariant: "magazine" | "technical" | "narrative" | "comparison-heavy" | "listicle";
  targetDepth: "shallow" | "medium" | "deep-dive";  // 800-1200 / 1500-2200 / 2500+
  authorId: string;          // chosen rotation
  hookPattern: "contrarian" | "anecdote" | "stat" | "news" | "scenario" | "question" | "myth-bust" | "vivid";
}
```

**Uniqueness check:** embed `thesis` (gemini text-embedding-004 hoặc OpenAI ada-002 stub), so cosine với tất cả `briefJson.thesis` của articles cùng `nicheId` status ≠ ARCHIVED. Nếu > 0.85 → fail stage, force re-brief với prompt: "thesis trùng với bài X, đề xuất góc khác".

**Author rotation:** chọn author có:
1. `expertiseNiches` chứa `nicheId`.
2. Chưa viết bài nào trong niche này trong 3 bài gần nhất (round-robin).
3. Random tie-break.

**Hook rotation:** loại trừ pattern của 3 bài gần nhất cùng niche.

### 4.2 Research Agent (`stages/research.ts`)

**Tool:** Web Search API (Tavily mặc định, có thể swap Serper/Brave qua env `RESEARCH_PROVIDER`).

**Queries** auto-sinh từ brief:
- `<topic> review tốt nhất <year>`
- `<topic> giá <vietnam>`
- `<topic> so sánh <brand_a> vs <brand_b>` (theo competitorUrls)
- `<topic> thông số mới nhất`
- `<topic> lỗi thường gặp`

**Per result:**
1. Filter domain whitelist mở rộng (thêm `genk.vn`, `tinhte.vn`, `vnreview.vn`, `voz.vn`, `cellphones.com.vn`, `dienmayxanh.com`, `fptshop.com.vn`...).
2. WebFetch content → AI extract facts JSON (claim, value, sourceUrl, date).
3. Persist mỗi fact thành `ArticleEvidence` type=`FACT` hoặc `NEWS`.

**Pass criteria:** ≥3 evidence từ ≥3 domain khác nhau.

### 4.3 Review Scraper (`stages/review-scraper.ts`)

Skip nếu không có pinnedProductIds (buying guide không tied product cụ thể).

**Primary source:** Accesstrade product detail API nếu có review field.
**Fallback:** Playwright scrape Shopee/Lazada/Tiki product page review section (giới hạn rate, respect robots).

**Per review:**
- Persist `ProductReview` (dedupe by `productId + source + author + body`).
- NLP sentiment + topic tag (gemini classify, prompt template `review-classify`).
- Tạo `ArticleEvidence` type=`REVIEW` link tới `ProductReview.id`.

**Pass criteria:** ≥10 reviews/product hoặc ≥20 total nếu nhiều product, hoặc skip có explicit reason.

### 4.4 Outline Agent (`stages/outline.ts`)

**Input:** brief + evidence.

**Output (`outlineJson`):**
```ts
{
  sections: [
    {
      anchorSlug: string;     // kebab-case, unique trong article
      heading: string;
      summary: string;        // 1-2 câu cho TOC
      intent: string;         // why this section exists
      evidenceRefs: string[]; // ArticleEvidence.id
      blockTypeHints: string[];   // ["prose", "review_quote", "product_spotlight"...]
      isRequired: boolean;
      estimatedWords: number;
    }
  ];
  totalEstimatedWords: number;
}
```

**Section templates per intent:**
- `transactional` (buying guide): Hook → Tiêu chí → Top picks → So sánh → FAQ → Verdict.
- `commercial-investigation` (review): TL;DR/rating → Design → Performance → Pros/Cons → User reviews → Verdict.
- `comparison`: Spec side-by-side → Use cases → Giá → Winner.
- `informational`: Problem → Concept → Steps → Pitfalls → Product picks.

Required vs optional: 3-4 required, 5-7 optional (Outline chọn 2-4). **Order tự do** — không hardcode FAQ cuối.

**Rule:** mỗi section phải có ≥1 `evidenceRefs` (trừ Hook/Verdict cho phép subjective).

### 4.5 Image Agent (`stages/image.ts`)

**Per section** quyết định visual cần (hero / product-shot / lifestyle / comparison / infographic).

**Source priority:**
1. `Product.scrapedData.images` (đã có quyền).
2. Unsplash API (`UNSPLASH_ACCESS_KEY`) — keyword refined Vietnamese context.
3. Pexels API fallback.
4. Wikimedia Commons cho ảnh kỹ thuật.

**Per image:**
- Validate HEAD 200, width ≥ 1200, content-type `image/*`, không NSFW (Unsplash đã filter).
- Sinh `alt` text qua AI dựa context section.
- Persist `ArticleEvidence` type=`IMAGE` với `payload: { src, attribution, license, photographer, width, height }`.

**Pass criteria:** mỗi section ≥1 image hoặc explicit reason "text-only" (vd FAQ, verdict).

**Cấm:** scrape ảnh review Shopee/Tiki/Lazada (ToS risk).

### 4.6 Writer Agent (`stages/writer.ts`)

**Per-section call** (không phải cả bài 1 call).

**Input:** brief + section spec + evidence_refs (resolved) + author voiceProfile.

**Output:** blocks JSON cho section đó.

**Hard rules embedded in prompt:**
- Mọi claim phải link tới evidence (block `citation` hoặc inline ref).
- Không dùng phrase blacklist (config trong PromptTemplate `phrase-blacklist`).
- Per-section min words = `section.estimatedWords * 0.8`.
- Voice profile injected as system prompt.
- Hook pattern (chỉ section đầu).

**Persist:** update `ArticleSection.blocks`, `wordCount`, `status="WRITTEN"`.

### 4.7 Critic Agent (`stages/critic.ts`)

**Checks** per article:
1. **Word count total** vs `targetDepth` band.
2. **N-gram overlap** (3-5 từ) với corpus bài đã PUBLISHED cùng niche (Postgres `pg_trgm` hoặc external lib). Threshold 15%.
3. **Phrase blacklist** match.
4. **Section thinness** — section nào `wordCount < section.estimatedWords * 0.6` → flag.
5. **Visual diversity** — section không có image/table/callout/spotlight nào → flag "wall of text".
6. **Evidence coverage** — section claim không cite → flag.
7. **Embedding distance** per section vs corpus.

**Output:** `issuesJson: { sectionId, severity: "block"|"warn", reason, suggestion }[]`.

**Loop:** nếu có severity=block, đẩy lại Writer cho từng section bị flag. Max 2 vòng. Sau đó status=`NEEDS_REVISION` cho HITL.

### 4.8 Fact-Check Agent (`stages/fact-check.ts`)

**Per evidence với type=FACT/PRICE/NEWS:**
- HEAD request sourceUrl → expect 200.
- WebFetch lại → AI verify claim còn match content không.
- Update `ArticleEvidence.factCheckPassed` + `factCheckedAt`.

**Pass:** ≥80% evidence pass. Update `Article.evidenceFreshAt = now()`.

### 4.9 HITL Review

Status `PENDING_REVIEW`. Admin UI bắt buộc xem:
- Word count, readability, n-gram score
- Issues từ Critic (block severity highlighted)
- Section-by-section navigator với approve/regenerate per section
- Evidence panel (mở source URL được)
- JSON-LD preview (Article + FAQPage + ItemList/Review/AggregateRating)

Actions: `Approve → PUBLISHED` / `Request revision → NEEDS_REVISION` (chọn stage retry) / `Edit inline`.

**Không có path bypass.** Endpoint `POST /admin/articles/:id/publish` reject nếu status ≠ `PENDING_REVIEW`.

## 5. Anti-mono-voice mechanisms (recap)

| Lớp | Cơ chế | Stage thực thi |
|---|---|---|
| Angle uniqueness | embedding cosine < 0.85 vs niche corpus | Brief Builder |
| Author rotation | round-robin theo niche + lookback 3 bài | Brief Builder |
| Hook variation | pool 8 pattern, không lặp 3 bài gần | Brief Builder |
| Phrase blacklist | từ điển cliché AI VN | Critic |
| N-gram dedup | 3-5 gram overlap ≤ 15% | Critic |
| Embedding dedup section | cosine vs corpus | Critic |
| Structural variation | section template required+optional, order tự do | Outline |
| Length variation | targetDepth band | Brief + Critic |
| Unique data points | ≥3 evidence độc nhất (contentHash) | Research + Review Scraper |
| Layout variation | 5 layoutVariant render khác nhau | Web side |
| Voice profile | per-author tone/vocab/quirks | Writer (system prompt) |

## 6. Refresh & freshness

Cron `article-refresh-cycle` (default `0 2 * * *`):
- Mọi article PUBLISHED với `evidenceFreshAt < now - 90d`.
- Re-run Research Agent + Fact-Check.
- Nếu ≥30% evidence stale/dead/changed → tạo `Article` revision với `status=PENDING_REVIEW`, banner "Updated [date]" trên storefront sau approve.

## 7. Feedback loop

- GA4 ingest qua `/api/v1/admin/article-engagement` (Sprint 3+).
- Bài bounce > 70% AND time-on-page < 30s → flag `LOW_ENGAGEMENT`, đưa lên admin dashboard.
- Niche coverage map: dashboard hiển thị thesis matrix mỗi niche để editorial avoid gap/dup.

## 8. Admin UI (Sprint 3)

### List page `/admin/articles`
- Filter: status, type, niche, layoutVariant, engagement flag.
- Column: title, status pill (multi-color theo new states), niche, author, wordCount, evidenceFreshAt, lastReviewedBy.

### Detail page `/admin/articles/[id]`
- Header: pipeline timeline (9 stage, mỗi stage có status pill + duration + retry button).
- Left: section navigator (TOC list, click jump). Per section: approve / regenerate / edit blocks inline.
- Right (split): evidence panel (filter by type, mở source URL); image panel (thumbnail, license, swap button).
- Footer: critic issues list + JSON-LD preview tabs.

### Author management `/admin/authors`
- List + create/edit dialog (FormDialog) với voiceProfile editor (structured form).

## 9. Storefront (Sprint 3)

### `/blog/[slug]`
- Hero theo `layoutVariant`.
- Sticky TOC sidebar (desktop), collapsible (mobile). Mỗi entry: heading + summary + read time. URL hash sync.
- Section render: `BlockRenderer` per section. Mỗi section có `id={anchorSlug}`.
- JSON-LD: `Article` + `FAQPage` + `ItemList` (buying guide) hoặc `Review` + `AggregateRating` (review). `Person` author + `Organization` publisher.
- Author bio card cuối bài.
- "Updated [date]" banner nếu có revision history.

## 10. Env additions

```
# Web search (Research Agent)
RESEARCH_PROVIDER=tavily         # tavily | serper | brave
TAVILY_API_KEY=
SERPER_API_KEY=
BRAVE_SEARCH_API_KEY=

# Image search
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=

# Embedding for uniqueness
EMBEDDING_PROVIDER=gemini        # gemini | openai
OPENAI_API_KEY=                  # optional

# Pipeline tuning
ARTICLE_PIPELINE_ENABLED=true
ARTICLE_REVISE_MAX_LOOPS=2
ARTICLE_REFRESH_CRON="0 2 * * *"
ARTICLE_FRESHNESS_DAYS=90
ARTICLE_NGRAM_THRESHOLD=0.15
ARTICLE_ANGLE_SIMILARITY_THRESHOLD=0.85

# Review scraping
REVIEW_SCRAPE_PROVIDER=accesstrade   # accesstrade | playwright | none
REVIEW_SCRAPE_MIN_PER_PRODUCT=10
```

## 11. Migration strategy

- **Sprint 1** chỉ migrate schema + state machine skeleton. Pipeline cũ (one-shot) chạy song song qua flag `ARTICLE_LEGACY_MODE=true` → admin có thể fallback nếu cần.
- **Sprint 2** implement từng agent, mỗi agent có stub mode (returns placeholder) cho phép pipeline chạy end-to-end ngay khi 1 agent xong.
- **Sprint 3** UI mới + storefront upgrade + refresh cron.
- Articles cũ giữ nguyên `status=PUBLISHED` + legacy schema; không force migrate.

## 12. Out of scope (v1)

- Multi-language (chỉ tiếng Việt).
- User-submitted reviews trên storefront (read-only từ scraping).
- Auto A/B test hook variation (manual nếu cần).
- Real-time price tracker widget (Sprint 4+).
- Bulk article generation queue (Sprint 4+).

## 13. Open questions

- **Review scraping legal**: Shopee/Tiki ToS không cho phép scrape rộng. Strategy đề xuất: ưu tiên Accesstrade product detail API nếu có; Playwright fallback chỉ scrape page count thấp (10-20 review/product) với delay tôn trọng + cache lâu. **Cần legal review trước khi enable production.**
- **Embedding cost**: gemini text-embedding-004 free tier hạn. Cân nhắc batch embed corpus offline.
- **Tavily pricing**: $0.005/search. Mỗi bài 5 query = $0.025. 100 bài/tháng = $2.5. OK cho v1.
