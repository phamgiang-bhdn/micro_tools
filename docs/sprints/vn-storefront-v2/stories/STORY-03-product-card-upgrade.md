# STORY-03 — ProductCard upgrade: 1-click outbound + trust signals

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P0
**Estimate:** 4h
**Dependencies:** STORY-01 (foundation tracking must be hardened). STORY-02 và STORY-04 sẽ dùng card này — story này nên merge trước.

## Context

Current `ProductCard` ([apps/web/components/product-card.tsx](../../../../apps/web/components/product-card.tsx)) — clean Western design:
- Image + brand + name + price + discount badge + store + rating.
- Click toàn card → `/categories/<slug>/<productSlug>` (detail page).
- KHÔNG có inline "Xem deal" → bắt user click thêm 1 lần.
- KHÔNG có verified-price date, KHÔNG có "X người đã mua", KHÔNG có store-tier badge (Lazada Mall vs regular).

**Vấn đề conversion**:
1. **2-click outbound path** = card → detail → "Mua ngay". Affiliate VN benchmark là 1-click từ card. User browse homepage muốn quick-buy, không muốn đọc detail.
2. **Thiếu trust signal** → user không tin giá / không tin shop / không tin nguồn → bounce.
3. **Card không có urgency** — không countdown, không "stock indicator", không "Còn 3 ngày".

Reference patterns:
- `cellphones.com.vn` card: image + giảm-% to + price + price-old + "Mua ngay" inline button + store badge + rating bar.
- `voucher.com.vn` card: code + brand logo + discount + "Còn 2 ngày" + "Lấy mã" inline.
- `sforum.vn` review card: image + headline + author + "Xem review" + product price chip.

## User story

> **As** user VN scrolling homepage hoặc niche page,
> **I want** trên mỗi product card thấy ngay store có uy tín không, giá có verified không, có ai đã mua không, và 1 nút "Xem deal ngay" đi thẳng affiliate,
> **so that** tôi không cần click vào detail page nếu chỉ muốn quick-buy.

## Acceptance criteria

### AC1 — Card layout v2

File: [apps/web/components/product-card.tsx](../../../../apps/web/components/product-card.tsx)

Redesign component, giữ Props interface (`product`, `nicheSlug`, `compact?`). Output structure mới:

