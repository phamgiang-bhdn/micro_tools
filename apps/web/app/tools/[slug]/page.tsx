import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchToolBySlug } from "../../../lib/api";
import { normalizeProduct } from "../../../lib/format";
import { ProductCard } from "../../../components/product-card";
import { Breadcrumb } from "../../../components/ui/breadcrumb";
import { Badge } from "../../../components/ui/badge";
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
  if (!tool) {
    return {
      title: "Không tìm thấy micro-tool",
      robots: { index: false }
    };
  }
  const count = tool.products.length;
  const title = `${tool.name} — so sánh ${count} ưu đãi mới nhất`;
  const description = `So sánh ${count} sản phẩm thuộc ${tool.name}. Giá cập nhật, link affiliate có tracking, gợi ý chọn deal tốt nhất.`;
  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/tools/${tool.slug}`
    }
  };
}

export default async function ToolDetailPage({ params }: ToolPageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const tool = await fetchToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const products = tool.products.map(normalizeProduct);
  const withPrice = products.filter((p) => p.price !== undefined);
  const minPrice = withPrice.length > 0 ? Math.min(...withPrice.map((p) => p.price as number)) : null;
  const maxDiscount = products.reduce((m, p) => Math.max(m, p.discountPercent ?? 0), 0);

  return (
    <div className="space-y-10">
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Micro-tools", href: "/#tools" },
          { label: tool.name }
        ]}
      />

      <section className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-card sm:p-10">
        <div className="absolute inset-0 bg-hero-mesh opacity-60" aria-hidden />
        <div className="relative">
          <Badge tone="brand">Micro-tool · {tool.products.length} sản phẩm</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{tool.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-soft sm:text-base">
            Bảng so sánh được cập nhật tự động từ các đối tác affiliate. Click vào sản phẩm để xem chi tiết và đi tới
            link mua hàng có tracking.
          </p>
          <dl className="mt-6 grid max-w-md grid-cols-3 gap-4">
            <Stat label="Sản phẩm" value={String(tool.products.length)} />
            <Stat
              label="Giá thấp nhất"
              value={minPrice !== null ? new Intl.NumberFormat("vi-VN").format(minPrice) + "₫" : "—"}
            />
            <Stat label="Giảm tối đa" value={maxDiscount > 0 ? `-${maxDiscount}%` : "—"} />
          </dl>
        </div>
      </section>

      {products.length === 0 ? (
        <EmptyState
          title="Chưa có sản phẩm nào"
          description="Tool đã ACTIVE nhưng chưa có dữ liệu — hãy chạy crawl hoặc seed."
        />
      ) : (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} toolSlug={tool.slug} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}
