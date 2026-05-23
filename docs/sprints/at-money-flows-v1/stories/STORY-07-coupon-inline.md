# STORY-07 — Coupon-inline trên ProductCard (Loop 4): pill match merchant render-time

**Sprint:** [at-money-flows-v1](../sprint.md)
**Priority:** P0
**Estimate:** 3h
**Money loop:** Loop 4 — "Coupon kế bên giá → click mạnh hơn"
**Dependencies:** Coupon sync đã hoạt động (đã có từ sprint at-source-of-truth). Cross-ref vn-storefront-v2 STORY-03 ProductCard upgrade.

## Context

**Vấn đề**: Coupon hub `/khuyen-mai/<merchant>` tồn tại nhưng tách biệt với product. User xem ProductCard "Robot Roborock Lazada giảm 30%" — không biết Lazada còn mã "FREESHIP50K cho đơn từ 199K". → bỏ lỡ trigger click ngay.

**Insight pattern voucher.com.vn / tiki.vn**: hiển thị **inline pill** trên product card "🎟 Áp mã FREESHIP50 giảm thêm 50K". → user thấy có thêm reason để click NGAY.

**Giải pháp**: render-time match. Mỗi `ProductCard` render:
1. Có `product.store` hoặc `merchantSlug`.
2. Query `Coupon` table where `merchantSlug = X` AND `isActive=true` AND `expiresAt > now`.
3. Pick 1 coupon ưu tiên: discount cao nhất, hoặc gần hết hạn nhất, hoặc "freeship/free-ship".
4. Render pill `🎟 {code or shortLabel}` ở footer card.

**Zero new endpoint** — chỉ dùng `/api/v1/coupons` đã có hoặc query trực tiếp Prisma.

**Render-time, không lazy fetch** — tránh waterfall (mỗi card 1 query) qua pattern: parent fetch 1 batch all-coupons-by-merchant một lần, pass xuống via context hoặc prop.

## User story

> **As** user storefront browse ProductCard ở homepage/niche page,
> **I want** thấy mã giảm của shop merchant đó ngay trên card,
> **so that** tôi có thêm động lực click vì biết áp mã được giảm thêm.

## Acceptance criteria

### AC1 — Schema: verify Coupon có `maxDiscount` field hoặc derive

Hiện `Coupon` model có:
- `code` (= atCouponId từ AT sync)
- `title` / `name`
- `contentHtml` (sanitized)
- `merchantSlug`
- `expiresAt`
- `isActive`

Có thể chưa có `shortLabel` cho display. Verify schema:

```bash
grep -A 30 "model Coupon" apps/api/prisma/schema.prisma
```

Nếu thiếu `shortLabel` (text ngắn render trên pill), add:

```prisma
model Coupon {
  // ... existing ...
  shortLabel  String?  // computed: "Giảm 50K", "Freeship 99K", "-30%" — derive từ content lúc sync hoặc admin nhập
}
```

Migration optional — có thể skip nếu derive runtime từ `title`. **Pick**: derive runtime trong helper, KHÔNG migration.

### AC2 — Helper: derive short label

NEW: `apps/web/lib/coupon-format.ts`.

```ts
export function deriveCouponShortLabel(coupon: { title?: string | null; contentHtml?: string | null; code?: string | null }): string {
  const text = ((coupon.title ?? "") + " " + (coupon.contentHtml ?? "")).toLowerCase();

  // Priority: freeship > discount % > discount K
  if (/freeship|free ship|miễn phí v[aậ]n chuyển/.test(text)) {
    const matchAmount = text.match(/(\d+)k|(\d+)000/);
    return matchAmount ? `Freeship ${matchAmount[1] ?? matchAmount[2]}K` : "Freeship";
  }

  const matchPercent = text.match(/giảm (\d+)\s*%|(\d+)\s*%\s*off|-(\d+)\s*%/i);
  if (matchPercent) {
    const pct = matchPercent[1] ?? matchPercent[2] ?? matchPercent[3];
    return `Giảm ${pct}%`;
  }

  const matchAmount = text.match(/giảm (\d+)\s*k|(\d+)\s*000/i);
  if (matchAmount) {
    return `Giảm ${matchAmount[1] ?? matchAmount[2]}K`;
  }

  // Fallback to code
  return coupon.code ?? coupon.title?.slice(0, 20) ?? "Mã giảm";
}
```

