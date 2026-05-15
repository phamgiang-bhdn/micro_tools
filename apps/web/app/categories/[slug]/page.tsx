import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchToolBySlug, fetchTools } from "../../../lib/api";
import { formatMoney, formatNumber, normalizeProduct } from "../../../lib/format";
import { ProductCard } from "../../../components/product-card";
import { Breadcrumb } from "../../../components/ui/breadcrumb";
import { EmptyState } from "../../../components/ui/empty-state";

export const revalidate = 300;

interface ToolPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await fetchToolBySlug(slug);
  if (!tool) return { title: "Không tìm thấy", robots: { index: false } };
  const count = tool.products.length;
  const title = `${tool.name} — ${count} ưu đãi`;
  const description = `So sánh ${count} sản phẩm thuộc ${tool.name}. Giá cập nhật, chọn deal tốt nhất.`;
  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title, description, type: "website", url: `/tools/${tool.slug}` }
  };
}

export default async function ToolDetailPage({ params }: ToolPageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const [tool, toolsList] = await Promise.all([fetchToolBySlug(slug), fetchTools()]);
  if (!tool) notFound();

  const products = tool.products
    .map(normalizeProduct)
    .map((p, idx) => ({ ...p, slug: tool.products[idx].slug ?? undefined }))
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));

  const totalSavings = products.reduce((sum, p) => {
    if (p.originalPrice && p.price && p.originalPrice > p.price) return sum + (p.originalPrice - p.price);
    return sum;
  }, 0);
  const maxDiscount = products[0]?.discountPercent ?? 0;
  const otherTools = (toolsList.tools ?? []).filter((t) => t.slug !== tool.slug).slice(0, 6);

  return (
    <div>
      {/* HERO — category */}
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div aria-hidden className="absolute inset-0 bg-hero-mesh opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: tool.name }]} />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Danh mục</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{tool.name}</h1>
              <p className="mt-2 max-w-xl text-sm text-ink-soft">
                {products.length} sản phẩm đang có ưu đãi. Đã sắp xếp theo mức giảm cao nhất.
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-right sm:gap-3">
              <Stat label="Sản phẩm" value={formatNumber(products.length)} />
              <Stat
                label="Giảm sâu"
                value={maxDiscount ? `-${maxDiscount}%` : "—"}
                tone="brand"
              />
              <Stat
                label="Tiết kiệm"
                value={totalSavings > 0 ? formatMoney(totalSavings) : "—"}
                tone="accent"
              />
            </dl>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {products.length === 0 ? (
          <EmptyState title="Chưa có sản phẩm" description={<p>Quay lại sau để xem ưu đãi mới.</p>} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product, idx) => (
              <div
                key={product.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
              >
                <ProductCard product={product} toolSlug={tool.slug} />
              </div>
            ))}
          </div>
        )}

        {otherTools.length > 0 ? (
          <section className="mt-12 border-t border-line pt-8">
            <h2 className="text-lg font-semibold text-ink">Khám phá danh mục khác</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {otherTools.map((t) => (
                <Link
                  key={t.id}
                  href={`/tools/${t.slug}`}
                  className="group rounded-xl border border-line bg-card px-3 py-3 text-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                >
                  <p className="font-medium text-ink group-hover:text-brand-700">{t.name}</p>
                  <p className="mt-0.5 text-xs text-ink-mute">{t._count?.products ?? 0} sản phẩm</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "brand" | "accent";
}): React.ReactElement {
  const toneClass =
    tone === "brand" ? "text-brand-700" : tone === "accent" ? "text-accent-700" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-card/70 px-3 py-2 text-left backdrop-blur">
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className={`text-base font-bold ${toneClass}`}>{value}</dd>
    </div>
  );
}
