import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchNicheBySlug } from "../../../../lib/api";
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
  const niche = await fetchNicheBySlug(slug);
  const product = niche ? findProduct(niche.products, productSlug) : undefined;
  if (!niche || !product) {
    return { title: "Không tìm thấy", robots: { index: false } };
  }
  const view = normalizeProduct(product);
  const priceText = view.price ? ` — ${formatMoney(view.price, view.currency)}` : "";
  const title = `${product.name}${priceText} | ${niche.name}`;
  const description = view.description ?? `Xem giá và mua ${product.name} thuộc ${niche.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `/categories/${slug}/${product.slug ?? slugify(product.name)}` },
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
  const niche = await fetchNicheBySlug(slug);
  const productRaw = niche ? findProduct(niche.products, productSlug) : undefined;

  if (!niche || !productRaw) {
    notFound();
  }

  // Sản phẩm liên quan cùng niche (top 6 theo discount), loại bỏ chính nó
  const related = niche.products
    .filter((p) => p.id !== productRaw.id)
    .map((p) => ({ raw: p, view: normalizeProduct(p) }))
    .sort((a, b) => (b.view.discountPercent ?? 0) - (a.view.discountPercent ?? 0))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <ProductDetailView
        productRaw={productRaw}
        niche={{ name: niche.name, slug: niche.slug }}
        related={related.map(({ raw, view }) => ({
          id: raw.id,
          slug: raw.slug ?? null,
          name: raw.name,
          image: view.image,
          price: view.price,
          originalPrice: view.originalPrice,
          currency: view.currency,
          discountPercent: view.discountPercent,
          store: view.store
        }))}
      />
    </div>
  );
}
