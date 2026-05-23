# STORY-06 — Coupon hub v2: countdown + stock + index page

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P1
**Estimate:** 5h
**Dependencies:** STORY-01 (foundation tracking).

## Context

Current coupon hub:
- Per-merchant route: `/khuyen-mai/[merchantSlug]` ([apps/web/app/khuyen-mai/[merchantSlug]/page.tsx](../../../../apps/web/app/khuyen-mai/[merchantSlug]/page.tsx)) — render list coupon active.
- **Không có index route** `/khuyen-mai` (root) → user vào `/khuyen-mai` thấy 404 (đã verify screenshot 2026-05-23).
- Coupon card không có countdown timer — chỉ static text "Hết hạn DD/MM".
- Không có "Còn X mã" stock indicator (AT trả `quantity` nhưng FE chưa render).
- Không có top-savings hero banner để tạo hook.
- "Sao chép mã" không có toast feedback.

**Pattern affiliate VN voucher** (voucher.com.vn, dealtoday.vn):
- Index page có hero "Tiết kiệm X tỷ với Y mã giảm" + filter chip merchant.
- Card có **countdown live** (hh:mm:ss) cho mã hết hạn <48h, "Còn X ngày" cho >48h.
- "Còn 3 mã / Đã dùng 245 mã" stock indicator.
- "Hot" badge cho mã có discount cao.
- Click "Sao chép" → toast confirm + auto-open merchant tab.

## User story

> **As** user VN tìm mã giảm Lazada 15/5 sale,
> **I want** thấy ngay top mã đang nóng, countdown rõ ràng, sao chép 1-tap rồi mở Lazada,
> **so that** tôi không bỏ lỡ flash sale và không bị mã hết hạn khi vào.

## Acceptance criteria

### AC1 — Coupon hub index route

NEW file: `apps/web/app/khuyen-mai/page.tsx` (root).

Layout:

```
Header
─────────────
Hero coupon (NEW component):
  H1: "Mã giảm giá tháng M/Y — Đối chiếu hôm DD/MM HH:mm"
  Sub: "{N} mã đang còn dùng từ {M} cửa hàng. Đã giúp người mua tiết kiệm ước tính {savings}."
  CTA: scroll xuống grid.
─────────────
Filter merchant chip row (sticky):
  [Tất cả] [Lazada (X)] [Shopee (X)] [Tiki (X)] [TikTok (X)] ...
─────────────
Featured (top 3 by max discount):
  3 large coupon card
─────────────
Tất cả mã (grid 3-col desktop, 1-col mobile):
  N coupon card
─────────────
Footer
```

Fetch:
- `GET /api/v1/coupons?limit=100` (active + chưa expired).
- Group by `merchantSlug` để build filter chip row.

ISR `revalidate: 300`.

### AC2 — Coupon card v2 với countdown

NEW component: `apps/web/components/storefront/coupon-card.tsx` (nếu chưa tồn tại — verify, có thể rename file hiện tại).

Layout:

```
┌──────────────────────────────────────────────┐
│ [Logo Lazada]    LAZADA           [HOT]      │
│                  Còn 2 ngày 14h               │ ← countdown text
├──────────────────────────────────────────────┤
│ Giảm 50K cho đơn từ 199K                     │ ← title
│                                              │
│ Áp dụng: Toàn sàn, từ 20:00 - 23:59          │ ← description (1 line clamp)
│ Còn 23/100 mã                                │ ← stock indicator
├──────────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐        │
│ │ FLASHSALE50K  │ │ Lấy mã & mua →  │        │
│ │ [tap to copy]  │ │ [tracked link]  │        │
│ └────────────────┘ └────────────────┘        │
└──────────────────────────────────────────────┘
```

Components:
- **Merchant logo** + name.
- **Countdown** (client component sub):
  - If `expiresAt - now > 48h`: text static "Còn {days} ngày".
  - If `expiresAt - now ≤ 48h`: live countdown `HH:mm:ss`, re-render every second.
  - If `expiresAt - now ≤ 1h`: red color + flame icon + "⏰ Sắp hết".
  - If expired: hide card.
