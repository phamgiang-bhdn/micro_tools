import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchArticles,
  fetchNicheBySlug,
  fetchNicheFaqFromArticle,
  fetchNiches
} from "../../../lib/api";
import { formatMoney, formatNumber, normalizeProduct } from "../../../lib/format";
import {
  buildNicheMetaDescription,
  buildNicheMetaTitle,
  buildNicheTitle
} from "../../../lib/niche-seo";
import { ProductGrid } from "../../../components/storefront/product-grid";
import { Breadcrumb } from "../../../components/ui/breadcrumb";
import { EmptyState } from "../../../components/ui/empty-state";
import { PageContainer, PageSection, SectionHeading } from "../../../components/ui/section";
import { Stat, StatGrid } from "../../../components/ui/stat";
import { NicheIntro } from "../../../components/storefront/niche-intro";
import { NicheComparisonTable } from "../../../components/storefront/niche-comparison-table";
import {
  NicheFilterBar,
  DEFAULT_PRICE_TIERS,
  applyNicheFilters
} from "../../../components/storefront/niche-filter-bar";
import { NicheFaq } from "../../../components/storefront/niche-faq";
import { CuratedNicheGrid } from "../../../components/storefront/curated-niche-grid";
import { ArticleCard } from "../../../components/storefront/article-card";
import { CURATED_NICHES } from "../../../lib/curated-niches";

export const revalidate = 300;

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3100";

interface NichePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ price?: string; store?: string; sort?: string }>;
}

export async function generateMetadata({ params }: NichePageProps): Promise<Metadata> {
  const { slug } = await params;
  const niche = await fetchNicheBySlug(slug);
  if (!niche) return { title: "Không tìm thấy", robots: { index: false } };
  const count = niche.products.length;
  const products = niche.products.map((p) => normalizeProduct(p));
  const topDiscount = products.reduce((m, p) => Math.max(m, p.discountPercent ?? 0), 0);
  const title = buildNicheMetaTitle(niche, count);
  const description = buildNicheMetaDescription(niche, count, topDiscount);
  return {
    title,
    description,
    alternates: { canonical: `/categories/${niche.slug}` },
    openGraph: { title, description, type: "website", url: `/categories/${niche.slug}` }
  };
}

