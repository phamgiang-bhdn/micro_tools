import type React from "react";
import type { PublicCoupon } from "../../lib/api";
import { CouponCountdown } from "./coupon-countdown";
import { CopyCodeButton } from "./copy-code-button";

interface Props {
  coupon: PublicCoupon;
}

function readableCode(coupon: PublicCoupon): string {
  // `code` in DB is set = atCouponId (id, not user-typeable). Prefer iconText nếu có giống mã thật.
  const raw = coupon.code || "";
  if (/^[A-Z0-9_-]{3,20}$/i.test(raw)) return raw.toUpperCase();
  if (coupon.iconText && coupon.iconText.length <= 24) return coupon.iconText.toUpperCase();
  return "BẤM ĐỂ LẤY";
}

function isHot(coupon: PublicCoupon): boolean {
  if (coupon.discountPercent != null && coupon.discountPercent >= 30) return true;
  if (coupon.discountAmount && Number(coupon.discountAmount) >= 50000) return true;
  return false;
}

export function CouponCardV2({ coupon }: Props): React.ReactElement {
  const discountLabel =
    coupon.discountPercent != null
      ? `-${coupon.discountPercent}%`
      : coupon.discountAmount
        ? `-₫${Number(coupon.discountAmount).toLocaleString("vi-VN")}`
        : null;
  const hot = isHot(coupon);
  const code = readableCode(coupon);
  const merchantName = coupon.merchantDisplay ?? coupon.merchantSlug ?? "Cửa hàng";

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:border-brand-300">
      <header className="flex items-start gap-3">
        {coupon.merchantLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coupon.merchantLogo}
            alt={merchantName}
            className="size-12 shrink-0 rounded-xl bg-canvas object-contain p-1 ring-1 ring-line"
          />
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-base font-bold text-brand-700 ring-1 ring-line">
            {merchantName[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase text-ink">{merchantName}</span>
            {hot ? (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                Hot
              </span>
            ) : null}
          </div>
          {coupon.expiresAt ? (
            <div className="mt-0.5 text-xs">
              <CouponCountdown expiresAt={coupon.expiresAt} />
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-ink-mute">Không giới hạn hạn dùng</div>
          )}
        </div>
        {discountLabel ? (
          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-sm font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
            {discountLabel}
          </span>
        ) : null}
      </header>

      <div className="space-y-2 border-t border-dashed border-line pt-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink line-clamp-2">
          {coupon.description ?? "Khuyến mại"}
        </h3>
        {coupon.contentHtml ? (
          <div
            className="prose prose-sm max-w-none text-ink-soft line-clamp-2"
            // contentHtml sanitized in backend (sanitize-html.util.ts)
            dangerouslySetInnerHTML={{ __html: coupon.contentHtml }}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-dashed border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <CopyCodeButton code={code} />
        {coupon.affiliateUrl ? (
          <a
            href={coupon.affiliateUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Lấy mã &amp; mua →
          </a>
        ) : null}
      </div>
    </article>
  );
}
