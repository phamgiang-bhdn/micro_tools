# STORY-04 — Niche page editorial-first: H1 "Top X 2026" + comparison table top

**Sprint:** [vn-storefront-v2](../sprint.md)
**Priority:** P1
**Estimate:** 4h
**Dependencies:** STORY-03 (ProductCard upgrade) — niche page render product grid với card mới.

## Context

Current niche page ([apps/web/app/categories/[slug]/page.tsx](../../../../apps/web/app/categories/[slug]/page.tsx)) render:
- Breadcrumb + plain H1 "Laptop"
- Description text 1 dòng "Chưa có sản phẩm" (empty) hoặc "{N} sản phẩm thuộc {niche}".
- 3 stat card.
- Grid ProductCard.

**Vấn đề SEO + UX**:
- H1 "Laptop" generic — Google không có tín hiệu freshness, không có tín hiệu commercial intent.
- Không có editorial intro paragraph → user scroll thẳng vào grid không context.
- Không có comparison table top → user phải đọc từng card rồi tự nhớ so sánh.
- Empty niche page có "Khám phá danh mục khác" — OK nhưng không giúp user mua được gì.

**SEO benchmark** (top affiliate VN ranking cho "top laptop sinh viên dưới 15 triệu"):
- H1 có format: "Top {N} {niche} {qualifier} tốt nhất {month}/{year}" — keyword density + freshness.
- Lead paragraph 80-120 từ: pain point + criteria + commitment ("chúng tôi đã kiểm chứng giá ngày DD/MM").
- Comparison table top 3-5 — quick reference.
- Phần FAQ cuối — long-tail keyword.
- Internal link tới bài "cẩm nang chọn {niche}".

## User story

> **As** Google bot crawl `/categories/laptop` để rank cho "top laptop tháng 5 2026",
> **I want** thấy H1 có time-stamp + commercial intent + comparison table có structured data,
> **so that** trang được rank cao + user landing thấy editorial value chứ không phải plain catalog.

## Acceptance criteria

### AC1 — H1 dynamic theo time + niche

File: [apps/web/app/categories/[slug]/page.tsx](../../../../apps/web/app/categories/[slug]/page.tsx)

Replace `<h1>{niche.name}</h1>` thành `<h1>{buildNicheTitle(niche, products.length)}</h1>`.

NEW helper `apps/web/lib/niche-seo.ts`:

```ts
const MONTH_VN = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function buildNicheTitle(niche: { name: string; slug: string }, productCount: number, now: Date = new Date()): string {
  const m = MONTH_VN[now.getMonth() + 1];
  const y = now.getFullYear();
  // Top N pattern: nếu có ≥10 product, "Top 10". Nếu 5-9, "Top {N}". <5, không có Top.
  const cap = productCount >= 10 ? 10 : productCount >= 5 ? productCount : 0;
  if (cap > 0) return `Top ${cap} ${niche.name} đáng mua tháng ${m}/${y}`;
  return `${niche.name} — Deal tốt nhất tháng ${m}/${y}`;
}
```

`generateMetadata` cũng dùng helper này cho `<title>`.

### AC2 — Editorial intro paragraph

NEW field DB-driven optional: dùng `Niche.seoDescription` đã có. Nếu null → fallback auto-gen.

Component: NEW `apps/web/components/storefront/niche-intro.tsx`.

```tsx
<NicheIntro
  niche={niche}
  productCount={products.length}
  lastUpdatedAt={products[0]?.updatedAt}
  topDiscount={biggestDiscount}
/>
```

Render template:

```
{niche.seoDescription ?? autoIntro(niche, productCount, lastUpdatedAt, topDiscount)}
```

`autoIntro` function trong `lib/niche-seo.ts`:

