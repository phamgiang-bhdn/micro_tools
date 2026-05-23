# STORY-01 — Foundation fixes: typecheck + tracking + empty state

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P0
**Estimate:** 2h
**Dependencies:** Không có. **Đây là blocker cho mọi story khác** vì nếu typecheck fail thì các story sau không deploy được, và nếu tracking không wired đầy đủ thì mọi UX improvement đều mất attribution.

## Context

Audit 2026-05-23 phát hiện 4 lỗ thủng cần vá ngay trước bất cứ refactor nào:

1. **3 typecheck errors block `npm run build --workspace web`** (recent commit 89f4ab6 thêm article reader nhưng quên update types):
   - `app/admin/articles/[id]/article-v2-client.tsx:166` — `RunLite[]` thiếu `agent` field.
   - `components/article/blocks/block-renderer.tsx:122` — block type `"image"` chưa có trong union.
   - `components/article/blocks/block-renderer.tsx:154` — block type `"review_quote"` chưa có trong union.

2. **3 component bypass `trackAndRedirectAction`** → click affiliate KHÔNG tạo `ClickLog` → mất attribution:
   - `components/storefront/top-product-card.tsx:12-14` — homepage "Đang hot tuần này".
   - `components/article/product-card-end.tsx:82-89` — chốt deal cuối article.
   - `components/article/sticky-product-cta.tsx:78-84` — floating button slide-up panel trong article.

3. **`createTrackingRedirect` không có timeout/fallback** ([app/actions/tracking.ts](../../../apps/web/app/actions/tracking.ts)) — API hiccup = throw → 500 → user mất conversion. Phải có graceful path: nếu API quá 4s hoặc fail, vẫn redirect tới affiliate URL nhưng không có tracking (better than 500).

