import type React from "react";
import { Star } from "lucide-react";
import { formatMoney, formatNumber, normalizeProduct } from "../../lib/format";
import type { ProductItem } from "../../lib/types";
import { AffiliateCta } from "./affiliate-cta";

interface Props {
  product: ProductItem;
  excerpt?: string | null;
}

/**
 * Card "Verdict" cho REVIEW: ảnh sản phẩm to + giá + rating + CTA + 1 dòng kết luận.
 * Đặt ngay trên đầu bài để user thấy gist trong 2 giây.
 */
export function VerdictCard({ product: raw, excerpt }: Props): React.ReactElement {
  const product = normalizeProduct(raw);
  const savings =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? product.originalPrice - product.price
      : undefined;

  return (
    <aside className="not-prose my-8 overflow-hidden rounded-3xl border border-line bg-card shadow-card">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,40%)_minmax(0,1fr)]">
        {/* Ảnh sản phẩm */}
        <div className="relative aspect-square overflow-hidden bg-canvas sm:aspect-auto">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-primary-50 to-accent-50 text-5xl font-bold text-primary-700">
              {product.brand?.[0] ?? <Star className="size-10 fill-current" aria-hidden />}
            </div>
          )}
          {product.discountPercent ? (
            <span className="absolute left-3 top-3 rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              -{product.discountPercent}%
            </span>
          ) : null}
        </div>

        {/* Verdict info */}
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <p className="text-micro font-semibold uppercase tracking-wider text-primary-700">
            Verdict — Đánh giá nhanh
          </p>
          {product.brand ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
              {product.brand}
            </p>
          ) : null}
          <h2 className="text-xl font-bold leading-tight tracking-tight text-ink sm:text-2xl">
            {product.name}
          </h2>

          {/* Rating */}
          {product.rating !== undefined ? (
            <div className="flex items-center gap-2 text-sm">
              <Stars rating={product.rating} />
              <span className="font-semibold text-ink">{product.rating.toFixed(1)}</span>
              {product.reviewCount ? (
                <span className="text-xs text-ink-mute">({formatNumber(product.reviewCount)} đánh giá)</span>
              ) : null}
            </div>
          ) : null}

          {/* Giá */}
          {product.price !== undefined ? (
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold text-primary-700">
                  {formatMoney(product.price, product.currency)}
                </span>
                {product.originalPrice && product.originalPrice > product.price ? (
                  <span className="text-sm text-ink-mute line-through">
                    {formatMoney(product.originalPrice, product.currency)}
                  </span>
                ) : null}
              </div>
              {savings ? (
                <p className="text-xs font-medium text-accent-700">
                  Tiết kiệm {formatMoney(savings, product.currency)} so với giá niêm yết
                </p>
              ) : null}
            </div>
          ) : null}

          {/* TL;DR */}
          {excerpt ? (
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm leading-6 text-ink-soft">
              <strong className="font-semibold text-ink">Có nên mua? </strong>
              {excerpt}
            </p>
          ) : null}

          {/* CTA */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <AffiliateCta
              productId={raw.id}
              affiliateUrl={raw.affiliateUrl}
              size="lg"
              label="Xem giá tại"
              store={product.store ?? "shop"}
            />
            <span className="text-xs text-ink-mute">
              Click → redirect tới shop · không trả thêm phí
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Stars({ rating }: { rating: number }): React.ReactElement {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="inline-flex items-center text-amber-500" aria-label={`${rating} sao`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < full;
        const isHalf = i === full && half;
        return (
          <svg key={i} viewBox="0 0 24 24" fill={filled || isHalf ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" className="size-4">
            {isHalf ? (
              <>
                <defs>
                  <linearGradient id={`half-${i}`}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <path fill={`url(#half-${i})`} d="M12 17.3 6.2 21l1.7-6.8L3 9.6l7-.5L12 2l2 7.1 7 .5-4.9 4.6L17.8 21z" />
                <path d="M12 17.3 6.2 21l1.7-6.8L3 9.6l7-.5L12 2l2 7.1 7 .5-4.9 4.6L17.8 21z" />
              </>
            ) : (
              <path d="M12 17.3 6.2 21l1.7-6.8L3 9.6l7-.5L12 2l2 7.1 7 .5-4.9 4.6L17.8 21z" />
            )}
          </svg>
        );
      })}
    </span>
  );
}