- **Hot badge** trên top-right nếu `maxDiscount ≥ 50` hoặc `maxDiscountPercent ≥ 30`.
- **Title** (`coupon.title` từ DB).
- **Description** (sanitized HTML từ `coupon.contentHtml`, line-clamp-2).
- **Stock indicator**: `quantityRemain / quantityTotal` từ `coupon.quantity*` fields. Format "Còn {remain}/{total} mã" hoặc "Còn {remain} mã" nếu total null. Hide nếu cả 2 null.
- **Copy code** button: code text + click copy to clipboard.
- **CTA "Lấy mã & mua"**: form action tracking → outbound tới `coupon.affiliateUrl` (nếu có) hoặc merchant homepage fallback.

### AC3 — Countdown client component

NEW: `apps/web/components/storefront/coupon-countdown.tsx` (client).

```tsx
"use client";
import { useEffect, useState } from "react";

interface Props { expiresAt: Date; }

export function CouponCountdown({ expiresAt }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return <span className="text-red-600 font-semibold">Đã hết hạn</span>;
  const totalHours = diff / 3600000;
  if (totalHours > 48) {
    const days = Math.floor(totalHours / 24);
    return <span className="text-ink-soft">Còn {days} ngày</span>;
  }
  // ≤48h: show hh:mm:ss
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const className = totalHours <= 1 ? "text-red-600 font-bold" : "text-amber-700 font-semibold";
  const icon = totalHours <= 1 ? "⏰ " : "";
  return <span className={className}>{icon}Còn {h}:{m.toString().padStart(2,"0")}:{s.toString().padStart(2,"0")}</span>;
}
```

Server render: render gấp current "Còn X ngày" làm initial fallback (no hydration flash).

### AC4 — Copy code button với toast

NEW component: `apps/web/components/storefront/copy-code-button.tsx` (client).

```tsx
"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may be blocked */ }
  };
  return (
    <button onClick={copy} className="...">
      <span className="font-mono font-bold">{code}</span>
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
      <span className="sr-only">{copied ? "Đã sao chép" : "Sao chép mã"}</span>
    </button>
  );
}
```

Visual feedback ngắn:
- Default: code text + Copy icon.
- After click: "Đã sao chép ✓" inline 2s, sau đó về default.

### AC5 — Hero stats banner

NEW: `apps/web/components/storefront/coupon-hero.tsx`.

Compute:
- `totalActive`: count coupons với `isActive=true` AND `expiresAt > now`.
- `totalMerchants`: distinct merchantSlug.
- `estimatedSavings`: sum của `maxDiscount` cho mọi coupon (rough). Format VND.

Render H1 + sub + CTA scroll.

### AC6 — Merchant filter chip row

Sticky bar dưới hero.

Render: 1 chip "Tất cả" + 1 chip per merchant.

URL state: `?merchant=lazada`.

Click chip → navigate `/khuyen-mai?merchant=lazada`. Server-side filter products array.

### AC7 — Per-merchant route refactor

File: [apps/web/app/khuyen-mai/[merchantSlug]/page.tsx](../../../../apps/web/app/khuyen-mai/[merchantSlug]/page.tsx).

Refactor để dùng new `<CouponCard>` component.

Layout đơn giản hơn index:
- Hero compact: "{Merchant} — {N} mã đang còn dùng"
- Grid card 2-col mobile / 3-col desktop.
- Link "Xem mã các shop khác →" → `/khuyen-mai`.

### AC8 — Empty state

`/khuyen-mai` với 0 coupon:

```
Hero: "Mã giảm — đang cập nhật từ Lazada, Shopee, TikTok"
Body: EmptyState "Chưa có mã đang còn dùng. Quay lại sau 6h để xem mã mới." + link `/blog` cẩm nang.
```