```ts
export function autoIntro(niche, count, lastUpdatedAt, topDiscount): string {
  const updateStr = lastUpdatedAt ? formatRelativeShort(lastUpdatedAt) : "hôm nay";
  return `Tổng hợp ${count} ${niche.name.toLowerCase()} đang giảm giá tại Lazada, Shopee, TikTok Shop và các shop chính hãng. Mức giảm sâu nhất hiện tại ${topDiscount}%. Giá được đối chiếu ${updateStr} — bạn xem nhanh, so sánh chéo, click thẳng ra sàn không cần đăng ký.`;
}
```

Render: 2-3 dòng paragraph, font-size sm, leading-relaxed, max-w-3xl, color ink-soft.

### AC3 — Comparison table top (top 3-5 by discount)

NEW component `apps/web/components/storefront/niche-comparison-table.tsx`.

Props:
```ts
{ products: ProductView[], schemaConfig: NicheSchemaConfig, maxRows: number = 5 }
```

Render top N products sort by `discountPercent DESC`, lấy 4-6 columns key spec từ `schemaConfig` (e.g. cho laptop: cpu, ram, storage, screen, weight).

Layout (desktop):

```
┌───────────────────────────────────────────────────────────────────┐
│ Sản phẩm  │ Giá       │ Giảm  │ CPU       │ RAM  │ SSD │ Mua    │
├───────────┼───────────┼───────┼───────────┼──────┼─────┼────────┤
│ [img] X1  │ 14.5tr    │ -30%  │ i5-12450H │ 16GB │ 512 │ [Mua] │
│ [img] Y2  │ 17.9tr    │ -25%  │ i7-13700H │ 16GB │ 1TB │ [Mua] │
│ ...       │ ...       │ ...   │ ...       │ ...  │ ... │ ...    │
└───────────────────────────────────────────────────────────────────┘
```

- Cell "Mua" = inline form action tracking → outbound (giống ProductCard).
- Image cell: 60×60 thumbnail.
- Mobile: scroll-x horizontal. Sticky first column "Sản phẩm".

**Column auto-pick logic**:
- Đọc `schemaConfig` keys.
- Filter keys có data trong ≥3/N row top (skip column nếu sparse).
- Max 5 spec column + 3 fixed (image+name, giá, giảm, mua).

### AC4 — Sticky filter bar

Filter bar hiện đang ở homepage. Niche page cũng cần — nhưng filter trong niche scope (price range, store).

Component: NEW `apps/web/components/storefront/niche-filter-bar.tsx`.

Filters:
- **Khoảng giá**: chip row preset (cho laptop: "Dưới 10tr", "10-15tr", "15-20tr", "20-30tr", "Trên 30tr"). Preset đọc từ `Niche.schemaConfig.priceTiers` (optional new field) hoặc fallback default 5 tier.
- **Cửa hàng**: chip row distinct store names có trong products.
- **Sắp theo**: dropdown (top, price-asc, price-desc, newest).

URL state: `?price=10-15tr&store=lazmall&sort=top`. Parsable trong RSC page bằng `searchParams`.

Apply filter logic ở RSC page level (server-side filter `products` array trước khi render). KHÔNG dùng client state — giữ ISR cache work.

### AC5 — JSON-LD structured data

Thêm vào `generateMetadata` JSON-LD `ItemList` cho top products:

