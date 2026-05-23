# STORY-10 — Article wizard 1-form: topic + niche → AI bg → email notify

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P1
**Estimate:** 4h
**Dependencies:** STORY-04 (Cơ hội tuần widget tạo URL với prefill params).

## Context

Hiện tại `/admin/articles/new` là form **đa-field**:
- Niche dropdown
- Type dropdown (BUYING_GUIDE / REVIEW)
- Topic input
- Product picker (multi-select)
- Author select
- Custom prompt overrides
- Tags
- ...

Gà mờ:
- Không biết chọn type nào.
- Không biết pick product nào.
- Không biết "custom prompt override" để làm gì.
- Form scrolling dài → bỏ giữa chừng.

Sau khi submit, operator phải đợi 3-5 phút staring pipeline progress để biết AI xong chưa → mất thời gian.

**Giải pháp wizard 1-form**:
- 3 field bắt buộc: topic + niche + (auto-detect type).
- Auto-pick top 5 product trong niche làm productHints (operator có thể override sau review).
- Auto-pick author tốt nhất cho niche (lazy: pick author đầu tiên với matching voice profile).
- Submit → pipeline chạy ngầm.
- Operator KHÔNG cần đợi → leave page → email notification khi xong.
- Quay lại `/admin/articles/[id]` review + publish khi rảnh.

**Type auto-detect**:
- Topic có từ "review", "đánh giá", "trải nghiệm" → REVIEW.
- Topic có "top", "tốt nhất", "chọn mua", "cẩm nang", "nên mua" → BUYING_GUIDE.
- Default → BUYING_GUIDE.

## User story

> **As** gà mờ operator nhìn "Cơ hội tuần" widget có 5 opportunity,
> **I want** 1 click "Tạo bài" → form 3 dòng → submit → đi việc khác → email báo khi article ready,
> **so that** tôi tạo 5 bài/tuần mà tổng thời gian < 30 phút (4-5 phút mỗi bài cho input + review).

## Acceptance criteria

### AC1 — Form wizard 1-screen

NEW file: `apps/web/app/admin/articles/new/page.tsx` (replace existing form nếu đã có).

Layout:

```
┌────────────────────────────────────────────────────────┐
│ ✍ Tạo bài viết mới                                    │
│ AI viết bài tự động trong 3-5 phút. Bạn sẽ nhận email │
│ khi xong, không cần đợi.                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 1. Niche (chọn danh mục)                              │
│    [Laptop                                         v]  │
│                                                        │
│ 2. Chủ đề bài viết                                    │
│    [Top laptop gaming dưới 20 triệu tốt nhất 2026]   │
│    💡 Bài sẽ tự detect type. Có chữ "top"/"chọn mua" │
│       → cẩm nang. Có "review"/"đánh giá" → review.   │
│                                                        │
│ 3. Gợi ý nâng cao (tuỳ chọn) ▼                       │
│    └─ collapse, default hidden                        │
│       • Type override: [Cẩm nang ▼] [Review ▼]       │
│       • Sản phẩm liên quan: (auto-pick 5 cái top)    │
│         [✓] Laptop Acer Nitro V15                     │
│         [✓] Laptop MSI Cyborg 15                      │
│         [Edit list →]                                 │
│       • Tác giả: [Quang Huy ▼] (auto)                │
│                                                        │
│ ┌────────────────────────────────────────────────────┐│
│ │   ✨ Tạo bài (AI chạy ngầm ~3-5 phút)            ││
│ └────────────────────────────────────────────────────┘│
│                                                        │
│ Khi xong, bạn sẽ:                                     │
│   ✓ Nhận email tại your@email.com                    │
│   ✓ Thấy banner trong admin                          │
│   ✓ Vào /admin/articles để review và publish          │
└────────────────────────────────────────────────────────┘
```

Implementation:
- Server-action submit (Next.js).
- Type auto-detect client-side khi user gõ — hiện preview type.
- Product picker: dropdown ban đầu collapse với "auto-pick 5 sản phẩm top discount trong niche". Click "Edit list" expand.
- Author: auto-pick first author with matching nicheSlug (nếu Author model có nicheTags). Fallback: first active author.

### AC2 — URL prefill từ STORY-04 widget

Parse query params:
- `?niche=<slug>` → preselect niche dropdown.
- `?topic=<encoded>` → prefill topic input.
- `?merchant=<slug>` → filter product picker chỉ show product từ merchant đó (priority hint).
- `?commissionHint=<range>` → inject vào AI prompt như hint "ưu tiên link sản phẩm từ merchant {merchant}, commission cao {range}%".

Server component đọc searchParams, pass xuống client form làm defaultValues.

### AC3 — Type auto-detect helper

NEW: `apps/web/lib/article-type-detect.ts`.