Test cases:
- "Freeship 50K cho đơn từ 199K" → "Freeship 50K"
- "Giảm 30% cho khách mới" → "Giảm 30%"
- "Áp mã FREESHIP" code "FREESHIP" → "Freeship"
- "ABCDEF Tặng phụ kiện" → "ABCDEF"

### AC3 — Server-side coupon matching utility

NEW: `apps/web/lib/coupon-match.ts`.

```ts
import type { ProductView, CouponItem } from "./types";

/**
 * Pick the best coupon for a product:
 * - Match merchantSlug (case-insensitive).
 * - Active + not expired.
 * - Priority: freeship > biggest discount > earliest expiry.
 */
export function pickBestCouponForProduct(
  product: { store?: string | null; merchantSlug?: string | null },
  coupons: CouponItem[]
): CouponItem | null {
  const slug = (product.merchantSlug ?? product.store ?? "").toLowerCase();
  if (!slug) return null;

  const now = Date.now();
  const matches = coupons.filter(c => {
    const couponSlug = (c.merchantSlug ?? "").toLowerCase();
    if (couponSlug !== slug) {
      // Fuzzy match: "lazada" matches "lazada_kol" etc.
      if (!slug.includes(couponSlug) && !couponSlug.includes(slug)) return false;
    }
    if (!c.isActive) return false;
    if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return false;
    return true;
  });

  if (matches.length === 0) return null;

  // Priority sort
  matches.sort((a, b) => {
    const aFreeship = isFreeshipCoupon(a) ? 1 : 0;
    const bFreeship = isFreeshipCoupon(b) ? 1 : 0;
    if (aFreeship !== bFreeship) return bFreeship - aFreeship;

    // Earliest expiry next (urgency)
    const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
    const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
    return aExp - bExp;
  });

  return matches[0];
}

function isFreeshipCoupon(c: CouponItem): boolean {
  const text = ((c.title ?? "") + " " + (c.contentHtml ?? "")).toLowerCase();
  return /freeship|free ship|miễn phí/.test(text);
}
```

### AC4 — RSC fetch + pass-down pattern

Storefront pages (homepage, niche) — RSC fetch coupon batch một lần ở page level, pass xuống ProductGrid → ProductCard.

Update `apps/web/lib/api.ts`:

```ts
export async function fetchActiveCoupons(): Promise<CouponItem[]> {
  return safeFetch<CouponItem[]>(`${API_BASE_URL}/coupons?limit=200`, "GET") ?? [];
}
```

Page level (e.g. homepage):

```tsx
export default async function HomePage(...) {
  const [products, coupons] = await Promise.all([
    fetchAllProductsFlat(niches),
    fetchActiveCoupons()
  ]);

  return (
    <CouponContextProvider coupons={coupons}>
      {/* ... product grids ... */}
    </CouponContextProvider>
  );
}
```

NEW: `apps/web/components/storefront/coupon-context.tsx`:

```tsx
import { createContext, useContext } from "react";
import type { CouponItem } from "../../lib/types";

const CouponContext = createContext<CouponItem[]>([]);

export function CouponContextProvider({ coupons, children }: { coupons: CouponItem[]; children: React.ReactNode }) {
  return <CouponContext.Provider value={coupons}>{children}</CouponContext.Provider>;
}

export function useCoupons() {
  return useContext(CouponContext);
}
```

**Lưu ý**: Context cần client component. Alternative cho RSC: pass coupon array làm prop trực tiếp xuống ProductGrid → ProductCard. Đơn giản, ko cần context.

**Pick**: prop drilling (RSC-friendly) thay vì context.

```tsx
<ProductGrid products={products} coupons={coupons} />
```

`ProductGrid` pass `coupons` xuống mỗi `ProductCard`:

```tsx
<ProductCard product={p} nicheSlug={...} coupons={coupons} />
```

`ProductCard` match per product (gọi `pickBestCouponForProduct(product, coupons)`).

### AC5 — CouponInlinePill component

NEW: `apps/web/components/storefront/coupon-inline-pill.tsx`.