```ts
const itemListLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: products.slice(0, 10).map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${SITE_URL}/categories/${niche.slug}/${p.slug ?? p.id}`,
    name: p.name
  }))
};
```

Inject vào page body như current product detail page làm.

Verify với https://search.google.com/test/rich-results sau khi deploy.

### AC6 — FAQ section cuối page (optional row-level data)

Component: NEW `apps/web/components/storefront/niche-faq.tsx`.

FAQ items đọc từ:
- `Niche.faqItems` (NEW DB field optional, Json `Array<{q: string; a: string}>`), hoặc
- Latest published article của niche type `BUYING_GUIDE` — extract `faq` block trong sections.

Nếu cả 2 nguồn rỗng → hide section, không placeholder.

JSON-LD `FAQPage` cho FAQ này:

```ts
const faqLd = faqItems.length > 0 ? {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
} : null;
```

### AC7 — Internal link tới article

Section cuối page (trước footer): "Đọc thêm trước khi mua".

Fetch: latest 3 article có `nicheSlug = current` `status = PUBLISHED`.

Render 3 article card (reuse `components/storefront/article-card.tsx`).

Nếu 0 article cho niche → hide section.

### AC8 — Empty niche handling

Khi `products.length === 0`:
- H1 vẫn render với date stamp (giữ SEO).
- Intro paragraph thay = "Niche {niche.name} đang được cập nhật. Trong lúc đợi, xem các danh mục đang nhiều deal tốt:"
- Hide comparison table + filter bar.
- Render curated niche grid (6 niche khác có productCount > 0) — reuse component từ STORY-02.
- Vẫn render article section nếu có article.

### AC9 — Performance

- `revalidate: 300` giữ.
- Comparison table chỉ render top 5, không lazy.
- Image cell trong table dùng `next/image` 60×60.
- Filter changes via URL navigation (full page reload) — không client state.

## Files touched

```
apps/web/app/categories/[slug]/page.tsx                       (rewrite layout, add filter parsing)
apps/web/components/storefront/niche-intro.tsx                (NEW)
apps/web/components/storefront/niche-comparison-table.tsx     (NEW)
apps/web/components/storefront/niche-filter-bar.tsx           (NEW)
apps/web/components/storefront/niche-faq.tsx                  (NEW)
apps/web/lib/niche-seo.ts                                     (NEW helpers)
apps/web/lib/format.ts                                        (add formatRelativeShort)
apps/api/prisma/schema.prisma                                  (optional add Niche.faqItems Json?)
apps/api/prisma/migrations/<timestamp>_niche_faq_items/       (optional)
apps/api/src/modules/categories/categories.controller.ts      (return faqItems in niche detail response)
```

Optional migration nếu chọn add `Niche.faqItems`:

```sql
ALTER TABLE "Niche" ADD COLUMN "faqItems" JSONB;
```

Run via `npm run db:migrate -- --name add_niche_faq_items` từ root.

## Verification

```bash
# 1. Build
npm run build --workspace web

# 2. Test với niche có data
curl http://localhost:3100/categories/laptop?price=10-15tr | grep -E "<title>|H1|comparison|JSON-LD"
# expect: title chứa "Top {N} Laptop...tháng X/2026"
# expect: comparison table HTML structure
# expect: <script type="application/ld+json"> với ItemList

# 3. Test với niche rỗng
curl http://localhost:3100/categories/may-loc-nuoc | grep -i "đang được cập nhật"
# expect: empty state copy

# 4. Test filter URL state
curl http://localhost:3100/categories/laptop?store=lazmall | grep "lazmall"
# expect: chỉ products có store match render

# 5. Rich results test (after deploy)
# https://search.google.com/test/rich-results?url=https://dealvault.vn/categories/laptop
```

## Definition of done

- [ ] H1 có format "Top {N} {niche} tháng M/Y" khi có ≥5 product.
- [ ] Comparison table top 5 với 5+ column spec auto-picked từ schemaConfig.
- [ ] Filter bar (giá, cửa hàng, sort) bằng URL state.
- [ ] JSON-LD `ItemList` emit cho top 10.
- [ ] FAQ section + JSON-LD `FAQPage` nếu có data.
- [ ] Article preview 3 card cuối page.
- [ ] Empty niche graceful, link sang niche khác.
- [ ] Mobile: comparison table scroll-x.

## Notes for next session

- `Niche.faqItems` là optional, có thể defer sang sprint sau. Nếu không add migration, dùng article-extracted FAQ làm source duy nhất.
- Comparison table column selection có thể tinh chỉnh per niche bằng `Niche.schemaConfig.comparisonColumns: string[]` (priority list) — nhưng đợi feedback từ operator trước khi add.
- Internal link tới buying guide article cần STORY-10 generate ≥1 article per priority niche để demo work.
- Nếu sau muốn personalization (filter remember per user), cần localStorage — defer sang sprint sau.
