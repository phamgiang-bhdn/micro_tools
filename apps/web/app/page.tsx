import type React from "react";
import Link from "next/link";
import { fetchAllProductsFlat, fetchNiches } from "../lib/api";
import { EmptyState } from "../components/ui/empty-state";
import { PageSection, SectionHeading } from "../components/ui/section";
import { FilterChip, FilterChipRow } from "../components/ui/filter-chip";
import { ProductGrid } from "../components/storefront/product-grid";
import { SortControl } from "../components/storefront/sort-control";
import { AiAssistant } from "../components/storefront/ai-assistant";
import { CuratedNicheGrid } from "../components/storefront/curated-niche-grid";
import { buildCuratedTiles } from "../lib/curated-niches";

export const revalidate = 300;

interface HomeProps {
  searchParams: Promise<{ category?: string; sort?: string; q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps): Promise<React.ReactElement> {
  const { category: activeSlug, sort = "top", q = "" } = await searchParams;
  const { niches, loadError: nichesError } = await fetchNiches();
  const productsResult = nichesError ? { products: [], loadError: null } : await fetchAllProductsFlat(niches);
  const allProducts = productsResult.products;
  // STORY 1-4: home cũng phân biệt lỗi-tải với rỗng — niches lỗi, HOẶC niches OK nhưng toàn bộ
  // product fetch fail (allProducts rỗng + productsResult.loadError). Tránh hiện "đang cập nhật"
  // khi thực ra backend product đang sập.
  const loadError = nichesError ?? (allProducts.length === 0 ? productsResult.loadError : null);

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

  const curatedTiles = buildCuratedTiles(niches);

  const activeNiche = activeSlug ? niches.find((c) => c.slug === activeSlug) : undefined;
  const listingTitle = activeNiche?.name ?? (query ? "Kết quả tìm kiếm" : "Tất cả deal");
  const listingDescription = activeNiche
    ? `${sorted.length} sản phẩm thuộc ${activeNiche.name}, sắp theo mức giảm cao nhất.`
    : query
      ? `${sorted.length} sản phẩm khớp từ khoá của bạn.`
      : `Lọc theo danh mục bên dưới để xem deal cụ thể.`;

  return (
    <div>
      <AiAssistant />

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

      <PageSection padding="default" width="wide" className="bg-canvas">
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

      <div id="all-deals" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
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