```tsx
import type { CouponItem } from "../../lib/types";
import { deriveCouponShortLabel } from "../../lib/coupon-format";

interface Props {
  coupon: CouponItem;
}

export function CouponInlinePill({ coupon }: Props) {
  const label = deriveCouponShortLabel(coupon);
  const urgentExpiry = coupon.expiresAt && new Date(coupon.expiresAt).getTime() - Date.now() < 48 * 3600 * 1000;

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${
      urgentExpiry
        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
        : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
    }`}>
      🎟 {label}
      {urgentExpiry && <span className="text-[9px]">⏰</span>}
    </span>
  );
}
```

### AC6 — Mount vào ProductCard (CROSS-REF storefront-v2 STORY-03)

ProductCard render — phụ thuộc storefront-v2 STORY-03 status:

**Option A — storefront-v2 STORY-03 ProductCard upgrade đã merge**:
- Card v2 đã có `social proof + verified-price + store-tier badge`.
- Story này thêm pill vào meta block (giữa social proof và CTA):

```tsx
{matchedCoupon && <CouponInlinePill coupon={matchedCoupon} />}
```

**Option B — storefront-v2 STORY-03 chưa merge**:
- Current ProductCard có meta block đơn giản (rating + store).
- Story này thêm 1 prop `coupons?: CouponItem[]` vào ProductCard, render pill nếu match.

Pick **Option B** approach — work với current card, storefront-v2 STORY-03 sẽ tự merge khi rebuild card (chỉ cần verify pill còn render đúng vị trí).

Edit `apps/web/components/product-card.tsx`:

```tsx
import { pickBestCouponForProduct } from "../lib/coupon-match";
import { CouponInlinePill } from "./storefront/coupon-inline-pill";

interface ProductCardProps {
  product: ProductView & { slug?: string | null };
  nicheSlug: string;
  compact?: boolean;
  coupons?: CouponItem[];  // NEW optional
}

export function ProductCard({ product, nicheSlug, compact = false, coupons = [] }: ProductCardProps) {
  const matchedCoupon = pickBestCouponForProduct(product, coupons);

  return (
    <Link ...>
      {/* existing image + badges */}
      <div className="...meta block...">
        {/* existing brand + name + price + savings */}
        {matchedCoupon && !compact && (
          <CouponInlinePill coupon={matchedCoupon} />
        )}
        {/* existing store + rating */}
      </div>
    </Link>
  );
}
```

### AC7 — Pass `coupons` from page level

Update các page render ProductGrid:

`apps/web/app/page.tsx` (homepage):
- Add `fetchActiveCoupons()` to parallel fetch.
- Pass `coupons` to all `<ProductGrid>` invocations.

`apps/web/app/categories/[slug]/page.tsx` (niche):
- Same pattern.

`apps/web/app/categories/[slug]/[productSlug]/page.tsx` (product detail):
- Match best coupon for THIS product, render banner riêng top detail page.

NEW component: `apps/web/components/storefront/coupon-detail-banner.tsx` cho product detail:

```tsx
{coupon && (
  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
    🎟 Áp mã <strong className="font-mono">{coupon.code}</strong> để {deriveCouponShortLabel(coupon)}.
    {' '}
    <Link href={`/khuyen-mai/${coupon.merchantSlug}`} className="text-amber-700 hover:underline">Xem chi tiết →</Link>
  </div>
)}
```

### AC8 — A/B-able instrumentation (lightweight)

Track 2 click event qua tracking action:
- Click trên card có coupon attached.
- Click trên card không có coupon.

Extend `ClickLog`:
```prisma
model ClickLog {
  // ... existing ...
  hasInlineCoupon  Boolean  @default(false)
}
```

Tracking action receive flag, persist. Sau 1 tuần có data, query CR uplift:

```sql
SELECT
  hasInlineCoupon,
  COUNT(*) as clicks,
  COUNT(CASE WHEN cw.id IS NOT NULL THEN 1 END) as conversions
