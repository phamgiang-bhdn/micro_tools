import type React from "react";
import Link from "next/link";
import { ShoppingCart, CheckCircle2, Flame } from "lucide-react";
import {
  formatMoney,
  formatShortDate,
  formatSocialProof,
  isVerifiedRecent
} from "../lib/format";
import { slugify } from "../lib/slug";
import { trackAndRedirectAction } from "../app/actions/tracking";
import type { ProductView } from "../lib/types";
import { StoreTierBadge } from "./storefront/store-tier-badge";

interface ProductCardProps {
  product: ProductView & { slug?: string | null };
  nicheSlug: string;
  /** Compact = card nhỏ cho carousel/strip — ẩn social proof, verified chip, inline CTA. */
  compact?: boolean;
}

/**
 * Card sản phẩm v2 (STORY-03): 1-click outbound qua form action + 4 trust signal.
 * - Outer wrapper là `<article>` (KHÔNG còn Link toàn card) — nested Link bọc image+meta,
 *   inline form bọc button "Xem deal ngay" → tránh nested form-in-link vi phạm HTML.
 * - 2 focus target khi tab: nested Link (detail page) + button (form submit → tracking → outbound).
 * - Compact mode dùng cho hero strip / carousel — ẩn proof/verified/CTA, click toàn card vào detail
 *   bằng cách overlay 1 link absolute (vẫn không có nested form).
 */
export function ProductCard({ product, nicheSlug, compact = false }: ProductCardProps): React.ReactElement {
  const key = product.slug && product.slug.length > 0 ? product.slug : slugify(product.name) || product.id;
  const detailHref = `/categories/${nicheSlug}/${key}`;
  const savings =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? product.originalPrice - product.price
      : undefined;
  const discountPct = product.discountPercent ?? 0;
  const isHot = discountPct >= 40;
  const social = formatSocialProof(product.rating, product.salesCount);
  const verifiedRecent = isVerifiedRecent(product.updatedAt);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-pop">
      {/* Image + badges. Nested Link làm primary tap target cho image. */}
      <Link
        href={detailHref}
        className="relative block aspect-square overflow-hidden bg-canvas ring-focus"
        aria-label={product.name}
      >
        <ProductImage product={product} />

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {discountPct > 0 ? <DiscountBadge percent={discountPct} /> : null}
          {isHot ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              <Flame className="size-2.5" /> Hot
            </span>
          ) : null}
        </div>

        <StoreTierBadge store={product.store} position="absolute" size={compact ? "xs" : "sm"} />

        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/5 to-transparent" />
      </Link>

      <div className={`flex flex-1 flex-col gap-1.5 ${compact ? "p-2.5" : "p-3"}`}>
        {/* Meta block — wrap trong Link để toàn vùng text dẫn về detail page. */}
        <Link
          href={detailHref}
          className="flex flex-col gap-1.5 ring-focus"
        >
          {!compact && product.brand ? (
            <p className="line-clamp-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-mute">
              {product.brand}
            </p>
          ) : null}
          <p
            className={`min-h-[2.6em] text-sm font-medium text-ink transition group-hover:text-brand-700 ${
              compact ? "line-clamp-1" : "line-clamp-2"
            }`}
          >
            {product.name}
          </p>

          {!compact && (social || verifiedRecent) ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-mute">
              {social ? <span className="font-medium text-ink-soft">{social}</span> : null}
              {social && verifiedRecent ? <span aria-hidden>·</span> : null}
              {verifiedRecent ? (
                <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700">
                  <CheckCircle2 className="size-3" /> Đối chiếu {formatShortDate(product.updatedAt)}
                </span>
              ) : null}
            </div>
          ) : null}

          <PriceBlock product={product} savings={savings} compact={compact} />
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

function DiscountBadge({ percent }: { percent: number }): React.ReactElement {
  // Tier theo % giảm: ≥50 đỏ + flame, ≥30 gradient, ≥15 brand. <15 caller đã hide.
  const tone =
    percent >= 50
      ? "bg-red-600 text-white"
      : percent >= 30
        ? "bg-brand-gradient text-white"
        : "bg-brand-600 text-white";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-bold shadow-sm ${tone}`}>
      {percent >= 50 ? <Flame className="size-2.5" /> : null}
      -{percent}%
    </span>
  );
}

function PriceBlock({
  product,
  savings,
  compact
}: {
  product: ProductView;
  savings?: number;
  compact?: boolean;
}): React.ReactElement {
  if (product.price === undefined) {
    return <p className="text-sm font-medium text-ink-soft">Liên hệ shop</p>;
  }
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className={`font-bold text-brand-700 ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
          {formatMoney(product.price, product.currency)}
        </span>
        {product.originalPrice && product.originalPrice > product.price ? (
          <span className="text-[11px] text-ink-mute line-through">
            {formatMoney(product.originalPrice, product.currency)}
          </span>
        ) : null}
      </div>
      {!compact && savings ? (
        <p className="text-[11px] font-medium text-accent-700">
          Tiết kiệm {formatMoney(savings, product.currency)}
        </p>
      ) : null}
    </div>
  );
}

function OutboundButton({ product, detailHref }: { product: ProductView; detailHref: string }): React.ReactElement {
  const affiliateUrl = product.affiliateUrl ?? "";

  if (!affiliateUrl) {
    // Affiliate link missing → fallback navigate detail page với button-style giữ height card consistent.
    return (
      <Link
        href={detailHref}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2.5 text-[13px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700 ring-focus"
        aria-label={`Xem chi tiết ${product.name}`}
      >
        Liên hệ shop
      </Link>
    );
  }

  return (
    <form action={trackAndRedirectAction} className="mt-3 w-full">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="affiliateUrl" value={affiliateUrl} />
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md ring-focus"
      >
        <ShoppingCart className="size-3.5" /> Xem deal ngay →
      </button>
    </form>
  );
}
