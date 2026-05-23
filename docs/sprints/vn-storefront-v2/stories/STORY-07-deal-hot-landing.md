# STORY-07 — Daily-deal landing `/deal-hot/<date>` cho FB ads

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P2
**Estimate:** 5h
**Dependencies:** STORY-02 (homepage rebuild) + STORY-03 (ProductCard) — landing dùng curated layout patterns + new card.

## Context

Hiện tại storefront chỉ có `/` (homepage) làm landing. Khi chạy FB ad ngân sách thử nghiệm cho VN audience, cần landing **focused** không phải homepage:
- Trên FB, user tap ad → mong đợi 1 deal cụ thể, không phải catalog 100 niche.
- Mobile-only feel: big image, big discount, 1-tap CTA.
- Tạo OG image dynamic mỗi ngày để post FB → preview attractive ("Hôm nay: Giảm 50% Robot Roborock — Hết hạn 23:59").
- Landing có thể share Zalo/Facebook → link sang `/deal-hot/2026-05-23` static URL canonical-able.

## User story

> **As** marketing dealvault chạy FB ad lookalike audience VN nữ 25-45,
> **I want** landing page mobile-first chỉ show 10 deal top hôm nay, 1-tap outbound, OG image preview hấp dẫn,
> **so that** CTR FB ad cao + bounce rate thấp + traffic này có dedicated tracking source.

## Acceptance criteria

### AC1 — Route + params

NEW file: `apps/web/app/deal-hot/[[...date]]/page.tsx` (catch-all optional segment).

URL pattern:
- `/deal-hot` → redirect (308) tới `/deal-hot/YYYY-MM-DD` (today, VN timezone UTC+7).
- `/deal-hot/2026-05-23` → renders deals for that date.
- `/deal-hot/2026-99-99` (invalid) → 404.

Server-side `notFound()` cho date invalid (regex `^\d{4}-\d{2}-\d{2}$`).

### AC2 — Data selection

Top 10 deals for the given date:
- Filter `Product.isPublic = true`.
- Order: `discountPercent DESC, updatedAt DESC`.
- Limit 10.
- If `date` is today: cache 5 phút (`revalidate: 300`).
- If `date` past: cache 24h (`revalidate: 86400`) — historical deal sẽ stable.

NEW endpoint `GET /api/v1/storefront/deal-hot?date=YYYY-MM-DD`. Hoặc inline Prisma query.

**Lưu ý**: deal lịch sử có thể đã expire (affiliateUrl 404). Vẫn render card nhưng badge "Đã hết deal" + disable CTA → tránh dead link tracking.

Có thể snapshot table:
- NEW model `DealHotSnapshot { date, productId, position, snapshotData }` — sync cron 3h.
- Hoặc compute on-the-fly nếu chưa cần history. **Pick on-the-fly cho story này** — đơn giản hơn.

### AC3 — Landing layout (mobile-first)

```
─── Status bar ───
Header compact:
  [logo] dealvault              [≡]
  "Săn deal khôn"
─── Hero ───
  "🔥 DEAL HOT HÔM NAY"
  "Cập nhật 14:32 • 23/05/2026"
  Big-number stat: "10 deal • Giảm tới 67%"
  Trust strip 1 dòng
─── Deal grid (vertical stack mobile) ───
  Deal 1: full-width hero card
    - Position #1 with crown icon
    - Image 16:9 large
    - Brand + name
    - Original/sale price big
    - "GIẢM 67%" badge huge
    - "Đã đối chiếu HH:mm" trust chip
    - "🔥 X người đã mua"
    - [ Xem deal ngay → ] full-width brand button (tracking action)

  Deal 2-10: stacked similar cards (smaller).

─── CTA cuối ───
  "Hết deal hôm nay rồi?"
  "📧 Đăng ký nhận deal mỗi sáng 7:00"
  [Email input + Đăng ký button]  ← STORY-08 sẽ wire real

─── Footer mini ───
  Affiliate disclosure 1 dòng.
  Link sang `/` homepage.
```

Desktop: max-width 480px centered, simulate mobile UX. Background canvas-soft outer.

### AC4 — OG image generation

NEW: `apps/web/app/deal-hot/[[...date]]/opengraph-image.tsx`.

Next.js OG image API. Render canvas:

```
┌────────────────────────────────────────────┐
│  dealvault • Deal hot 23/05/2026          │
│                                            │
│   🔥 GIẢM 67%                              │
│   Robot hút bụi Roborock S7 Pro Ultra      │
│   8.990.000₫  ̶26.490.000₫̶                 │
│                                            │
│   [image product]                          │
│                                            │
│   Còn 8 deal hot khác →                    │
└────────────────────────────────────────────┘
```

Size: 1200×630 (FB OG standard).

Cache: edge cache 6h.

### AC5 — Metadata + sharing

`generateMetadata`:
- title: "Top 10 deal hot {DD/MM/YYYY} — Giảm tới {N}%"
- description: "{N} deal được đối chiếu giá lúc HH:mm. Mua qua dealvault, đối tác chính thức Lazada, Shopee, TikTok."
- ogImage: `/deal-hot/{date}/opengraph-image`.
- twitter card large.
- alternates.canonical: `/deal-hot/{date}`.