### AC9 — JSON-LD

`/khuyen-mai` emit `BreadcrumbList`.
Per-merchant route emit `BreadcrumbList` + `ItemList` các coupon.

Per coupon item:
```json
{
  "@type": "Offer",
  "url": "https://dealvault.vn/khuyen-mai/lazada#FLASHSALE50K",
  "name": "Giảm 50K cho đơn từ 199K",
  "priceSpecification": { ... },
  "validThrough": "2026-05-25T23:59:00+07:00"
}
```

### AC10 — Mobile responsive

- Hero stats: 3 stat stack vertical mobile (was 3 col desktop).
- Filter chip: scroll-x ngang mobile.
- Coupon card: full-width, code button + CTA stack vertical.
- Countdown text: 11px mobile, 13px desktop.

## Files touched

```
apps/web/app/khuyen-mai/page.tsx                              (NEW root index)
apps/web/app/khuyen-mai/[merchantSlug]/page.tsx               (refactor)
apps/web/components/storefront/coupon-card.tsx                (NEW or refactor)
apps/web/components/storefront/coupon-hero.tsx                (NEW)
apps/web/components/storefront/coupon-countdown.tsx           (NEW client)
apps/web/components/storefront/copy-code-button.tsx           (NEW client)
apps/web/lib/api.ts                                           (add fetchAllCoupons + fetchCouponStats)
apps/api/src/modules/coupons/coupons.controller.ts            (verify endpoint trả quantityRemain + maxDiscount)
```

Maybe schema:
- `Coupon.maxDiscount` (Int?) — nếu chưa có thì derive từ contentHtml parse (fragile) hoặc add field migration.
- `Coupon.quantityTotal` / `Coupon.quantityRemain` — verify Prisma model has these.

## Verification

```bash
# 1. Visit /khuyen-mai (index)
curl -s http://localhost:3100/khuyen-mai -o /dev/null -w "%{http_code}\n"
# expect: 200

# 2. Visual countdown
# Open /khuyen-mai trong browser. Wait 5s. Countdown text update mỗi giây cho mã <48h.

# 3. Copy button toast
# Click "FLASHSALE50K" code. Expect Check icon hiện 2s. Clipboard contains "FLASHSALE50K".

# 4. Filter
# /khuyen-mai?merchant=lazada → chỉ Lazada coupon visible.

# 5. Expired hidden
# Create test coupon với expiresAt < now → seed → /khuyen-mai → coupon đó KHÔNG render.

# 6. Empty state
# DELETE FROM "Coupon"; → /khuyen-mai → empty state copy + link blog.

# 7. JSON-LD
# View source / Rich Results Test → BreadcrumbList + ItemList valid.
```

## Definition of done

- [ ] `/khuyen-mai` route 200 với index page.
- [ ] Countdown re-render live cho mã <48h.
- [ ] Stock indicator render từ `Coupon.quantityRemain`.
- [ ] Copy code button có toast feedback.
- [ ] Hero stats with 3 fact.
- [ ] Merchant filter via URL state.
- [ ] Per-merchant route reuse new CouponCard.
- [ ] JSON-LD BreadcrumbList + ItemList emit đúng.
- [ ] Mobile responsive verified.
- [ ] Empty state graceful.

## Notes for next session

- `Coupon.maxDiscount` field — verify schema. Nếu chưa có và muốn precise hot badge, cần migration. Tạm thời có thể derive heuristic từ `contentHtml` regex `/giảm (\d+)k|(\d+)%/i`.
- Coupon sync (`CouponSyncService` ở apps/api) đã handle HITL gate (`isActive=false` ban đầu). Verify operator approve flow trong `/admin/coupons` ko break.
- Sau STORY-08, có thể add "Báo có mã mới" subscribe button per merchant → push notification khi sync về mã mới.
- Sticky filter trên mobile (z-index) có thể conflict với bottom nav (STORY-05). Test cross-story khi cả 2 merge.
