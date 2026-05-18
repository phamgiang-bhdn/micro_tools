import type React from "react";
import Link from "next/link";
import { formatMoney, formatNumber } from "../lib/format";
import { slugify } from "../lib/slug";
import type { ProductView } from "../lib/types";

interface ProductCardProps {
  product: ProductView & { slug?: string | null };
  nicheSlug: string;
  /** Hiển thị compact (cho strip ngang trên hero). */
  compact?: boolean;
}

/**
 * Card sản phẩm:
 * - Nhấn vào discount % + savings amount để mua hàng cảm thấy "có lời".
 * - Badge urgency khi discount cao (≥30%).
 * - Hover lift + image zoom mượt để cảm giác tương tác cao cấp.
 */
export function ProductCard({ product, nicheSlug, compact = false }: ProductCardProps): React.ReactElement {
  const key = product.slug && product.slug.length > 0 ? product.slug : slugify(product.name) || product.id;
  const detailHref = `/categories/${nicheSlug}/${key}`;
  const savings =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? product.originalPrice - product.price
      : undefined;
  const hot = (product.discountPercent ?? 0) >= 30;

  return (
    <Link
      href={detailHref}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-pop"
    >
      <div className="relative aspect-square overflow-hidden bg-canvas">
        <ProductImage product={product} />

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.discountPercent && product.discountPercent > 0 ? (
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold text-white shadow-sm ${
                hot ? "bg-brand-gradient" : "bg-brand-600"
              }`}
            >
              -{product.discountPercent}%
            </span>
          ) : null}
          {hot ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              <FlameIcon /> Hot
            </span>
          ) : null}
        </div>

        {product.badge ? (
          <span className="absolute right-2 top-2 max-w-[55%] truncate rounded-md bg-ink/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {product.badge}
          </span>
        ) : null}

        {/* Gradient nhẹ ở chân ảnh để chữ phía dưới đỡ chói khi background sáng */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/5 to-transparent" />
      </div>

      <div className={`flex flex-1 flex-col gap-1.5 ${compact ? "p-2.5" : "p-3"}`}>
        {product.brand ? (
          <p className="line-clamp-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-mute">
            {product.brand}
          </p>
        ) : null}
        <p className="line-clamp-2 min-h-[2.6em] text-sm font-medium text-ink transition group-hover:text-brand-700">
          {product.name}
        </p>
        <PriceBlock product={product} savings={savings} />
        <Meta product={product} />
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
        className="size-full object-cover transition duration-500 group-hover:scale-110"
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

function PriceBlock({
  product,
  savings
}: {
  product: ProductView;
  savings?: number;
}): React.ReactElement {
  if (product.price === undefined) {
    return <p className="text-sm font-medium text-ink-soft">Liên hệ shop</p>;
  }
  return (
    <div className="space-y-0.5">
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
      {savings ? (
        <p className="text-[11px] font-medium text-accent-700">
          Tiết kiệm {formatMoney(savings, product.currency)}
        </p>
      ) : null}
    </div>
  );
}

function Meta({ product }: { product: ProductView }): React.ReactElement | null {
  const hasStore = Boolean(product.store);
  const hasRating = product.rating !== undefined;
  if (!hasStore && !hasRating) return null;
  return (
    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-ink-mute">
      {hasStore ? <span className="truncate">{product.store}</span> : <span />}
      {hasRating ? (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
          <span aria-hidden className="text-amber-500">★</span>
          {product.rating?.toFixed(1)}
          {product.reviewCount ? <span className="text-ink-mute">·{formatNumber(product.reviewCount)}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function FlameIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5">
      <path d="M12 2c.7 3.4-.6 5.9-2.6 7.7-2 1.9-3.4 4-3.4 6.7A6 6 0 0 0 12 22a6 6 0 0 0 6-5.6c0-3.3-2.4-4.7-2.4-7.2 0-1.2.5-2 .9-2.9-1.7.6-2.7 1.5-2.7 3.3 0 1 .4 1.7.4 2.6 0 1-.7 1.8-1.6 1.8-1 0-1.6-.9-1.6-2 0-3.2 3-4 1-10Z" />
    </svg>
  );
}
