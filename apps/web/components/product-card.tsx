import type React from "react";
import Link from "next/link";
import { ShoppingCart, Package } from "lucide-react";
import { formatMoney, formatSocialProof } from "../lib/format";
import { slugify } from "../lib/slug";
import { trackAndRedirectAction } from "../app/actions/tracking";
import type { ProductView } from "../lib/types";
import { StoreTierBadge } from "./storefront/store-tier-badge";
import { DealVerdictBadge } from "./storefront/deal-verdict-badge";

interface ProductCardProps {
  product: ProductView & { slug?: string | null };
  nicheSlug: string;
  /** Compact = card nhỏ cho carousel/strip — ẩn social proof + inline CTA, click toàn card. */
  compact?: boolean;
}

/**
 * Card sản phẩm v3 ("sàn deal năng động" — declutter 2026):
 * - 1 hairline ring thay vì border+shadow+lift chồng nhau (bỏ cảm giác cũ/nặng).
 * - 1 tag giảm giá đỏ nổi bật (bỏ pill "Hot" đen + flame trùng lặp).
 * - Verdict giá (đáy/giá tốt/ảo) là tín hiệu trust chính; social proof gọn 1 dòng.
 * - CTA amber đậm full-width. Không emoji, không glow.
 */
export function ProductCard({ product, nicheSlug, compact = false }: ProductCardProps): React.ReactElement {
  const key = product.slug && product.slug.length > 0 ? product.slug : slugify(product.name) || product.id;
  const detailHref = `/categories/${nicheSlug}/${key}`;
  const discountPct = product.discountPercent ?? 0;
  const social = formatSocialProof(product.rating, product.salesCount);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card-md">
      <Link
        href={detailHref}
        className="relative block aspect-square overflow-hidden bg-canvas ring-focus"
        aria-label={product.name}
      >
        <ProductImage product={product} />

        {discountPct > 0 ? (
          <span className="absolute left-2 top-2 rounded-lg bg-danger px-2 py-0.5 text-caption font-bold text-white shadow-sm">
            -{discountPct}%
          </span>
        ) : null}

        <StoreTierBadge store={product.store} position="absolute" size={compact ? "xs" : "sm"} />
      </Link>

      <div className={`flex flex-1 flex-col ${compact ? "gap-1 p-2.5" : "gap-2 p-3"}`}>
        <Link href={detailHref} className="flex flex-col gap-1.5 ring-focus">
          {!compact && product.brand ? (
            <p className="line-clamp-1 text-micro font-semibold uppercase tracking-wider text-ink-mute">
              {product.brand}
            </p>
          ) : null}
          <p
            className={`min-h-[2.5em] text-body-sm font-medium leading-snug text-ink transition group-hover:text-primary-700 ${
              compact ? "line-clamp-1" : "line-clamp-2"
            }`}
          >
            {product.name}
          </p>

          <PriceBlock product={product} compact={compact} />

          {!compact ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <DealVerdictBadge intel={product.priceIntel} />
              {social ? <span className="text-micro font-medium text-ink-mute">{social}</span> : null}
            </div>
          ) : null}
        </Link>

        {!compact ? <OutboundButton product={product} detailHref={detailHref} /> : null}
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
        width={400}
        height={400}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
      />
    );
  }
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 text-2xl font-bold text-primary-700">
      {initials || <Package className="size-7" aria-hidden />}
    </div>
  );
}

function PriceBlock({ product, compact }: { product: ProductView; compact?: boolean }): React.ReactElement {
  if (product.price === undefined) {
    return <p className="text-sm font-medium text-ink-soft">Liên hệ shop</p>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
      <span className={`font-bold text-ink ${compact ? "text-sm" : "text-body-lg sm:text-lg"}`}>
        {formatMoney(product.price, product.currency)}
      </span>
      {product.originalPrice && product.originalPrice > product.price ? (
        <span className="text-micro text-ink-mute line-through">
          {formatMoney(product.originalPrice, product.currency)}
        </span>
      ) : null}
    </div>
  );
}

function OutboundButton({ product, detailHref }: { product: ProductView; detailHref: string }): React.ReactElement {
  const affiliateUrl = product.affiliateUrl ?? "";

  if (!affiliateUrl) {
    return (
      <Link
        href={detailHref}
        className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-body-sm font-semibold text-ink-soft transition hover:text-primary-700 ring-focus"
        aria-label={`Xem chi tiết ${product.name}`}
      >
        Liên hệ shop
      </Link>
    );
  }

  return (
    <form action={trackAndRedirectAction} className="mt-auto w-full pt-0.5">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="affiliateUrl" value={affiliateUrl} />
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cta-500 px-3 py-2.5 text-body-sm font-semibold text-ink transition hover:bg-cta-400 ring-focus"
      >
        <ShoppingCart className="size-3.5" /> Xem deal
      </button>
    </form>
  );
}