FROM "ClickLog" cl
LEFT JOIN "ConversionWebhook" cw ON cw."trackingCode" = cl."trackingCode"
WHERE cl."createdAt" >= now() - interval '7 days'
GROUP BY hasInlineCoupon;
```

Operator có thể tự run query này hoặc admin endpoint `/admin/insights/coupon-inline-uplift` (optional, defer).

### AC9 — Empty state — không có coupon

Nếu `coupons` array rỗng (chưa sync hoặc all expired):
- ProductCard render KHÔNG có pill. Card vẫn render bình thường.
- KHÔNG show pill "Chưa có mã" — đừng clutter.

### AC10 — Visual polish

- Pill nằm trên cùng dòng với "Đã đối chiếu DD/MM" (verified-price chip) nếu space cho phép. Mobile: stack vertical.
- Urgent expiry (<48h) → red ring + flame icon.
- Tap pill → navigate `/khuyen-mai/<merchantSlug>` để xem chi tiết + copy code.

## Files touched

```
apps/web/lib/coupon-format.ts                                    (NEW deriveShortLabel helper)
apps/web/lib/coupon-match.ts                                     (NEW pickBestCouponForProduct)
apps/web/lib/api.ts                                              (add fetchActiveCoupons)
apps/web/lib/types.ts                                            (CouponItem type if not exists)
apps/web/components/storefront/coupon-inline-pill.tsx            (NEW component)
apps/web/components/storefront/coupon-detail-banner.tsx          (NEW for detail page)
apps/web/components/product-card.tsx                             (add coupons prop + render pill)
apps/web/components/storefront/product-grid.tsx                  (forward coupons prop)
apps/web/app/page.tsx                                            (fetch coupons + pass down)
apps/web/app/categories/[slug]/page.tsx                          (fetch coupons + pass down)
apps/web/app/categories/[slug]/[productSlug]/page.tsx            (fetch coupon + render banner)
apps/api/prisma/schema.prisma                                    (optional: ClickLog.hasInlineCoupon)
apps/api/src/modules/tracking/tracking.controller.ts             (accept hasInlineCoupon)
apps/web/app/actions/tracking.ts                                 (forward flag)
```

## Verification

```bash
# 1. Coupon fetch
curl http://localhost:4000/api/v1/coupons?limit=200
# expect: list active coupons

# 2. Homepage with coupons
# Open / → product cards có merchant Lazada → pill "🎟 Freeship 50K" render
# Cards merchant ko có coupon match → KHÔNG pill (gracefully)

# 3. Detail page banner
# Open product detail có merchant Lazada → banner amber top trang
# Click "Xem chi tiết →" → /khuyen-mai/lazada

# 4. Empty state
# DELETE FROM "Coupon" WHERE "isActive" = true;
# Homepage → no pills, no broken layout

# 5. Urgent expiry
# Set 1 coupon expiresAt = now + 12h → pill red với flame icon

# 6. Mobile responsive
# Mobile 390x844 → pill có thể wrap dưới price block
```

## Definition of done

- [ ] `deriveCouponShortLabel` handle freeship/percent/amount edge cases.
- [ ] `pickBestCouponForProduct` priority đúng (freeship > earliest expiry).
- [ ] `CouponInlinePill` render đẹp với urgent state.
- [ ] ProductCard accept `coupons` prop optional (backward-compatible).
- [ ] Homepage + niche page + detail page mount đúng.
- [ ] No waterfall — single coupon fetch per page.
- [ ] Empty state gracefully (no pill).
- [ ] Urgent expiry red highlight.
- [ ] Tracking flag `hasInlineCoupon` persist (optional A/B data).

## Notes for next session

- Storefront-v2 STORY-03 ProductCard upgrade khi merge: verify pill position vẫn OK trong card v2. Nếu xung đột visual, adjust trong storefront-v2 STORY-03.
- `deriveCouponShortLabel` regex có thể miss edge cases — operator có thể nhập `shortLabel` thủ công admin sau (defer schema migration tới khi cần).
- Match fuzzy `lazada` vs `lazada_kol` — verify mapping đúng cho merchant slug variants. Có thể cần normalize trong sync layer (defer to sprint ops).
- Coupon hub `/khuyen-mai/<merchantSlug>` (storefront-v2 STORY-06) sẽ là landing khi click pill — đảm bảo route hoạt động.
- Future: pill có thể click → modal "Sao chép mã FREESHIP50 + Mua tại Lazada" thay vì navigate. Defer.
- A/B uplift query (AC8) — sau 1 tuần data, operator có thể tự query psql để verify Loop 4 hoạt động.
