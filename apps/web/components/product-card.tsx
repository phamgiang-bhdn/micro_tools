import type React from "react";
import Link from "next/link";
import { formatMoney } from "../lib/format";
import { slugify } from "../lib/slug";
import type { ProductView } from "../lib/types";

interface ProductCardProps {
  product: ProductView & { slug?: string | null };
  toolSlug: string;
}

export function ProductCard({ product, toolSlug }: ProductCardProps): React.ReactElement {
  // Ưu tiên slug; fallback id để vẫn link được nếu DB chưa có slug (legacy data).
  const key = product.slug && product.slug.length > 0 ? product.slug : slugify(product.name) || product.id;
  const detailHref = `/tools/${toolSlug}/${key}`;
  return (
    <Link
      href={detailHref}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-card-md"
    >
      <div className="relative aspect-square overflow-hidden bg-canvas">
        <ProductImage product={product} />
        {product.discountPercent && product.discountPercent > 0 ? (
          <span className="absolute left-2 top-2 rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            -{product.discountPercent}%
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm text-ink group-hover:text-brand-700">{product.name}</p>
        <PriceBlock product={product} />
        {product.store ? <p className="text-[11px] text-ink-mute">{product.store}</p> : null}
      </div>
    </Link>
  );
}

function ProductImage({ product }: { product: ProductView }): React.ReactElement {
  if (product.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.image}
        alt={product.name}
        width={400}
        height={400}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition duration-500 group-hover:scale-105"
      />
    );
  }
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 text-2xl font-bold text-brand-700">
      {initials || "★"}
    </div>
  );
}

function PriceBlock({ product }: { product: ProductView }): React.ReactElement {
  if (product.price === undefined) {
    return <p className="text-sm font-medium text-ink-soft">Liên hệ shop</p>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="text-sm font-bold text-brand-700 sm:text-base">
        {formatMoney(product.price, product.currency)}
      </span>
      {product.originalPrice && product.originalPrice > product.price ? (
        <span className="text-[11px] text-ink-mute line-through">
          {formatMoney(product.originalPrice, product.currency)}
        </span>
      ) : null}
    </div>
  );
}
