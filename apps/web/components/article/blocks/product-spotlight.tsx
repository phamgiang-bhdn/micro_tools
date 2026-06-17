import type React from "react";
import { formatMoney, normalizeProduct } from "../../../lib/format";
import type { ProductItem } from "../../../lib/types";
import { AffiliateCta } from "../affiliate-cta";

interface Props {
  product: ProductItem;
  angle: string;
  pros?: string[];
  cons?: string[];
  /** AI-suggested image (đã pass HEAD validate). Nếu không có → fallback ảnh sản phẩm. */
  imageUrl?: string;
}

export function ProductSpotlightBlock({
  product: raw,
  angle,
  pros,
  cons,
  imageUrl
}: Props): React.ReactElement {
  const product = normalizeProduct(raw);
  const heroImage = imageUrl ?? product.image;
  const savings =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? product.originalPrice - product.price
      : undefined;

  return (
    <aside className="overflow-hidden rounded-3xl border border-line bg-card shadow-card">
      <div className="grid gap-0 md:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
        <div className="relative aspect-square bg-canvas md:aspect-auto">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt={product.name} loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-primary-50 to-accent-50 text-5xl font-bold text-primary-700">
              {product.brand?.[0] ?? "★"}
            </div>
          )}
          {product.discountPercent ? (
            <span className="absolute left-3 top-3 rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              -{product.discountPercent}%
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-700">Spotlight</p>
            <p className="mt-1 text-sm font-medium text-ink-soft">{angle}</p>
          </div>

          {product.brand ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">{product.brand}</p>
          ) : null}
          <h3 className="-mt-2 text-xl font-bold leading-tight tracking-tight text-ink sm:text-2xl">
            {product.name}
          </h3>

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
                  Tiết kiệm {formatMoney(savings, product.currency)}
                </p>
              ) : null}
            </div>
          ) : null}

          {(pros?.length || cons?.length) ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {pros?.length ? (
                <div className="rounded-xl bg-emerald-50/60 p-3 ring-1 ring-inset ring-emerald-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    Điểm mạnh
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {pros.map((p, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-emerald-900">
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-600" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {cons?.length ? (
                <div className="rounded-xl bg-rose-50/60 p-3 ring-1 ring-inset ring-rose-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                    Điểm yếu
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {cons.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-rose-900">
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3">
            <AffiliateCta
              productId={raw.id}
              affiliateUrl={raw.affiliateUrl}
              size="lg"
              label="Xem giá hôm nay"
              store={product.store}
            />
            <span className="text-xs text-ink-mute">Click → tracking · không phí</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
