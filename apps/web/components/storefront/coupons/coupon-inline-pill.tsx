import { Ticket, Clock } from "lucide-react";
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
          ? "inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-micro font-semibold text-danger-ink ring-1 ring-danger/20"
          : "inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-micro font-semibold text-warning-ink ring-1 ring-warning/20"
      }
    >
      <Ticket className="size-3" aria-hidden />
      {label}
      {urgent ? <Clock className="size-3" aria-hidden /> : null}
    </span>
  );
}
