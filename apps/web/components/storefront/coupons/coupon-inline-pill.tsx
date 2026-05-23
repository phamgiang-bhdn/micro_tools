import { deriveCouponShortLabel } from "../../../lib/coupon-format";

interface CouponPillInput {
  title?: string | null;
  contentHtml?: string | null;
  code?: string | null;
  expiresAt?: string | Date | null;
}

interface Props {
  coupon: CouponPillInput;
}

const URGENT_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * STORY-07: pill render trên ProductCard khi product có merchant matching coupon.
 * Urgent (<48h hết hạn): red ring + flame icon.
 */
export function CouponInlinePill({ coupon }: Props) {
  const label = deriveCouponShortLabel(coupon);
  const exp = coupon.expiresAt ? new Date(coupon.expiresAt).getTime() : 0;
  const urgent = exp > 0 && exp - Date.now() < URGENT_THRESHOLD_MS;

  return (
    <span
      className={
        urgent
          ? "inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-700 ring-1 ring-red-200"
          : "inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800 ring-1 ring-amber-200"
      }
    >
      <span aria-hidden="true">🎟</span>
      {label}
      {urgent ? <span className="text-[9px]">⏰</span> : null}
    </span>
  );
}