```
┌──────────────────────────────────┐
│  [discount-badge top-left]       │
│  [store-tier-badge top-right]    │
│      [image cover 4:3]           │
│  [hot-badge bottom-left]         │
├──────────────────────────────────┤
│ [brand-text]                     │ ← optional small
│ Product name 2 lines max         │
│ ★4.8 · 1.2k đã mua  |  ✓ DD/MM   │ ← social proof + verified-date
│ ₫1,290,000  ̶₫̶2̶,̶0̶0̶0̶,̶0̶0̶0̶          │ ← price big + original strike
│ Tiết kiệm ₫710,000               │ ← accent text
│ ┌──────────────────────────────┐ │
│ │  Xem deal ngay  →            │ │ ← inline CTA (form action)
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Key changes vs current:**

- Inline `<Xem deal ngay>` button ở bottom card → form action `trackAndRedirectAction` với hidden `productId` + `affiliateUrl`. **Card outer wrapper KHÔNG còn là `<Link>`** — chuyển thành `<article>` với 2 click target:
  - Tap vào image / name / price → navigate detail page (giữ behavior cũ cho user muốn so sánh).
  - Tap vào "Xem deal ngay" button → direct outbound qua tracking.
- 2 click target trên cùng card cần keyboard accessibility — image+name+price wrap trong 1 nested `<Link>`, button là `<form>` separate.

### AC2 — Store-tier badge

Component mới: `apps/web/components/storefront/store-tier-badge.tsx`.

Mapping (hard-coded ban đầu, có thể move sang DB Niche.storeBadgeConfig sau):

| Source string trong `product.scrapedData.storeBadge` / `product.store` / `merchant` | Badge render |
|---|---|
| chứa "lazada" + ("mall" hoặc "lazmall") | "LazMall ⭐" gold |
| chứa "shopee" + ("mall" hoặc "preferred") | "Shopee Mall ⭐" gold |
| chứa "tiki" + ("trading" hoặc "official") | "Tiki Trading ⭐" gold |
| chứa "lazada" only | "Lazada" red |
| chứa "shopee" only | "Shopee" orange |
| chứa "tiki" only | "Tiki" blue |
| chứa "tiktok" | "TikTok Shop" black |
| chứa "fpt" hoặc "fptshop" | "FPT Shop" red |
| chứa "nguyen kim" hoặc "nguyenkim" | "Nguyễn Kim" red |
| chứa "dien may xanh" hoặc "thegioididong" | "Điện Máy Xanh" blue |
| khác (có store name) | store name string |
| null | hide badge |

Render: top-right card, `text-[10px] font-bold uppercase tracking-wider`, padding 1.5×0.5, rounded-full, bg theo tier color.

**Tier gold** (Mall badges) có thêm `⭐` icon nhỏ trước text.

### AC3 — Verified-price chip

Từ `Product.updatedAt` — show "✓ Đối chiếu DD/MM" nếu < 7 ngày, hide nếu cũ hơn.

Component inline trong card (không tách):

```tsx
{verifiedRecent ? (
  <span className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-emerald-700">
    <CheckCircle className="size-3" /> Đối chiếu {formatShortDate(product.updatedAt)}
  </span>
) : null}
```

Date format: `DD/MM` (e.g. "23/05"). Năm hide vì user thấy ngay là gần.

### AC4 — Social proof inline

Format: `★{rating} · {salesCount} đã mua`

- Rating từ `scrapedData.rating` hoặc `scrapedData.reviewRating`. Format 1 chữ số sau dấu phẩy ("4.8").
- Sales count từ `scrapedData.salesCount` hoặc `scrapedData.sold` hoặc `scrapedData.reviewCount`. Format ngắn:
  - < 100: "{N} đã mua"
  - < 1000: "{N} đã mua"
  - ≥ 1000: "{Math.floor(N/100)/10}k đã mua" → "1.2k đã mua"
  - ≥ 10000: "{Math.floor(N/1000)}k đã mua" → "12k đã mua"
- Nếu thiếu cả 2 → hide block (không show "★0 · 0 đã mua").

Add to `lib/format.ts`:

```ts
export function formatSocialProof(rating?: number, salesCount?: number): string | null {
  const parts: string[] = [];
  if (typeof rating === "number" && rating > 0) parts.push(`★${rating.toFixed(1)}`);
  if (typeof salesCount === "number" && salesCount > 0) {
    if (salesCount >= 10000) parts.push(`${Math.floor(salesCount / 1000)}k đã mua`);
    else if (salesCount >= 1000) parts.push(`${(Math.floor(salesCount / 100) / 10).toFixed(1)}k đã mua`);
    else parts.push(`${salesCount} đã mua`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
```

Update `normalizeProduct` trong `lib/format.ts` để extract `salesCount` từ các key alias:
```ts
salesCount: pickNumber(s, ["salesCount", "sold", "soldCount", "purchasedCount", "reviewCount"])
```

### AC5 — Inline "Xem deal ngay" button

Component dùng pattern `<form action={trackAndRedirectAction}>` đã có trong `AffiliateCta`:

```tsx
<form action={trackAndRedirectAction}>
  <input type="hidden" name="productId" value={product.id} />
  <input type="hidden" name="affiliateUrl" value={product.affiliateUrl ?? ""} />
  <button
    type="submit"
    disabled={!product.affiliateUrl}
    className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700"
  >
    Xem deal ngay →
  </button>
</form>
```

Nếu `affiliateUrl` null → button disabled với label "Liên hệ shop" → click → navigate detail page. Đừng hide button (giữ height card consistent).

### AC6 — Card click vs button click separation

Hiện `<Link>` wrap toàn card. Conflict với `<form>` inline button (nested form in link not valid HTML).

Refactor:
- Card outer: `<article>` (not Link).
- Bên trong: nested `<Link href={detailHref}>` wrap image + name + price + meta block.
- Bên dưới: `<form>` button standalone.

Hover state: outer `<article>` có class group, image scale + name color change qua group-hover. Button có hover state riêng.

Keyboard nav:
- Tab 1: focus vào nested Link (toàn block trên).
- Tab 2: focus vào "Xem deal ngay" button.
- Enter trên Link → navigate detail. Enter trên button → form submit.

### AC7 — Compact variant

Prop `compact?: boolean` giữ. Compact mode:
- Image 1:1 aspect.
- Name `line-clamp-1`.
- Hide brand-text + social proof.
- Hide verified-price chip.
- Keep store-tier badge (small).
- Hide inline "Xem deal" button → fallback click toàn card vào detail (như cũ).

Dùng cho strip ngang trong hero featured area (STORY-02) hoặc carousel article (STORY-04).

### AC8 — Type extension

`ProductView` trong `lib/types.ts` thêm field:

```ts
export interface ProductView {
  // ... existing ...
  salesCount?: number;          // NEW
  storeTier?: "mall" | "regular" | null;  // NEW, computed in normalizeProduct
}
```

`normalizeProduct` compute `storeTier` dựa store-tier mapping (AC2). Cache mapping function trong `lib/store-tier.ts`:

```ts
export function inferStoreTier(storeStr?: string | null): "mall" | "regular" | null {
  if (!storeStr) return null;
  const s = storeStr.toLowerCase();
  if (/(laz ?mall|shopee ?mall|tiki ?trading|official|preferred)/.test(s)) return "mall";
  return "regular";
}

export function formatStoreBadge(storeStr?: string | null): string | null {
  // returns user-facing label per AC2 mapping table
}
```

### AC9 — Visual polish

- Card border: `border-line` default, `border-brand-300` on hover.
- Shadow: `shadow-card` default, `shadow-pop` on hover, transition 300ms.
- Discount badge color tier:
  - ≥50%: `bg-red-600 text-white` + flame icon
  - ≥30%: `bg-brand-gradient text-white` (existing hot)
  - ≥15%: `bg-brand-600 text-white`
  - <15%: hide badge
- "Hot" amber badge: chỉ show nếu `discountPercent ≥ 40` (raise threshold from 30 — too noisy).

## Files touched

```
apps/web/components/product-card.tsx                         (rewrite layout)
apps/web/components/storefront/store-tier-badge.tsx          (NEW)
apps/web/lib/store-tier.ts                                   (NEW helpers)
apps/web/lib/format.ts                                       (extend normalizeProduct + formatSocialProof + formatShortDate)
apps/web/lib/types.ts                                        (extend ProductView)
```

Optional (nếu story 03b sau muốn xa hơn):
- `apps/web/components/storefront/product-card.stories.tsx` — Storybook nếu repo có.

Files **không** touch:
- `top-product-card.tsx` — đã wire tracking ở STORY-01, không cần upgrade trust signals (TopSnapshot không phải Product nội bộ).
- `components/article/product-card-end.tsx` — đã wire tracking ở STORY-01, riêng style cho article context.

## Verification

```bash
# 1. Build
cd apps/web && npx tsc --noEmit && cd ../..
npm run build --workspace web

# 2. Visual test với data thật
# (sau khi STORY-10 onboard products) hoặc seed fixture
node scripts/screenshot-pages.mjs
# inspect:
# - 04-niche-laptop.png: cards có store badge + verified date + social proof + inline "Xem deal"
# - 01-home-desktop.png: cards trong hot-deals section có đầy đủ trust signals

# 3. Click test
# Tap card name → /categories/<slug>/<productSlug>
# Tap "Xem deal ngay" → POST /tracking/click → 302 affiliate URL với utm_source param

# 4. Empty data resilience
# Set scrapedData.rating = null, salesCount = null → card không crash, không show "★null · null đã mua"
# Set affiliateUrl = null → button hiện "Liên hệ shop" disabled

# 5. Keyboard nav
# Tab through card → focus Link wrapper → focus button → both have visible focus ring
```

## Definition of done

- [ ] Card có 4 trust signal: store badge, verified-price chip, social proof, discount badge tier.
- [ ] Inline "Xem deal ngay" button → tracking → outbound.
- [ ] Detail page navigate vẫn work qua nested Link.
- [ ] Compact mode preserve cho hero strip + carousel.
- [ ] No HTML validation error (nested form in link).
- [ ] Visual screenshot 4 niche page render đúng.
- [ ] `inferStoreTier` + `formatStoreBadge` unit test (3-4 case): Lazada Mall → "LazMall ⭐", Shopee regular → "Shopee", null → null.

## Notes for next session

- Sau khi STORY-03 merge, STORY-02 sẽ tự benefit từ card upgrade trong hot-deals section.
- STORY-04 niche page cũng sẽ render card mới trong grid.
- STORY-07 deal-hot landing sẽ dùng `compact={false}` để max trust signal.
- Nếu data `salesCount` không tồn tại trong `scrapedData` của AT response, talk với operator để xác định key name — có thể schema tùy niche khác nhau. `normalizeProduct` đã handle key alias, mở rộng key list khi gặp.
- Nếu sau này muốn animation slide-up khi hover button, cân nhắc client component wrapper — nhưng card hiện tại nên giữ server-only để bundle nhẹ.
