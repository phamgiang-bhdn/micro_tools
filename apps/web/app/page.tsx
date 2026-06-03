import type React from "react";
import Link from "next/link";
import {
  fetchActiveCoupons,
  fetchActiveTools,
  fetchAllProductsFlat,
  fetchArticles,
  fetchNiches,
  fetchTopProducts
} from "../lib/api";
import { EmptyState } from "../components/ui/empty-state";
import { Icon } from "../components/ui/icon";
import { PageSection, SectionHeading } from "../components/ui/section";
import { FilterChip, FilterChipRow } from "../components/ui/filter-chip";
import { ProductGrid } from "../components/storefront/product-grid";
import { TopProductCard } from "../components/storefront/top-product-card";
import { SortControl } from "../components/storefront/sort-control";
import { TrustStrip } from "../components/storefront/trust-strip";
import { HomeHero } from "../components/storefront/home-hero";
import { AiHero } from "../components/storefront/ai-hero";
import { CuratedNicheGrid } from "../components/storefront/curated-niche-grid";
import { SocialProofStrip } from "../components/storefront/social-proof-strip";
import { SessionRestoreBanner } from "../components/storefront/session-restore-banner";
import { CouponPreview } from "../components/storefront/coupon-preview";
import { ArticleCard } from "../components/storefront/article-card";
import { CURATED_NICHES } from "../lib/curated-niches";

export const revalidate = 300;