4. **Homepage empty state leak dev instruction** ([app/page.tsx:194](../../../apps/web/app/page.tsx#L194)) — text `Chạy npm run db:reset rồi tải lại trang` hiển thị cho user thật. Phải thay copy consumer-friendly. **Đã fix một phần trong session 2026-05-23 nhưng cần verify lại.**

## User story

> **As** dev đang sửa storefront để release,
> **I want** build pass + mọi affiliate click route qua tracking + empty state copy nói tiếng user,
> **so that** các story UX rebuild tiếp theo build trên nền không rò rỉ và conversion luôn được đo.

## Acceptance criteria

### AC1 — Fix 3 typecheck errors

**File 1:** [apps/web/app/admin/articles/[id]/article-v2-client.tsx:166](../../../../apps/web/app/admin/articles/[id]/article-v2-client.tsx)

`RunLite` interface ở đầu file thiếu `agent` field. Recent API response thêm field này (article V2 multi-agent pipeline). Đọc API response shape ở `apps/api/src/modules/admin/admin.controller.ts` endpoint `GET /admin/articles/:id` để confirm field name + type.

Fix: thêm `agent: string` vào type definition. Nếu API thực sự trả nullable thì `agent: string | null` + handle UI fallback `agent ?? "(unknown)"`.

**File 2 & 3:** [apps/web/components/article/blocks/block-renderer.tsx:122,154](../../../../apps/web/components/article/blocks/block-renderer.tsx)

Block type union hiện chỉ có 10 type:
```ts
"hero_quote" | "criteria_grid" | "product_spotlight" | "callout" | "prose" |
"comparison" | "pros_cons" | "faq" | "verdict" | "product_slot"
```

Code có case cho `"image"` và `"review_quote"` nhưng union không include. Đọc Prisma migration `20260520_*` để confirm DB enum hay JSON shape, đọc seed `prompts.seed.ts` để confirm AI prompt yêu cầu sinh block nào.

Fix:
- Thêm `"image" | "review_quote"` vào type union ở `lib/types/article.ts` (hoặc nơi đang định nghĩa `Block`/`BlockType`).
- Verify render path cho 2 type này đã có component thật (nếu là placeholder thì viết minimal renderer: image=`<img>`, review_quote=`<blockquote>` với attribution).
- Check zod schema validate article output ở backend `apps/api/src/services/article.service.ts` — nếu schema reject 2 type này thì AI sinh ra cũng bị block. Sync union 2 phía.

### AC2 — Wire tracking qua 3 component bị bỏ qua

Pattern chuẩn: dùng `AffiliateCta` component có sẵn ([apps/web/components/article/affiliate-cta.tsx](../../../../apps/web/components/article/affiliate-cta.tsx)) hoặc `trackAndRedirectAction` form action.

**`top-product-card.tsx`:** thay `<a href={product.affLink}>` bằng `<form action={trackAndRedirectAction}>` với hidden inputs `productId` + `affiliateUrl`. **Lưu ý**: `TopProductSnapshot` không phải `Product` — không có `Product.id` trong schema. Có 2 option:

- **Option A (preferred)**: tạo synthetic `productId = "topsnap_<atProductId>"` và update API `/tracking/click` chấp nhận synthetic id (validate prefix `topsnap_`, log riêng nguồn `source = "top_snapshot"`).
- **Option B (quick)**: dùng `affLink` thẳng nhưng vẫn POST `/tracking/click` với `productId = null` + `source = "top_snapshot"` + lưu `affLink` raw vào `ClickLog.notes`.

Pick Option A nếu reconciler cần phân biệt source. Pick Option B nếu chỉ cần count.

**`product-card-end.tsx`:** thay `<a href={p.affiliateUrl}>` thành `<AffiliateCta productId={p.id} affiliateUrl={p.affiliateUrl ?? ""} ... />`. Giữ class/style hiện tại (override qua prop `className`).

**`sticky-product-cta.tsx`:** đây là client component (slide-up panel). Có 2 option:

- **Option A**: keep client, click `<a>` → preventDefault → fetch `/api/tracking/click` từ client → window.location.href = tracked URL. Phức tạp.
- **Option B (preferred)**: wrap mỗi `<li>` thành `<form action={trackAndRedirectAction}>` với hidden `productId` + `affiliateUrl`. Form submit hoạt động trong client component. Mất chút animation feel nhưng đúng pattern.

Pick Option B.

### AC3 — Harden `createTrackingRedirect`

File: [apps/web/app/actions/tracking.ts](../../../../apps/web/app/actions/tracking.ts)

**Hiện tại:**
```ts
const response = await fetch(`${API_BASE_URL}/tracking/click`, {...});
if (!response.ok) throw new Error(...);
```

**Yêu cầu:**
- Timeout 4000ms cho fetch tracking — dùng `AbortController` + `setTimeout`.
- Nếu fetch timeout HOẶC `!response.ok` HOẶC throw — **không bao giờ throw lên trên**. Thay vào đó:
  - Log warning ở server (`console.warn("[tracking] fallback to direct redirect", { productId, error })`).
  - Trả về `{ trackingCode: "", finalUrl: input.affiliateUrl }` để caller `redirect()` vẫn ra affiliate URL.
- **Quan trọng**: nếu fallback, `finalUrl` KHÔNG append `?utm_source=<code>` (vì không có code). Affiliate network sẽ ko track được đơn đó nhưng user vẫn outbound — tỉnh hơn 500.
- `trackAndRedirectAction` (form wrapper) cần handle case `tracked.finalUrl === ""` (input invalid) → return early không redirect tránh `redirect("")` crash.

**Test:**
```ts
// apps/web/app/actions/__tests__/tracking.test.ts (NEW)
test("falls back to direct URL when API down", async () => {
  // mock fetch to throw
  // expect result.finalUrl === input.affiliateUrl (no utm_source)
});
test("falls back when API slow > 4s", async () => {
  // mock fetch with 5s delay
  // expect timeout + fallback
});
```

(Nếu apps/web chưa có Jest setup thì comment ra `// TODO: add test framework`. Đừng spin up testing infra trong story này.)

### AC4 — Empty state copy upgrade

Đã fix một phần trong session 2026-05-23. Verify:

- [apps/web/app/page.tsx:185-199](../../../../apps/web/app/page.tsx#L185) — không còn `npm run db:reset`. Copy hiện tại: "Đang cập nhật deal mới — Team dealvault đang đối chiếu deal mới từ các sàn. Vui lòng quay lại sau ít phút, hoặc xem [cẩm nang chọn mua](/blog)."
- Verify các empty state khác — grep `"npm run|API_BASE_URL|localhost"` trong file `app/**/*.tsx` không xuất hiện trong UI string. Sửa nếu tìm thấy.

### AC5 — CI guardrail: zero raw affiliate `<a>`

Thêm 1 lint rule hoặc script test đảm bảo không component nào trong `apps/web/components/storefront/**` và `apps/web/components/article/**` có pattern `<a href={... affiliateUrl ...}>` hoặc `<a href={... affLink ...}>`.

Implement:

```bash
# apps/web/scripts/check-no-raw-affiliate-link.mjs (NEW)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["components/storefront", "components/article"];
const PATTERN = /<a[^>]+href=\{[^}]*(?:affiliateUrl|affLink)[^}]*\}/;

let failed = 0;
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".tsx")) {
      const content = readFileSync(p, "utf8");
      if (PATTERN.test(content)) {
        console.error(`[check] Raw affiliate <a> in ${p}`);
        failed++;
      }
    }
  }
}
ROOTS.forEach(walk);
process.exit(failed > 0 ? 1 : 0);
```

Wire vào `apps/web/package.json` script `"check:tracking": "node scripts/check-no-raw-affiliate-link.mjs"`. Optional: chạy trong CI hook nếu có.

## Files touched

```
apps/web/app/admin/articles/[id]/article-v2-client.tsx     (typecheck fix)
apps/web/components/article/blocks/block-renderer.tsx       (typecheck fix)
apps/web/lib/types/article.ts (hoặc nơi định nghĩa Block)   (typecheck fix - union expand)
apps/api/src/services/article.service.ts                    (zod schema sync nếu cần)
apps/web/components/storefront/top-product-card.tsx         (tracking wire)
apps/web/components/article/product-card-end.tsx            (tracking wire)
apps/web/components/article/sticky-product-cta.tsx          (tracking wire)
apps/web/app/actions/tracking.ts                            (timeout + fallback)
apps/web/app/page.tsx                                       (verify empty state)
apps/web/scripts/check-no-raw-affiliate-link.mjs            (NEW, guardrail)
apps/web/package.json                                       (add script)
apps/api/src/modules/tracking/tracking.controller.ts        (nếu Option A: chấp nhận synthetic id)
```

## Verification

```bash
# 1. Build passes
cd apps/web && npx tsc --noEmit
# expect: 0 errors

# 2. No raw affiliate <a>
node apps/web/scripts/check-no-raw-affiliate-link.mjs
# expect: exit 0

# 3. Tracking fallback (manual)
# Stop API server. Hit homepage, click any "Xem deal" CTA.
# Expect: still redirects to affiliate URL (no utm_source). No 500 page.

# 4. Empty state copy clean
grep -rn "npm run\|db:reset\|API_BASE_URL" apps/web/app apps/web/components | grep -v "/admin/" | grep -i "Chạy\|run\|reset"
# expect: no matches (admin pages can mention these for ops)

# 5. Build prod
npm run build --workspace web
# expect: success
```

## Definition of done

- [ ] `npx tsc --noEmit` ở `apps/web` exit 0.
- [ ] `check:tracking` script pass.
- [ ] Manual test: stop API → click "Xem deal" → ra affiliate URL không lỗi.
- [ ] Manual test: với DB rỗng → homepage → empty state copy consumer-friendly, không thấy chữ "npm" hay "db:reset".
- [ ] Build prod (`npm run build --workspace web`) success.
- [ ] PR description note: story này KHÔNG đụng visual layout, chỉ plumbing. Visual story là STORY-02/03.

## Notes for next session

- Có thể split story này thành 2 PR nếu muốn: PR-1 typecheck + empty state (≤30 phút), PR-2 tracking + harden (≤90 phút).
- STORY-03 sẽ tiếp tục đụng `top-product-card.tsx` và `product-card-end.tsx` để thêm trust signals — không conflict vì STORY-01 chỉ đụng `<a>` → `<form>`, STORY-03 đụng visual prop bên trong.
- Nếu Option A chọn cho top-product-card (synthetic productId), nhớ document ở `apps/api/CLAUDE.md` section "Top products" thêm note về `source="top_snapshot"`.
