import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchToolBySlug } from "../../../../lib/api";
import { formatMoney, normalizeProduct } from "../../../../lib/format";
import { slugify } from "../../../../lib/slug";
import { ProductDetailView } from "../../../../components/product-detail-view";
import type { ProductItem } from "../../../../lib/types";

export const revalidate = 300;

interface ProductPageProps {
  params: Promise<{
    slug: string;
    productSlug: string;
  }>;
}

/**
 * Tìm product theo slug (ưu tiên), fallback theo id (cho URL cũ trước khi có slug field).
 */
function findProduct(products: ProductItem[], key: string): ProductItem | undefined {
  return products.find((p) => p.slug === key) ?? products.find((p) => p.id === key);
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const tool = await fetchToolBySlug(slug);
  const product = tool ? findProduct(tool.products, productSlug) : undefined;
  if (!tool || !product) {
    return { title: "Không tìm thấy", robots: { index: false } };
  }
  const view = normalizeProduct(product);
  const priceText = view.price ? ` — ${formatMoney(view.price, view.currency)}` : "";
  const title = `${product.name}${priceText} | ${tool.name}`;
  const description = view.description ?? `Xem giá và mua ${product.name} thuộc ${tool.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `/tools/${slug}/${product.slug ?? slugify(product.name)}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: view.image ? [{ url: view.image }] : undefined
    }
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps): Promise<React.ReactElement> {
  const { slug, productSlug } = await params;
  const tool = await fetchToolBySlug(slug);
  const productRaw = tool ? findProduct(tool.products, productSlug) : undefined;

  if (!tool || !productRaw) {
    notFound();
  }

  return <ProductDetailView productRaw={productRaw} tool={{ name: tool.name, slug: tool.slug }} />;
}
