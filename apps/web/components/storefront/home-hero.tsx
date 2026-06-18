import type React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { formatMoney, formatNumber } from "../../lib/format";
import type { FlatProduct } from "../../lib/api";

interface Props {
  topDealsCount: number;
  hotDealCount: number;
  savingsTotal: number;
  featuredDeal: FlatProduct | null;
}

/**
 * Hero compact thay PageHero full-fold cũ. Target height: ≤320px desktop, ≤260px mobile.
 * - Trái: tagline 1 dòng + sub-line + 2 CTA.
 * - Phải (desktop) / dưới (mobile): 1 featured deal card to (image + price + outbound CTA).
 * - KHÔNG render 4 stat card 4 cột — info gộp vào sub-line.
 *
 * Featured deal click → tracking → outbound via [[trackAndRedirectAction]] (qua ProductCard chính
 * thực thì click vào card → /categories/<slug>/<productSlug>, nhưng ở featured spot ta render
 * link card thường — user click chính thực có thể vào detail trước, conversion 2-click).
 */
export function HomeHero({
  topDealsCount,
  hotDealCount,
  savingsTotal,
  featuredDeal
}: Props): React.ReactElement {
  const dealKey = featuredDeal
    ? featuredDeal.slug && featuredDeal.slug.length > 0
      ? featuredDeal.slug
      : featuredDeal.id
    : null;

  return (
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-primary-50/40 via-canvas to-canvas">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-10">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-card/80 px-2.5 py-1 text-micro font-semibold uppercase tracking-wider text-primary-700">
            <span aria-hidden className="size-1.5 rounded-full bg-primary-500" />
            Cập nhật mỗi giờ
          </span>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
            Mua khôn hơn — đối chiếu giá thật từ <span className="text-primary-700">Shopee, Lazada, TikTok</span>
          </h1>
          <p className="text-sm text-ink-soft sm:text-base">
            {hotDealCount > 0
              ? `${formatNumber(hotDealCount)} deal hot cập nhật mỗi giờ`
              : "Cập nhật deal liên tục"}
            {savingsTotal > 0 ? <> · Hôm nay tiết kiệm tới <strong className="text-ink">{formatMoney(savingsTotal)}</strong></> : null}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button asChild variant="brand" size="md">
              <Link href="#hot-deals">
                <Icon name="flame" size="sm" />
                <span>Xem deal hot →</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="md">
              <Link href="#coupons">Mã giảm còn dùng</Link>
            </Button>
          </div>
          {topDealsCount > 0 ? (
            <p className="text-micro text-ink-mute">
              Đang theo dõi {formatNumber(topDealsCount)} sản phẩm trên 4 nền tảng affiliate.
            </p>
          ) : null}
        </div>

        {featuredDeal && dealKey ? (
          <Link
            href={`/categories/${featuredDeal.nicheSlug}/${dealKey}`}
            className="group relative flex gap-3 overflow-hidden rounded-2xl border border-line bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-pop sm:p-4"
          >
            <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl bg-canvas sm:w-32">
              {featuredDeal.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featuredDeal.image}
                  alt={featuredDeal.name}
                  className="size-full object-cover transition group-hover:scale-110"
                />
              ) : (
                <div className="grid size-full place-items-center bg-gradient-to-br from-primary-50 to-primary-100 text-lg font-bold text-primary-700">
                  {featuredDeal.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              {typeof featuredDeal.discountPercent === "number" && featuredDeal.discountPercent > 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-cta-500 px-1.5 py-0.5 text-micro font-bold text-ink shadow">
                  -{featuredDeal.discountPercent}%
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-micro font-semibold uppercase tracking-wider text-primary-700">
                Đang hot nhất
              </span>
              <p className="mt-0.5 line-clamp-2 text-body-sm font-semibold leading-snug text-ink group-hover:text-primary-700">
                {featuredDeal.name}
              </p>
              <div className="mt-auto pt-2">
                <div className="flex items-baseline gap-2">
                  {typeof featuredDeal.price === "number" && featuredDeal.price > 0 ? (
                    <span className="text-body-lg font-bold text-primary-700">{formatMoney(featuredDeal.price)}</span>
                  ) : null}
                  {typeof featuredDeal.originalPrice === "number" &&
                  featuredDeal.originalPrice > (featuredDeal.price ?? 0) ? (
                    <span className="text-micro text-ink-mute line-through">{formatMoney(featuredDeal.originalPrice)}</span>
                  ) : null}
                </div>
                <span className="mt-1.5 inline-flex items-center gap-1 text-caption font-semibold text-primary-700 group-hover:gap-1.5">
                  Xem deal ngay <Icon name="arrow-right" size="xs" />
                </span>
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
