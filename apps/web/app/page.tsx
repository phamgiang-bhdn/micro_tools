import type React from "react";
import Link from "next/link";
import { fetchAllProductsFlat, fetchNiches, fetchTopProducts } from "../lib/api";
import { EmptyState } from "../components/ui/empty-state";
import { Button } from "../components/ui/button";
import { Icon } from "../components/ui/icon";
import { PageHero, PageSection, SectionHeading } from "../components/ui/section";
import { Stat, StatGrid } from "../components/ui/stat";
import { FilterChip, FilterChipRow } from "../components/ui/filter-chip";
import { ProductGrid } from "../components/storefront/product-grid";
import { FeaturedPreview } from "../components/storefront/featured-preview";
import { TopProductCard } from "../components/storefront/top-product-card";
import { SortControl } from "../components/storefront/sort-control";
import { TrustStrip } from "../components/storefront/trust-strip";
import { formatMoney, formatNumber } from "../lib/format";

export const revalidate = 300;

interface HomeProps {
  searchParams: Promise<{ category?: string; sort?: string; q?: string }>;
}

const CODE_KBD = "rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-ink border border-line";

export default async function HomePage({ searchParams }: HomeProps): Promise<React.ReactElement> {
  const { category: activeSlug, sort = "top", q = "" } = await searchParams;
  const [{ niches, loadError }, topProducts] = await Promise.all([
    fetchNiches(),
    fetchTopProducts(12)
  ]);
  const allProducts = loadError ? [] : await fetchAllProductsFlat(niches);

  const query = q.trim().toLowerCase();
  let filtered = activeSlug ? allProducts.filter((p) => p.nicheSlug === activeSlug) : allProducts;
  if (query.length > 0) {
    filtered = filtered.filter((p) =>
      [p.name, p.brand, p.store, p.nicheName]
        .filter((s): s is string => Boolean(s))
        .some((field) => field.toLowerCase().includes(query))
    );
  }
  const sorted = sortProducts(filtered, sort);

  const topDeals = [...allProducts]
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
    .slice(0, 8);
  const biggestDiscount = topDeals[0]?.discountPercent ?? 0;
  const totalSavings = allProducts.reduce((sum, p) => {
    if (p.originalPrice && p.price && p.originalPrice > p.price) return sum + (p.originalPrice - p.price);
    return sum;
  }, 0);

  const activeNiche = activeSlug ? niches.find((c) => c.slug === activeSlug) : undefined;
  const listingTitle = activeNiche?.name ?? (query ? "Kết quả tìm kiếm" : "Deal hôm nay");
  const listingDescription = activeNiche
    ? `${sorted.length} sản phẩm thuộc ${activeNiche.name}, sắp theo mức giảm cao nhất.`
    : query
      ? `${sorted.length} sản phẩm khớp từ khoá của bạn.`
      : `Tổng hợp ${sorted.length} deal đang sống, ưu tiên mức giảm cao.`;

  return (
    <div>
      <PageHero
        size="lg"
        eyebrow={
          <>
            <span aria-hidden className="size-2 rounded-full bg-brand-500 animate-pulse-glow" />
            Cập nhật ưu đãi mỗi giờ
          </>
        }
        title={
          <>
            Săn deal tốt nhất, <br className="hidden sm:block" />
            <span className="text-gradient-brand">không cần so sánh thủ công</span>
          </>
        }
        description="Tổng hợp ưu đãi từ Shopee, Lazada, TikTok Shop, Accesstrade. Mỗi sản phẩm đều có giá gốc — giá sau ưu đãi rõ ràng, bạn quyết định trong 1 phút."
        actions={
          <>
            <Button asChild variant="brand" size="lg">
              <Link href="/?sort=top">
                <Icon name="flame" size="md" />
                <span>Xem deal hot nhất</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#listing">Khám phá theo danh mục</Link>
            </Button>
          </>
        }
        stats={
          <StatGrid cols={4}>
            <Stat label="Deal đang sống" value={formatNumber(allProducts.length)} />
            <Stat label="Danh mục" value={String(niches.length)} />
            <Stat
              label="Giảm sâu nhất"
              value={biggestDiscount ? `-${biggestDiscount}%` : "—"}
              tone="brand"
            />
            <Stat
              label="Tổng tiết kiệm"
              value={totalSavings > 0 ? formatMoney(totalSavings) : "—"}
              tone="accent"
            />
          </StatGrid>
        }
        aside={<FeaturedPreview deals={topDeals.slice(0, 3)} />}
      />

      {!loadError ? (
        <PageSection padding="default" className="bg-canvas">
          <TrustStrip />
        </PageSection>
      ) : null}

      {topProducts.length > 0 ? (
        <PageSection padding="default" className="bg-canvas">
          <SectionHeading
            title="🔥 Đang hot tuần này"
            description="Top bán chạy từ Accesstrade, cập nhật hàng ngày. Click → mở thẳng ở merchant."
            trailing={<>{topProducts.length} sản phẩm</>}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {topProducts.map((p) => (
              <TopProductCard key={p.id} product={p} />
            ))}
          </div>
        </PageSection>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        {loadError ? (
          <EmptyState
            tone="error"
            title="Không kết nối được API"
            description={
              <div className="space-y-2 text-left">
                <p className="font-mono text-[11px] text-red-700">{loadError}</p>
                <p>
                  Bật backend: <code className={CODE_KBD}>npm run dev:api</code>, kiểm tra{" "}
                  <code className={CODE_KBD}>API_BASE_URL</code> trong <code className={CODE_KBD}>apps/web/.env</code>.
                </p>
              </div>
            }
          />
        ) : null}

        {niches.length > 0 ? (
          <div
            id="listing"
            className="sticky top-16 z-30 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
          >
            <FilterChipRow
              label="Lọc theo danh mục"
              trailing={<SortControl sort={sort} buildHref={(v) => buildHref({ category: activeSlug, sort: v, q })} />}
            >
              <FilterChip
                href={buildHref({ category: undefined, sort, q })}
                active={!activeSlug}
                label="Tất cả"
                count={allProducts.length}
              />
              {niches.map((niche) => (
                <FilterChip
                  key={niche.id}
                  href={buildHref({ category: niche.slug, sort, q })}
                  active={activeSlug === niche.slug}
                  label={niche.name}
                  count={niche._count?.products ?? 0}
                />
              ))}
            </FilterChipRow>
            {query ? (
              <p className="mt-2 text-xs text-ink-mute">
                Đang tìm: <span className="font-medium text-ink">“{q}”</span> · {sorted.length} kết quả
                {" · "}
                <Link href={buildHref({ category: activeSlug, sort, q: "" })} className="text-brand-700 hover:underline">
                  Xoá tìm kiếm
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {!loadError && sorted.length === 0 ? (
          <EmptyState
            tone="warning"
            title={query ? "Không có kết quả phù hợp" : "Chưa có sản phẩm"}
            description={
              query ? (
                <p>Thử bỏ bớt từ khoá hoặc chọn danh mục khác.</p>
              ) : (
                <p>
                  Chạy <code className={CODE_KBD}>npm run db:seed</code> rồi tải lại trang.
                </p>
              )
            }
          />
        ) : null}

        {sorted.length > 0 ? (
          <>
            <SectionHeading
              title={listingTitle}
              description={listingDescription}
              trailing={<>{sorted.length} sản phẩm</>}
            />
            <ProductGrid products={sorted} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function sortProducts<T extends { discountPercent?: number; price?: number; name: string }>(
  list: T[],
  sort: string
): T[] {
  const copy = [...list];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    case "price-desc":
      return copy.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case "newest":
      return copy.reverse();
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    case "top":
    default:
      return copy.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
  }
}

function buildHref({ category, sort, q }: { category?: string; sort?: string; q?: string }): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sort && sort !== "top") params.set("sort", sort);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
