import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCategoryBySlug, fetchCategories } from "../../../lib/api";
import { formatMoney, formatNumber, normalizeProduct } from "../../../lib/format";
import { ProductGrid } from "../../../components/storefront/product-grid";
import { Breadcrumb } from "../../../components/ui/breadcrumb";
import { EmptyState } from "../../../components/ui/empty-state";
import { PageContainer, PageSection, SectionHeading } from "../../../components/ui/section";
import { Stat, StatGrid } from "../../../components/ui/stat";

export const revalidate = 300;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategoryBySlug(slug);
  if (!category) return { title: "Không tìm thấy", robots: { index: false } };
  const count = category.products.length;
  const title = `${category.name} — ${count} ưu đãi`;
  const description = `So sánh ${count} sản phẩm thuộc ${category.name}. Giá cập nhật, chọn deal tốt nhất.`;
  return {
    title,
    description,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: { title, description, type: "website", url: `/categories/${category.slug}` }
  };
}

export default async function CategoryDetailPage({ params }: CategoryPageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const [category, categoriesList] = await Promise.all([fetchCategoryBySlug(slug), fetchCategories()]);
  if (!category) notFound();

  const products = category.products
    .map((p, idx) => ({ ...normalizeProduct(p), slug: category.products[idx].slug ?? undefined, categorySlug: category.slug }))
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));

  const totalSavings = products.reduce((sum, p) => {
    if (p.originalPrice && p.price && p.originalPrice > p.price) return sum + (p.originalPrice - p.price);
    return sum;
  }, 0);
  const maxDiscount = products[0]?.discountPercent ?? 0;
  const otherCategories = (categoriesList.categories ?? []).filter((c) => c.slug !== category.slug).slice(0, 6);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div aria-hidden className="absolute inset-0 bg-hero-mesh opacity-70" />
        <PageContainer className="relative py-8 sm:py-10">
          <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: category.name }]} />
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Danh mục</p>
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{category.name}</h1>
              <p className="text-sm text-ink-soft">
                {products.length > 0
                  ? `${products.length} sản phẩm đang có ưu đãi, đã sắp theo mức giảm cao nhất.`
                  : "Chưa có sản phẩm nào trong danh mục này."}
              </p>
            </div>
            <StatGrid cols={3} className="sm:w-auto">
              <Stat label="Sản phẩm" value={formatNumber(products.length)} size="sm" />
              <Stat label="Giảm sâu" value={maxDiscount ? `-${maxDiscount}%` : "—"} tone="brand" size="sm" />
              <Stat label="Tiết kiệm" value={totalSavings > 0 ? formatMoney(totalSavings) : "—"} tone="accent" size="sm" />
            </StatGrid>
          </div>
        </PageContainer>
      </section>

      <PageSection padding="default">
        {products.length === 0 ? (
          <EmptyState title="Chưa có sản phẩm" description={<p>Quay lại sau để xem ưu đãi mới.</p>} />
        ) : (
          <ProductGrid products={products} />
        )}

        {otherCategories.length > 0 ? (
          <section className="mt-12 border-t border-line pt-8">
            <SectionHeading
              title="Khám phá danh mục khác"
              description="Xem những niche khác cũng đang có ưu đãi tốt."
              size="sm"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {otherCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  className="group rounded-xl border border-line bg-card px-3 py-3 text-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                >
                  <p className="font-medium text-ink group-hover:text-brand-700">{c.name}</p>
                  <p className="mt-0.5 text-xs text-ink-mute">{c._count?.products ?? 0} sản phẩm</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </PageSection>
    </div>
  );
}