interface HomeProps {
  searchParams: Promise<{ category?: string; sort?: string; q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps): Promise<React.ReactElement> {
  const { category: activeSlug, sort = "top", q = "" } = await searchParams;
  const [{ niches, loadError }, topProducts, activeCoupons, latestArticles, aiTools] = await Promise.all([
    fetchNiches(),
    fetchTopProducts(12),
    fetchActiveCoupons(3),
    fetchArticles({ limit: 3 }),
    fetchActiveTools(6)
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

  const totalSavings = allProducts.reduce((sum, p) => {
    if (p.originalPrice && p.price && p.originalPrice > p.price) return sum + (p.originalPrice - p.price);
    return sum;
  }, 0);

  const curatedTiles = CURATED_NICHES.map((curated) => {
    const niche = niches.find((n) => n.slug === curated.slug);
    return { ...curated, productCount: niche?._count?.products ?? 0 };
  });

  const activeNiche = activeSlug ? niches.find((c) => c.slug === activeSlug) : undefined;
  const listingTitle = activeNiche?.name ?? (query ? "Kết quả tìm kiếm" : "Tất cả deal");
  const listingDescription = activeNiche
    ? `${sorted.length} sản phẩm thuộc ${activeNiche.name}, sắp theo mức giảm cao nhất.`
    : query
      ? `${sorted.length} sản phẩm khớp từ khoá của bạn.`
      : `Lọc theo danh mục bên dưới để xem deal cụ thể.`;

  return (
    <div>
      {aiTools.length > 0 ? (
        <AiHero
          tools={aiTools}
          featuredDeal={topDeals[0] ?? null}
          productCount={allProducts.length}
          hotDealCount={topProducts.length}
        />
      ) : (
        <HomeHero
          topDealsCount={allProducts.length}
          hotDealCount={topProducts.length}
          savingsTotal={totalSavings}
          featuredDeal={topDeals[0] ?? null}
        />
      )}

      <div className="mx-auto max-w-6xl px-4">
        <SessionRestoreBanner />
      </div>

      <PageSection padding="tight" className="bg-canvas">
        <SocialProofStrip
          verifiedDealCount={allProducts.length}
          activeCouponCount={activeCoupons.length > 0 ? activeCoupons.length : 0}
          lastUpdatedAt={pickLatestProductUpdate(allProducts)}
        />
      </PageSection>

      {loadError ? (
        <PageSection padding="default">
          <EmptyState
            tone="warning"
            title="Hệ thống đang bảo trì"
            description={
              <p>
                Chúng tôi đang cập nhật danh sách deal. Vui lòng quay lại sau ít phút, hoặc xem{" "}
                <Link href="/blog" className="font-medium text-primary-700 hover:underline">
                  cẩm nang chọn mua
                </Link>{" "}
                trong lúc chờ.
              </p>
            }
          />
        </PageSection>
      ) : null}

      {topDeals.length > 0 ? (
        <PageSection padding="default" id="hot-deals" className="bg-canvas">
          <SectionHeading
            title="🔥 Deal hot trong tuần"
            description={`Sắp theo % giảm sâu nhất · ${topDeals.length} sản phẩm`}
            trailing={
              <Link href="#all-deals" className="font-semibold text-primary-700 hover:underline">
                Xem thêm →
              </Link>
            }
          />
          <ProductGrid products={topDeals} />
        </PageSection>
      ) : null}

      <PageSection padding="default" className="bg-canvas">
        <SectionHeading
          title="Khám phá theo danh mục"
          description="6 danh mục được săn nhiều nhất tuần này."
          trailing={
            niches.length > 6 ? (
              <Link href="#all-niches" className="font-semibold text-primary-700 hover:underline">
                Xem tất cả {niches.length} danh mục →
              </Link>
            ) : null
          }
        />
        <CuratedNicheGrid niches={curatedTiles} />
      </PageSection>

      {topProducts.length > 0 ? (
        <PageSection padding="default" className="bg-canvas">
          <SectionHeading
            title="Đang hot tuần này"
            description="Top bán chạy từ Accesstrade, cập nhật hàng ngày."
            trailing={<>{topProducts.length} sản phẩm</>}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {topProducts.map((p) => (
              <TopProductCard key={p.id} product={p} />
            ))}
          </div>
        </PageSection>
      ) : null}

      {activeCoupons.length > 0 ? (
        <PageSection padding="default" id="coupons" className="bg-canvas">
          <SectionHeading
            title="Mã giảm giá nóng"
            description="Ưu tiên mã sắp hết hạn."
            trailing={
              <Link href="/khuyen-mai" className="font-semibold text-primary-700 hover:underline">
                Xem tất cả mã →
              </Link>
            }
          />
          <CouponPreview coupons={activeCoupons} />
        </PageSection>
      ) : null}

      {latestArticles.length > 0 ? (
        <PageSection padding="default" className="bg-canvas">
          <SectionHeading
            title="Cẩm nang chọn mua"
            description="Bài viết mới nhất từ team biên tập."
            trailing={
              <Link href="/blog" className="font-semibold text-primary-700 hover:underline">
                Xem tất cả cẩm nang →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </PageSection>
      ) : null}

      <div id="all-deals" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        {niches.length > 0 ? (
          <div
            id="all-niches"
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
                <Link href={buildHref({ category: activeSlug, sort, q: "" })} className="text-primary-700 hover:underline">
                  Xoá tìm kiếm
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {!loadError && sorted.length === 0 ? (
          <EmptyState
            tone="warning"
            title={query ? "Không có kết quả phù hợp" : "Đang cập nhật deal mới"}
            description={
              query ? (
                <p>Thử bỏ bớt từ khoá hoặc chọn danh mục khác.</p>
              ) : (
                <p>
                  Team dealvault đang đối chiếu deal mới từ các sàn. Vui lòng quay lại sau ít phút,
                  hoặc xem <Link href="/blog" className="font-medium text-primary-700 hover:underline">cẩm nang chọn mua</Link>.
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

      <PageSection padding="default" className="border-t border-line bg-canvas">
        <SectionHeading
          title="Vì sao chọn dealvault"
          description="Chúng tôi không bán hàng — chúng tôi đối chiếu giá để bạn ra quyết định nhanh."
          size="sm"
        />
        <TrustStrip />
      </PageSection>
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

function pickLatestProductUpdate(products: Array<{ updatedAt?: string }>): Date | null {
  let latest: Date | null = null;
  for (const p of products) {
    if (!p.updatedAt) continue;
    const d = new Date(p.updatedAt);
    if (!Number.isNaN(d.getTime()) && (!latest || d > latest)) latest = d;
  }
  return latest ?? (products.length > 0 ? new Date() : null);
}
