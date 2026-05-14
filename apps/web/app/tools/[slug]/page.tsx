import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchToolBySlug } from "../../../lib/api";
import { normalizeProduct } from "../../../lib/format";
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
  const tool = await fetchToolBySlug(slug);
  if (!tool) notFound();

  const products = tool.products.map(normalizeProduct).sort(
    (a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0)
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: tool.name }]} />

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{tool.name}</h1>
        <p className="text-sm text-ink-soft">{tool.products.length} sản phẩm đang có</p>
      </header>

      {products.length === 0 ? (
        <EmptyState title="Chưa có sản phẩm" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} toolSlug={tool.slug} />
          ))}
        </div>
      )}
    </div>
  );
}