### AC6 — UTM tracking from FB

URL có thể nhận `?fbclid=...` từ FB hoặc `?utm_source=fb&utm_campaign=...` từ ads.

Forward UTM tới ClickLog notes:
- Tracking action đọc cookie/query để pass `attributionSource = "deal_hot_fb"` cho mỗi click trên trang này.
- Implement: NEW field `ClickLog.attributionSource: string?` (Prisma migration). Default null.
- Tracking endpoint accept optional `attributionSource` body param.

(Có thể defer nếu schema migration too heavy — pick decision tại impl time.)

### AC7 — "Đã hết deal hôm nay" empty state

Date hôm nay với 0 product (rare nhưng cần handle):

```
🌙 Hôm nay chưa có deal hot
Team dealvault đang đối chiếu deal mới. Quay lại sau 6h, hoặc xem deal hôm qua:
[Deal hôm qua →]  [Cẩm nang →]
```

Link "Deal hôm qua →" = `/deal-hot/{yesterday}`.

### AC8 — Historical date with archived deals

Date trong quá khứ với deal expired:
- Vẫn render snapshot.
- Mỗi card có badge "Đã hết deal" thay cho discount badge.
- CTA "Xem deal ngay" → disabled hoặc link sang `/categories/<slug>/<productSlug>` (detail page) thay outbound.

### AC9 — Performance

- LCP target ≤2s (mobile 4G). Image hero card phải `priority`.
- JS bundle: chỉ client component cho email input — không lazy load.
- Edge cache: nếu host trên Vercel, cấu hình `Cache-Control: s-maxage=300, stale-while-revalidate=900` cho date today.

### AC10 — Internal link từ homepage

Trên homepage section "🔥 Deal hot trong tuần" thêm button "Xem deal hot hôm nay →" → `/deal-hot`.

Bottom nav "Deal hot" tab (STORY-05) link tới `/deal-hot` (current today).

## Files touched

```
apps/web/app/deal-hot/[[...date]]/page.tsx                    (NEW)
apps/web/app/deal-hot/[[...date]]/opengraph-image.tsx         (NEW)
apps/web/components/storefront/deal-hot-hero-card.tsx         (NEW — top-1 large card)
apps/web/components/storefront/deal-hot-list-card.tsx         (NEW — list card 2-10)
apps/web/components/storefront/deal-hot-subscribe-cta.tsx     (NEW — email input bottom)
apps/web/lib/api.ts                                           (add fetchDealHot)
apps/web/lib/date.ts                                          (NEW utc+7 helpers)
apps/api/src/modules/storefront/storefront.controller.ts      (OPTIONAL: deal-hot endpoint)
apps/api/prisma/schema.prisma                                  (OPTIONAL: ClickLog.attributionSource)
apps/web/app/page.tsx                                         (link to /deal-hot)
```

## Verification

```bash
# 1. Route resolution
curl -I http://localhost:3100/deal-hot
# expect: 308 redirect to /deal-hot/2026-05-23

curl -I http://localhost:3100/deal-hot/2026-05-23
# expect: 200

curl -I http://localhost:3100/deal-hot/invalid
# expect: 404

# 2. OG image
curl -I http://localhost:3100/deal-hot/2026-05-23/opengraph-image
# expect: 200, content-type image/png

# 3. FB validator
# https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fdealvault.vn%2Fdeal-hot%2F2026-05-23
# expect: og:image render + correct title/desc

# 4. Mobile render
node scripts/screenshot-pages.mjs --add deal-hot/2026-05-23
# expect: hero card huge, deal 1 above fold mobile

# 5. UTM tracking
curl -s "http://localhost:3100/deal-hot/2026-05-23?utm_source=fb&utm_campaign=test"
# expect: render OK
# click any "Xem deal ngay" → POST /tracking/click with attributionSource="deal_hot_fb"
```

## Definition of done

- [ ] `/deal-hot` redirect tới today.
- [ ] `/deal-hot/<date>` valid render 10 deal.
- [ ] OG image generate dynamic per date.
- [ ] FB sharing preview correct.
- [ ] Mobile layout vertical stack, hero card huge, 1-tap outbound.
- [ ] Empty state graceful.
- [ ] Historical date với expired deals render archive mode.
- [ ] UTM forwarded to ClickLog (nếu schema migration applied).
- [ ] Internal link từ homepage + bottom nav.

## Notes for next session

- Email subscribe input chỉ là form placeholder ở story này — STORY-08 sẽ wire real backend.
- Nếu performance OG generation chậm trên prod, cân nhắc pre-generate cron daily 00:01.
- "DealHotSnapshot" table có thể add sau nếu cần precise history (e.g. "Deal hot mùng 1 Tết 2026" 1 năm sau click vào vẫn đúng list). Hiện tại on-the-fly OK.
- Nếu FB ads target Zalo audience, cân nhắc test ZaloMiniApp landing variant — sprint sau.
