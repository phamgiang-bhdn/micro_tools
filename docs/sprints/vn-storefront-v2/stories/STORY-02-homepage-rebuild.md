# STORY-02 — Homepage rebuild: deal-first, top-6-niches curated

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P0
**Estimate:** 6h
**Dependencies:** STORY-01 (foundation fixes) + STORY-03 (ProductCard upgrade). Có thể start trước STORY-03 nếu chấp nhận card chưa có trust signals, refactor lại khi STORY-03 merge.

## Context

Screenshot 2026-05-23 homepage hiện tại ([01-home-desktop.png](https://example.local/dv-screens/01-home-desktop.png)):

- **Hero ôm full fold** — desktop 1440×900: title + description + 2 button + 4 stat card = chiếm ~750px. User phải scroll mới thấy listing.
- **Stats card 4 ô** — "Deal đang sống 0", "Danh mục 100", "Giảm sâu nhất —", "Tổng tiết kiệm —". Khi data thật về, 0 không inspire trust; 100 niche là noise.
- **TopProducts section** dưới hero — đúng vị trí nhưng card style Western (clean, low-density).
- **4 trust feature card** — "Giá đối chiếu rõ ràng", "Chỉ chọn nguồn chính hãng", "Cập nhật mỗi giờ", "Cẩm nang cùng deal". OK copy nhưng không nên ở fold 2 — đẩy xuống footer hoặc thay bằng inline trust strip.
- **Filter chip 100 niches** — sticky bar bên dưới, gây decision fatigue. Mobile càng tệ.
- **Empty state** đã fix ở STORY-01.

**So với `cellphones.com.vn`/`sforum.vn`/`voucher.com.vn`** (affiliate VN winners):
- Hero compact 200-280px, đầy info + 1 CTA, không spam metric.
- **Above-fold ngay sau header có grid deal/promo** — 6-8 card visible.
- Top niches: **6-8 priority niche cards** (image + name + deal count), không phải 100 chip.
- Social proof strip: "Đã đối chiếu X deal | X người tiết kiệm | Cập nhật DD/MM HH:mm".
- Sticky topbar có search + 4-5 menu shortcut (Deal hot, Cẩm nang, Mã giảm).

## User story

> **As** user VN landing trên dealvault.vn từ Google search "deal laptop gaming",
> **I want** thấy deal thật trong fold đầu + biết ngay site này có data + ấn 1-click outbound,
> **so that** tôi không phải scroll/click 3 lần để tới sản phẩm muốn xem.

## Acceptance criteria

### AC1 — Layout structure mới

File: [apps/web/app/page.tsx](../../../../apps/web/app/page.tsx)

Replace toàn bộ JSX body (giữ data fetching `fetchNiches`/`fetchAllProductsFlat`/`fetchTopProducts`).

**Mục tiêu render order top-to-bottom (desktop 1440×900):**

```
0-80px    : Sticky header (giữ nguyên, STORY-05 sẽ refactor)
80-340px  : Hero compact (NEW)
            ├── Trái: tagline 1 dòng + 1 CTA + social-proof strip (1 dòng)
            └── Phải: 1 image hoặc 1 featured deal card (image+price+CTA)
340-380px : Trust strip ngang (1 dòng): "✓ X deal đối chiếu | ✓ Mã giảm còn X | ✓ Cập nhật HH:mm DD/MM"
380-820px : Section "🔥 Deal hot tuần" — 8 card grid 4-col desktop, 2-col mobile
820-900px : (fold ends ở đây desktop)
─── below fold ───
            : Section "Khám phá theo danh mục" — 6 priority niche tiles + "Xem tất cả 100 danh mục →"
            : Section "Mã giảm giá nóng" — 3 coupon card preview (link `/khuyen-mai`)
            : Section "Cẩm nang chọn mua" — 3 latest article card
            : Section "Vì sao chọn dealvault" — 4 trust feature card (current 4-card row, move xuống đây)
            : Footer (giữ nguyên)
```

**Mobile 390×844:**

```
0-56px    : Header
56-280px  : Hero compact (image stack dưới, không cạnh)
280-310px : Trust strip
310-844px : Bắt đầu Hot deals grid 2-col
            user thấy ngay 2-4 card before scroll
```

### AC2 — Hero compact spec

Replace `PageHero` usage. New component: `apps/web/components/storefront/home-hero.tsx` (NEW).

```tsx
<HomeHero
  topDealsCount={allProducts.length}
  savingsTotal={totalSavings}
  hotDealCount={topProducts.length}
  featuredDeal={topDeals[0]} // hiển thị 1 card hot bên phải
  lastUpdatedAt={new Date()}
/>
```

Spec:

- **Background**: gradient nhẹ `from-brand-50/40 to-canvas` — không over-the-top.
- **Tagline**: 1 dòng max, `text-2xl sm:text-3xl font-bold`. Copy đề xuất:
  - Option A: "Mua khôn hơn — đối chiếu giá thật từ Shopee, Lazada, TikTok"
  - Option B: "Săn deal khôn — giá rõ, mã rõ, click thẳng ra sàn"
  - Pick Option A nếu muốn educational. Option B nếu muốn action-y.
- **Sub-line**: 1 dòng nhỏ `text-sm text-ink-soft`: "Cập nhật {hot} deal mỗi giờ • Hôm nay tiết kiệm tới {formatMoney(savingsTotal)}".
- **CTA primary**: "Xem deal hot →" → scroll smooth tới `#hot-deals`.
- **CTA secondary**: "Mã giảm còn dùng" → `/khuyen-mai`.
- **Bên phải (desktop) / dưới (mobile)**: 1 product card (featured deal) — card lớn hơn grid card, có discount badge to, "Xem deal ngay" inline. Click vào → tracking → outbound.
- **KHÔNG có 4 stat card 4 cột trong hero** — info đã merge vào sub-line.
- **Height total**: desktop ≤320px, mobile ≤260px.

### AC3 — Top niches curated (6, không phải 100)

Section "Khám phá theo danh mục" thay 100-chip row.

**Cấu hình priority niches**: NEW file `apps/web/lib/curated-niches.ts`:

```ts
// 6 niche ưu tiên cho homepage. Slug phải match seed.js Niche.slug.
// Image dùng /public/niches/<slug>.jpg (320×240) hoặc placeholder unsplash.
// Order chỉnh được mà không deploy: nếu sau cần, move sang DB column Niche.homepageOrder.

export interface CuratedNiche {
  slug: string;
  displayName: string;        // override Niche.name nếu cần ngắn gọn hơn
  pitch: string;              // 1 dòng why-click ("Giảm 30-50% thường xuyên")
  image: string;
  iconHint?: string;          // lucide icon name fallback nếu chưa có image
}

export const CURATED_NICHES: CuratedNiche[] = [
  { slug: "laptop", displayName: "Laptop", pitch: "Gaming, văn phòng, sinh viên", image: "/niches/laptop.jpg" },
  { slug: "tai-nghe-tws", displayName: "Tai nghe TWS", pitch: "AirPods, Sony, Galaxy Buds", image: "/niches/tai-nghe.jpg" },
  { slug: "robot-hut-bui-lau-nha", displayName: "Robot hút bụi", pitch: "Roborock, Dreame, Ecovacs", image: "/niches/robot.jpg" },
  { slug: "may-loc-khong-khi", displayName: "Máy lọc không khí", pitch: "Lọc PM2.5 cho mùa hanh", image: "/niches/loc-khi.jpg" },
  { slug: "dong-ho-thong-minh", displayName: "Đồng hồ thông minh", pitch: "Apple, Garmin, Galaxy Watch", image: "/niches/dong-ho.jpg" },
  { slug: "my-pham-duong-da", displayName: "Mỹ phẩm dưỡng da", pitch: "Skincare nhật, hàn, dược", image: "/niches/skincare.jpg" }
];
```

Render: NEW component `apps/web/components/storefront/curated-niche-grid.tsx`:

```tsx
<CuratedNicheGrid niches={CURATED_NICHES.map(curated => {
  const niche = niches.find(n => n.slug === curated.slug);
  return { ...curated, productCount: niche?._count?.products ?? 0 };
})} />
```

Render: 3 col desktop / 2 col mobile. Mỗi tile:

```
┌─────────────────────────┐
│   [image 16:9 cover]    │
│   "Robot hút bụi"       │ ← displayName, font-bold
│   12 deal đang sống     │ ← productCount, text-sm text-ink-soft (hide nếu 0)
│   "Roborock, Dreame..." │ ← pitch, text-xs text-ink-mute line-clamp-1
└─────────────────────────┘
```

Hover: lift + brand-500 outline. Click → `/categories/<slug>`.

**Note**: nếu image chưa có, fallback gradient `bg-gradient-to-br from-brand-100 to-brand-300` + icon to giữa. Operator có thể upload sau qua admin (STORY-04 sẽ add upload field cho Niche).

Sau grid: `<Link href="#all-niches">Xem tất cả 100 danh mục →</Link>` → scroll tới section `#all-niches` cuối page (collapsed accordion với 100 niche, hoặc redirect `/danh-muc`).

### AC4 — Social proof strip

NEW component `apps/web/components/storefront/social-proof-strip.tsx`:

```tsx
<SocialProofStrip
  verifiedDealCount={allProducts.length}
  activeCouponCount={???} // need /coupons count endpoint
  lastUpdatedAt={???}     // need from latest Product.updatedAt
/>
```

Render 1 dòng 3 chip ngang, sticky-feel nhưng không sticky:

```
✓ 1,234 deal đã đối chiếu giá  •  ✓ 56 mã giảm còn dùng  •  ✓ Cập nhật 15:42 hôm nay
```

Mobile: stack 3 dòng nhỏ, font-size 11px.

**Backend cần**:
- API endpoint `GET /api/v1/storefront/stats` → `{ verifiedDealCount, activeCouponCount, lastProductUpdatedAt }`. Cache RSC `revalidate: 300`.
- Hoặc compute inline trong RSC page bằng `prisma.product.count` + `prisma.coupon.count` + `prisma.product.findFirst({orderBy: {updatedAt:'desc'}})`. Pick inline nếu chưa có endpoint khác cần.

### AC5 — Hot deals section move up + redesign

Section "🔥 Deal hot tuần" là position #1 ngay dưới trust strip (above fold).

- Component: dùng `ProductGrid` hiện tại nhưng truyền `products={topDeals.slice(0, 8)}`. Top deals sort theo `discountPercent DESC` đã có ở page.tsx hiện tại — giữ logic.
- Grid: 4 col desktop, 2 col mobile, gap 12px.
- Card: dùng `ProductCard` (sẽ upgrade ở STORY-03 — story này render tạm card hiện có, STORY-03 sẽ auto-enhance).
- Tiêu đề section: "🔥 Deal hot trong tuần" + trailing `text-sm`: "Sắp theo % giảm sâu nhất • {N} sản phẩm".
- Có button "Xem thêm deal hot →" → `/deal-hot` (deal hot landing, STORY-07).

### AC6 — Coupon preview section

NEW section sau curated niches. Component: `apps/web/components/storefront/coupon-preview.tsx`.

Fetch 3 coupon active đang gần hết hạn nhất từ `GET /api/v1/coupons?limit=3&sort=expiresAt:asc`.

Card layout:

```
┌────────────────────────────────┐
│ [logo] LAZADA           [ -50% ]│ ← merchant logo + max discount badge
│ Giảm 50K cho đơn từ 199K       │ ← title
│ Còn 2 ngày 14 giờ              │ ← countdown text (server-rendered, OK)
│ [Lấy mã →]                     │
└────────────────────────────────┘
```

Click "Lấy mã" → `/khuyen-mai/<merchantSlug>` (chi tiết trong STORY-06).

### AC7 — Article preview section

Section "Cẩm nang chọn mua" hiển thị 3 article mới nhất.

Fetch: `GET /api/v1/articles?limit=3&sort=publishedAt:desc`.

Reuse `apps/web/components/storefront/article-card.tsx` (đã có).

Trailing: "Xem tất cả cẩm nang →" → `/blog`.

### AC8 — Trust feature row di chuyển

4 card "Giá đối chiếu rõ ràng" etc. — đang ở fold 2, chuyển xuống dưới article preview, ngay trước footer.

Container: light bg `bg-canvas`, padding sm.

### AC9 — Performance

- `revalidate: 300` giữ nguyên.
- Hero featured deal image: `next/image` với `priority` (above fold critical).
- Curated niche images: `next/image` lazy.
- Bundle size: server component-only (no `use client` ở page.tsx hoặc components mới). Verify với `npm run build --workspace web` → output `.next/analyze` nếu có.
- LCP target: ≤2.5s 4G. Test với `npx lighthouse http://localhost:3100`.

### AC10 — Mobile-first verification

Screenshot mobile 390×844:
- Above fold: header + hero compact (image stacks below tagline) + trust strip.
- Scroll 1 lần: thấy ngay 2-4 hot deal card.
- Scroll 2 lần: thấy 4-6 niche tile.
- Tap deal card → 1-click tracking → outbound (qua STORY-03 inline CTA hoặc detail page).

## Files touched

```
apps/web/app/page.tsx                                        (rewrite layout)
apps/web/components/storefront/home-hero.tsx                 (NEW)
apps/web/components/storefront/curated-niche-grid.tsx        (NEW)
apps/web/components/storefront/social-proof-strip.tsx        (NEW)
apps/web/components/storefront/coupon-preview.tsx            (NEW)
apps/web/lib/curated-niches.ts                               (NEW)
apps/web/public/niches/*.jpg                                 (NEW assets — 6 ảnh 320×240 nén ≤30KB)
apps/web/lib/api.ts                                          (add fetchActiveCoupons hoặc inline)
apps/api/src/modules/storefront/storefront.controller.ts     (OPTIONAL: stats endpoint)
```

Files **không** touch (delegate sang story khác):
- `components/product-card.tsx` (STORY-03)
- `components/article/*` (STORY-04)
- header/footer (STORY-05, STORY-09)

## Verification

```bash
# 1. Build
npm run build --workspace web
# expect: success, no new warnings

# 2. Screenshot above-fold desktop
node scripts/screenshot-pages.mjs
# inspect c:/tmp/dv-screens/01-home-desktop.png
# expect: hero ≤320px, thấy ≥6 hot deal card trong fold đầu (900px)

# 3. Screenshot mobile
# expect: hero ≤260px, thấy ≥2 hot deal card trong fold đầu (844px - 56 header)

# 4. Lighthouse
npx lighthouse http://localhost:3100 --only-categories=performance
# expect: LCP ≤2.5s, CLS ≤0.1

# 5. Empty state (no products in DB)
docker exec affiliate-postgres psql -U affiliate_admin -d affiliate_platform -c "DELETE FROM \"Product\";"
# visit homepage
# expect: hero render OK with "0 deal" sub-line, hot deals section hide hoặc show "Đang cập nhật", curated niches vẫn show với productCount=0 nhưng không broken
```

## Definition of done

- [ ] Hero ≤320px desktop, ≤260px mobile.
- [ ] Above-fold desktop có ≥6 product card visible.
- [ ] Curated 6 niche tile thay 100-chip row.
- [ ] Social proof strip 3 fact với data thật.
- [ ] Coupon preview 3 card + link `/khuyen-mai`.
- [ ] Article preview 3 card + link `/blog`.
- [ ] Lighthouse perf ≥85.
- [ ] Empty state graceful (test với DB rỗng).
- [ ] PR có screenshot before/after desktop + mobile.

## Notes for next session

- Story này render `ProductCard` hiện tại. Khi STORY-03 merge, card sẽ tự upgrade — không cần đụng lại page.tsx.
- Niche images `/public/niches/*.jpg` cần operator upload. Nếu chưa có, dùng fallback gradient + icon — không block release.
- Coupon section depend `/api/v1/coupons` endpoint — verify endpoint có hỗ trợ `sort=expiresAt:asc`, nếu chưa thì thêm trong API hoặc sort client-side sau fetch.
- Có thể demo populated state bằng STORY-10 (operator pull thật) hoặc seed fixture trong PR review.
- STORY-07 (deal-hot landing) sẽ link từ "Xem thêm deal hot →" button — không cần block STORY-02 release.