```ts
export function detectArticleType(topic: string): "BUYING_GUIDE" | "REVIEW" {
  const lower = topic.toLowerCase();
  if (/review|đánh giá|trải nghiệm|sau \d+ ngày|hands-on|test/.test(lower)) {
    return "REVIEW";
  }
  if (/top \d+|tốt nhất|chọn mua|cẩm nang|nên mua|nên chọn|hướng dẫn/.test(lower)) {
    return "BUYING_GUIDE";
  }
  return "BUYING_GUIDE"; // default
}
```

Display badge cạnh topic input: "Bài sẽ là: Cẩm nang chọn mua" hoặc "Bài sẽ là: Review chi tiết".

### AC4 — Auto-pick products

NEW endpoint: `GET /admin/articles/suggest-products?nicheSlug=<slug>&merchant=<slug?>&limit=5`.

Returns 5 product top theo:
- Filter `nicheSlug` + `isPublic=true`.
- Sort by: real-bestseller order count DESC (STORY-05 data), fallback discount % DESC.
- Limit 5.
- Optional `merchant` filter prioritize.

Form prefill productIds với 5 ID này. Operator có thể edit.

### AC5 — Background article generation

Hiện pipeline article generation đã async (multi-stage: brief → research → outline → writer → critic). Story này chỉ cần đảm bảo:
- Submit form không block UI — return ngay với `articleId`.
- Frontend redirect tới `/admin/articles/<id>?status=generating` (page hiện progress overview hoặc empty state).
- Operator có thể đóng tab — pipeline tiếp tục.

Hiện tại có thể đã pattern này — verify trong `apps/api/src/modules/admin/admin.controller.ts` endpoint `POST /admin/articles/generate`.

Nếu chưa async: defer pipeline tới setImmediate / queue. Pick: nếu codebase đã có pattern (review article-v2-client.tsx state), giữ. Nếu chưa, wrap in `setImmediate` đơn giản.

### AC6 — Email notification

NEW: `apps/api/src/modules/articles/article-notification.service.ts`.

```ts
@Injectable()
export class ArticleNotificationService {
  constructor(private prisma: PrismaService) {}

  async notifyOperatorOnComplete(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) return;

    // Pick recipient: ADMIN_EMAIL env hoặc author email (defer).
    const recipient = process.env.ADMIN_EMAIL;
    if (!recipient) {
      this.logger.warn("[article-notify] ADMIN_EMAIL not set — skip notification");
      return;
    }

    const subject = `[dealvault] Bài viết "${article.title}" đã sẵn sàng review`;
    const body = `
Xin chào,

Bài viết "${article.title}" đã được AI tạo xong và đang chờ bạn review.

Type: ${article.type}
Niche: ${article.nicheId ? "(load name)" : "—"}

Vào dashboard để xem + publish:
${process.env.SITE_URL ?? "http://localhost:3100"}/admin/articles/${article.id}

dealvault — AI tự viết, bạn duyệt
    `.trim();

    // Send via Resend / SendGrid / placeholder log
    if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY) {
      // POST https://api.resend.com/emails ...
    } else {
      this.logger.log(`[article-notify placeholder] To: ${recipient}\nSubject: ${subject}\nBody:\n${body}`);
    }
  }
}
```

Hook vào pipeline cuối: khi article transition `PENDING_REVIEW` (last stage trước operator review) hoặc `DRAFT` (sau critic), gọi `notifyOperatorOnComplete`.

Place hook trong `ArticleService.generateDraft()` hoặc tương đương — sau khi save final article state.

Resend real send DEFER nếu chưa setup. Placeholder log đủ cho story này — operator có thể setup Resend env sau.

### AC7 — Admin banner notification

NEW: `apps/web/components/admin/layout/article-ready-banner.tsx` (RSC).

```tsx
export async function ArticleReadyBanner() {
  // Pull articles ready trong 24h qua, chưa review
  const recentReady = await adminFetch<Article[]>("/admin/articles?status=PENDING_REVIEW&since=24h", "GET");
  if (recentReady.length === 0) return null;

  return (
    <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
      <span>✨ {recentReady.length} bài viết AI đã xong, đang chờ review.</span>
      <Link href="/admin/articles?status=PENDING_REVIEW" className="ml-2 underline">Xem ngay →</Link>
    </div>
  );
}
```

Mount trong admin layout (sau StaleBanner STORY-02).

Dismiss: localStorage `dv_article_banner_seen_<articleId>` — set khi user click "Xem ngay" hoặc "Đã xem".

### AC8 — Form validation + UX

Required:
- Niche selected (default: query param nếu có).
- Topic ≥ 20 ký tự (đủ context cho AI).
- Không submit khi 1 trong 2 thiếu — disable button + show inline error.

Loading state:
- Click submit → button "Tạo bài (AI chạy ngầm ~3-5 phút)" → spinner + disabled.
- Successful submit → redirect tới `/admin/articles/<id>` ngay (KHÔNG đợi pipeline xong).
- Toast: "✓ Bài đang được AI tạo. Email sẽ báo bạn khi xong."

