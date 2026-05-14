import type React from "react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { formatMoney, formatNumber } from "../lib/format";
import type { ProductView } from "../lib/types";

interface ProductCardProps {
  product: ProductView;
  toolSlug: string;
}

export function ProductCard({ product, toolSlug }: ProductCardProps): React.ReactElement {
  const detailHref = `/tools/${toolSlug}/${product.id}`;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-card-md">
      <Link href={detailHref} className="relative block aspect-[4/3] overflow-hidden bg-canvas">
        <ProductImage product={product} />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.discountPercent && product.discountPercent > 0 ? (
            <Badge tone="brand" size="md">
              -{product.discountPercent}%
            </Badge>
          ) : null}
          {product.badge ? (
            <Badge tone="ink" size="md">
              {product.badge}
            </Badge>
          ) : null}
        </div>
        {product.store ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-card backdrop-blur">
            {product.store}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={detailHref} className="line-clamp-2 text-sm font-semibold text-ink hover:text-brand-700 sm:text-base">
          {product.name}
        </Link>

        {product.brand ? <p className="mt-1 text-xs text-ink-mute">{product.brand}</p> : null}

        {product.rating !== undefined ? (
          <div className="mt-2 flex items-center gap-1 text-xs text-ink-soft">
            <RatingStars value={product.rating} />
            <span className="font-medium text-ink">{product.rating.toFixed(1)}</span>
            {product.reviewCount ? <span className="text-ink-mute">({formatNumber(product.reviewCount)})</span> : null}
          </div>
        ) : null}

        <div className="mt-auto pt-3">
          <PriceBlock product={product} />
          <Button asChild variant="brand" size="md" className="mt-3 w-full">
            <Link href={detailHref}>Xem deal</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProductImage({ product }: { product: ProductView }): React.ReactElement {
  if (product.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.image}
        alt={product.name}
        className="size-full object-cover transition duration-500 group-hover:scale-105"
        loading="lazy"
      />
    );
  }
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 text-3xl font-bold text-brand-700">
      {initials || "★"}
    </div>
  );
}

function PriceBlock({ product }: { product: ProductView }): React.ReactElement {
  if (product.price === undefined) {
    return <p className="text-sm font-medium text-ink-soft">Liên hệ đối tác</p>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-lg font-bold text-brand-700 sm:text-xl">
        {formatMoney(product.price, product.currency)}
      </span>
      {product.originalPrice && product.originalPrice > product.price ? (
        <span className="text-xs text-ink-mute line-through">
          {formatMoney(product.originalPrice, product.currency)}
        </span>
      ) : null}
    </div>
  );
}

function RatingStars({ value }: { value: number }): React.ReactElement {
  const full = Math.round(value);
  return (
    <span aria-hidden className="text-amber-500">
      {"★".repeat(full)}
      <span className="text-line">{"★".repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}