export default async function NicheDetailPage({
  params,
  searchParams
}: NichePageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const { price, store, sort = "top" } = await searchParams;
  const [niche, nichesList, articles, faqItems] = await Promise.all([
    fetchNicheBySlug(slug),
    fetchNiches(),
    fetchArticles({ nicheSlug: slug, limit: 3 }),
    fetchNicheFaqFromArticle(slug)
  ]);
  if (!niche) notFound();

  const productsAll = niche.products.map((p, idx) => ({
    ...normalizeProduct(p),
    slug: niche.products[idx].slug ?? undefined,
    nicheSlug: niche.slug
  }));

  const filtered = applyNicheFilters(productsAll, { price, store });
  const sorted = sortProducts(filtered, sort);

  const totalSavings = sorted.reduce((sum, p) => {
    if (p.originalPrice && p.price && p.originalPrice > p.price) return sum + (p.originalPrice - p.price);
    return sum;
  }, 0);
  const maxDiscount = productsAll.reduce((m, p) => Math.max(m, p.discountPercent ?? 0), 0);
  const lastUpdatedAt = pickLatestUpdate(productsAll);

  // Distinct stores cho filter chip — chỉ giữ những store có ≥1 product.
  const storeOptions = Array.from(
    new Set(productsAll.map((p) => p.store).filter((s): s is string => Boolean(s)))
  ).sort((a, b) => a.localeCompare(b, "vi"));

  const h1 = buildNicheTitle(niche, productsAll.length);

  // Empty niche fallback: render curated grid của 6 niche đang có data, link sang chỗ khác.
  const curatedTiles = CURATED_NICHES.filter((c) => c.slug !== niche.slug).map((curated) => {
    const matched = (nichesList.niches ?? []).find((n) => n.slug === curated.slug);
    return { ...curated, productCount: matched?._count?.products ?? 0 };
  });

  const itemListLd = sorted.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: h1,
        itemListElement: sorted.slice(0, 10).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/categories/${niche.slug}/${p.slug ?? p.id}`,
          name: p.name
        }))
      }
    : null;

  const faqLd = faqItems.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a }
        }))
      }
    : null;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div aria-hidden className="absolute inset-0 bg-hero-mesh opacity-70" />
        <PageContainer className="relative py-8 sm:py-10">
          <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: niche.name }]} />
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Danh mục</p>
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{h1}</h1>
              <NicheIntro
                niche={niche}
                productCount={productsAll.length}
                lastUpdatedAt={lastUpdatedAt?.toISOString()}
                topDiscount={maxDiscount}
              />
            </div>
            {productsAll.length > 0 ? (
              <StatGrid cols={3} className="sm:w-auto">
                <Stat label="Sản phẩm" value={formatNumber(productsAll.length)} size="sm" />
                <Stat label="Giảm sâu" value={maxDiscount ? `-${maxDiscount}%` : "—"} tone="brand" size="sm" />
                <Stat label="Tiết kiệm" value={totalSavings > 0 ? formatMoney(totalSavings) : "—"} tone="accent" size="sm" />
              </StatGrid>
            ) : null}
          </div>
        </PageContainer>
      </section>

      {productsAll.length === 0 ? (
        <PageSection padding="default">
          <EmptyState
            tone="warning"
            title={`${niche.name} đang được cập nhật`}
            description={
              <p>
                Trong lúc đợi, xem các danh mục đang có nhiều deal tốt bên dưới — hoặc đọc{" "}
                <Link href="/blog" className="font-medium text-brand-700 hover:underline">cẩm nang chọn mua</Link>.
              </p>
            }
          />
          <div className="mt-8">
            <SectionHeading title="Khám phá danh mục khác" size="sm" />
            <CuratedNicheGrid niches={curatedTiles} />
          </div>
        </PageSection>
      ) : (
        <>
          <PageSection padding="default" className="bg-canvas">
            <SectionHeading
              title="Bảng so sánh nhanh"
              description="5 sản phẩm giảm sâu nhất — đối chiếu spec chính trước khi click."
              size="sm"
            />
            <NicheComparisonTable
              products={sorted}
              schemaConfig={niche.schemaConfig}
              maxRows={5}
            />
          </PageSection>

          <PageSection padding="default">
            <SectionHeading title="Lọc & sắp xếp" size="sm" />
            <NicheFilterBar
              nicheSlug={niche.slug}
              activePrice={price}
              activeStore={store}
              sort={sort}
              storeOptions={storeOptions}
              priceTiers={DEFAULT_PRICE_TIERS}
            />

            <div className="mt-6">
              <SectionHeading
                title={`Tất cả ${niche.name.toLowerCase()}`}
                description={
                  sorted.length === productsAll.length
                    ? `${sorted.length} sản phẩm, sắp theo mức giảm cao nhất.`
                    : `${sorted.length}/${productsAll.length} sản phẩm khớp bộ lọc.`
                }
                trailing={<>{sorted.length} sản phẩm</>}
                size="sm"
              />
              {sorted.length === 0 ? (
                <EmptyState
                  tone="warning"
                  title="Không có sản phẩm khớp bộ lọc"
                  description={
                    <p>
                      Thử bỏ bớt điều kiện hoặc{" "}
                      <Link href={`/categories/${niche.slug}`} className="font-medium text-brand-700 hover:underline">
                        xem tất cả
                      </Link>{" "}
                      sản phẩm.
                    </p>
                  }
                />
              ) : (
                <ProductGrid products={sorted} />
              )}
            </div>
          </PageSection>
        </>
      )}

      {faqItems.length > 0 ? (
        <PageSection padding="default" className="bg-canvas">
          <SectionHeading
            title={`Câu hỏi thường gặp về ${niche.name.toLowerCase()}`}
            description="Trích từ cẩm nang chọn mua mới nhất do team biên tập viết."
            size="sm"
          />
          <NicheFaq items={faqItems} />
        </PageSection>
      ) : null}

      {articles.length > 0 ? (
        <PageSection padding="default">
          <SectionHeading
            title="Đọc thêm trước khi mua"
            description={`Cẩm nang & review về ${niche.name.toLowerCase()}.`}
            size="sm"
            trailing={
              <Link href={`/blog?category=${niche.slug}`} className="font-semibold text-brand-700 hover:underline">
                Xem tất cả →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </PageSection>
      ) : null}

      {itemListLd ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      ) : null}
      {faqLd ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      ) : null}
    </div>
  );
}

function sortProducts<T extends { discountPercent?: number; price?: number; name: string; updatedAt?: string }>(
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
      return copy.sort((a, b) => {
        const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return ub - ua;
      });
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    case "top":
    default:
      return copy.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
  }
}

function pickLatestUpdate(products: Array<{ updatedAt?: string }>): Date | null {
  let latest: Date | null = null;
  for (const p of products) {
    if (!p.updatedAt) continue;
    const d = new Date(p.updatedAt);
    if (!Number.isNaN(d.getTime()) && (!latest || d > latest)) latest = d;
  }
  return latest;
}
