import type React from "react";
import Link from "next/link";
import { formatMoney } from "../../lib/format";

interface Deal {
  id: string;
  name: string;
  image?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  discountPercent?: number;
  nicheSlug: string;
  slug?: string | null;
}

/**
 * Hiển thị 3 deal nổi bật ở cột phải của hero home.
 * Card trên cùng phóng to nhẹ để dẫn mắt.
 */
export function FeaturedPreview({ deals }: { deals: Deal[] }): React.ReactElement | null {
  if (deals.length === 0) return null;
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-hero-mesh opacity-70 blur-2xl" aria-hidden />
      <div className="relative grid gap-3">
        {deals.map((deal, idx) => {
          const key = deal.slug && deal.slug.length > 0 ? deal.slug : deal.id;
          return (
            <Link
              key={deal.id}
              href={`/categories/${deal.nicheSlug}/${key}`}
              className={`group flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-pop ${
                idx === 0 ? "scale-105" : ""
              }`}
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-canvas">
                {deal.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={deal.image}
                    alt={deal.name}
                    className="size-full object-cover transition group-hover:scale-110"
                  />
                ) : (
                  <div className="grid size-full place-items-center bg-gradient-to-br from-primary-50 via-white to-accent-50 text-lg font-bold text-primary-700">
                    {deal.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {deal.discountPercent ? (
                  <span className="absolute left-1 top-1 rounded bg-brand-gradient px-1 py-0.5 text-micro font-bold text-white">
                    -{deal.discountPercent}%
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-primary-700">
                  {deal.name}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  {deal.price !== undefined ? (
                    <span className="text-sm font-bold text-primary-700">
                      {formatMoney(deal.price, deal.currency)}
                    </span>
                  ) : null}
                  {deal.originalPrice && deal.price && deal.originalPrice > deal.price ? (
                    <span className="text-micro text-ink-mute line-through">
                      {formatMoney(deal.originalPrice, deal.currency)}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