Error state:
- Pipeline fail before async kick off → show form-level error inline.

### AC9 — Pipeline progress page

Page `/admin/articles/<id>` khi article ở status `DRAFT_BRIEF`/`DRAFT_OUTLINE`/`DRAFT_WRITING` (in-progress):

```
┌────────────────────────────────────────────────────┐
│ ⏳ "Top laptop gaming dưới 20 triệu..."           │
│                                                    │
│ AI đang viết bài...                                │
│                                                    │
│ [█████░░░░░░░] 40% — Stage: Research               │
│                                                    │
│ Bạn có thể đóng tab — email sẽ báo khi xong.      │
└────────────────────────────────────────────────────┘
```

Hiện tại `article-v2-client.tsx` đã có progress UI — verify ở status display + multi-stage indicator. Nếu yes, giữ.

### AC10 — Quick action button on dashboard

STORY-03 "Thao tác nhanh" có "+ Tạo bài mới" → link tới `/admin/articles/new`. Verify link đúng.

Tăng prominence: nếu "Cơ hội tuần" widget có ≥1 opportunity → highlight "+ Tạo bài mới" với pulse animation.

## Files touched

```
apps/web/app/admin/articles/new/page.tsx                        (replace existing form)
apps/web/app/admin/articles/new/article-form.tsx                (NEW client form)
apps/web/app/admin/articles/new/actions.ts                      (server action create + redirect)
apps/web/lib/article-type-detect.ts                             (NEW helper)
apps/api/src/modules/admin/admin.controller.ts                  (suggest-products endpoint)
apps/api/src/modules/articles/article.service.ts                (verify async kick off, hook notification)
apps/api/src/modules/articles/article-notification.service.ts   (NEW)
apps/web/components/admin/layout/article-ready-banner.tsx       (NEW RSC)
apps/web/app/admin/layout.tsx                                   (mount ArticleReadyBanner)
apps/api/.env.example                                           (add ADMIN_EMAIL + EMAIL_PROVIDER + RESEND_API_KEY placeholder)
```

## Verification

```bash
# 1. URL prefill từ STORY-04 widget
# Open /admin/articles/new?niche=laptop&topic=Top%20laptop%20gaming&merchant=lazada
# expect: niche dropdown = "Laptop", topic input = "Top laptop gaming", product picker filtered to lazada

# 2. Type auto-detect
# Topic "Review Acer Nitro V15 sau 30 ngày" → badge "Review chi tiết"
# Topic "Top 5 laptop dưới 20tr" → badge "Cẩm nang chọn mua"

# 3. Auto-pick products
curl http://localhost:4000/api/v1/admin/articles/suggest-products?nicheSlug=laptop&limit=5 -H "x-admin-role: admin" -H "x-admin-key: $KEY"
# expect: 5 product

# 4. Submit form
# Fill niche=laptop + topic 20+ chars → click "Tạo bài"
# expect: redirect to /admin/articles/<new-id>
# Pipeline async, status DRAFT_BRIEF or DRAFT_OUTLINE
# Operator close tab — pipeline continues

# 5. Notification (placeholder log)
# Wait until article = PENDING_REVIEW
# Check API log: "[article-notify placeholder] To: ADMIN_EMAIL..."
# Open /admin → banner "✨ 1 bài viết AI đã xong"

# 6. Validation
# Submit form trống topic → button disabled, inline error

# 7. Error handling
# Set AI_API_KEY invalid → submit → see error inline
```

## Definition of done

- [ ] Form 1-screen với 2 required field + 1 collapse advanced.
- [ ] URL prefill từ STORY-04 link.
- [ ] Type auto-detect from topic content.
- [ ] Auto-pick 5 product top trong niche.
- [ ] Submit → background pipeline → redirect ngay.
- [ ] Notification service hook vào pipeline end.
- [ ] Placeholder log nếu Resend chưa setup.
- [ ] Banner admin layout khi có article PENDING_REVIEW.
- [ ] Progress page render khi article in-progress.
- [ ] Validation inline.

## Notes for next session

- Resend real send: setup `RESEND_API_KEY` + verify domain + send email. Defer hoặc làm trong sprint sau.
- Email template HTML: hiện plain text. Future có thể MJML template.
- Author auto-pick: hiện simple "first active". Future: match niche tags với author specialty (Author model có thể add `nicheSpecialties: String[]`).
- "Cơ hội tuần" → "Tạo bài" link cần ensure search params được preserved qua mọi navigation.
- Có thể thêm bulk article generation: chọn 5 opportunity → click "Tạo cùng lúc 5 bài" → queue cùng lúc. Defer.
- Article notification cho operator OFF — hôm sau quay lại admin thấy banner cũng OK. Email là enhancement.
