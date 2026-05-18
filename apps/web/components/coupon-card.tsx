import type React from "react";
import type { PublicCoupon } from "../lib/api";

interface CouponCardProps {
  coupon: PublicCoupon;
}

export function CouponCard({ coupon }: CouponCardProps): React.ReactElement {
  const discountLabel =
    coupon.discountPercent != null
      ? `-${coupon.discountPercent}%`
      : coupon.discountAmount
        ? `-₫${Number(coupon.discountAmount).toLocaleString("vi-VN")}`
        : null;
  const expiresLabel = coupon.expiresAt
    ? new Date(coupon.expiresAt).toLocaleDateString("vi-VN")
    : "Không hạn";

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start">
      {coupon.merchantLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coupon.merchantLogo}
          alt={coupon.merchantDisplay ?? coupon.merchantSlug ?? ""}
          className="size-16 shrink-0 rounded-xl bg-neutral-50 object-contain p-2 ring-1 ring-neutral-200"
        />
      ) : null}

      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-neutral-900">
            {coupon.description ?? "Khuyến mại"}
          </h2>
          {discountLabel ? (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-sm font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
              {discountLabel}
            </span>
          ) : null}
          {coupon.iconText ? (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              {coupon.iconText}
            </span>
          ) : null}
        </div>

        {coupon.contentHtml ? (
          <div
            className="prose prose-sm max-w-none text-neutral-700"
            // contentHtml đã được sanitize ở backend (apps/api/src/common/sanitize-html.util.ts)
            dangerouslySetInnerHTML={{ __html: coupon.contentHtml }}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-neutral-500">Hạn dùng: {expiresLabel}</p>
          {coupon.affiliateUrl ? (
            <a
              href={coupon.affiliateUrl}
              target="_blank"
              rel="nofollow noopener"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Nhận ưu đãi
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
