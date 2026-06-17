import type React from "react";
import Link from "next/link";
import type { PublicCoupon } from "../../lib/api";

interface Props {
  coupons: PublicCoupon[];
}

/**
 * 3 coupon gần hết hạn nhất ở homepage. Card preview minimal — bấm "Lấy mã" → trang
 * `/khuyen-mai/<merchantSlug>` xem full detail (STORY-06). KHÔNG copy code ở card này
 * (user phải vào hub để giảm bounce + đo intent).
 *
 * Countdown text server-rendered: chấp nhận ±5 phút lệch khi RSC cache; chính xác thật
 * khi user vào trang merchant detail (revalidate ngắn hơn ở đó).
 */
export function CouponPreview({ coupons }: Props): React.ReactElement | null {
  if (coupons.length === 0) return null;
  const now = new Date();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {coupons.map((c) => {
        const merchantSlug = c.merchantSlug ?? "";
        const merchantDisplay = c.merchantDisplay ?? merchantSlug.toUpperCase() ?? "Cửa hàng";
        const expiryText = c.expiresAt ? formatExpiry(new Date(c.expiresAt), now) : null;
        const headline = pickHeadline(c);
        const discountBadge = pickDiscountBadge(c);

        return (
          <Link
            key={c.id}
            href={merchantSlug ? `/khuyen-mai/${merchantSlug}` : "/khuyen-mai"}
            className="group flex flex-col gap-2.5 rounded-2xl bg-surface p-4 ring-1 ring-border transition hover:ring-primary-300 hover:shadow-card-md"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {c.merchantLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.merchantLogo}
                    alt=""
                    loading="lazy"
                    className="size-7 shrink-0 rounded-full border border-line bg-white object-contain"
                  />
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                    {merchantDisplay.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="truncate text-[12.5px] font-semibold uppercase tracking-wider text-ink">
                  {merchantDisplay}
                </span>
              </div>
              {discountBadge ? (
                <span className="rounded-md bg-cta-500 px-2 py-0.5 text-[11px] font-bold text-ink shadow-sm">
                  {discountBadge}
                </span>
              ) : null}
            </div>

            <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink group-hover:text-primary-700">
              {headline}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[12px]">
              <span className={expiryText ? "font-semibold text-danger" : "text-ink-mute"}>
                {expiryText ?? "Còn hạn dài"}
              </span>
              <span className="font-semibold text-primary-700 group-hover:underline">Lấy mã →</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function pickHeadline(c: PublicCoupon): string {
  if (c.description && c.description.trim()) return c.description.trim();
  if (c.iconText && c.iconText.trim()) return c.iconText.trim();
  return "Ưu đãi đang sống";
}

function pickDiscountBadge(c: PublicCoupon): string | null {
  if (c.discountPercent && c.discountPercent > 0) return `-${c.discountPercent}%`;
  if (c.discountAmount && c.discountAmount.trim()) return `-${c.discountAmount.trim()}`;
  return null;
}

function formatExpiry(expiresAt: Date, now: Date): string | null {
  const diffMs = expiresAt.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(diffMs / 60_000));
    return `Còn ${minutes} phút`;
  }
  if (hours < 24) return `Còn ${hours} giờ`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days <= 3) return remHours > 0 ? `Còn ${days} ngày ${remHours} giờ` : `Còn ${days} ngày`;
  return `Còn ${days} ngày`;
}
