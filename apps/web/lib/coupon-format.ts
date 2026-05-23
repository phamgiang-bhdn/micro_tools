/**
 * STORY-07: derive ngắn label cho coupon-inline pill render trên ProductCard.
 *
 * Priority:
 *   1. freeship (giảm phí ship — convert mạnh nhất)
 *   2. discount %  (Giảm 30%)
 *   3. discount K  (Giảm 50K)
 *   4. code fallback
 */
export interface CouponLite {
  title?: string | null;
  contentHtml?: string | null;
  code?: string | null;
}

export function deriveCouponShortLabel(coupon: CouponLite): string {
  const text = ((coupon.title ?? "") + " " + (coupon.contentHtml ?? "")).toLowerCase();

  if (/freeship|free\s?ship|miễn phí v[aậ]n chuyển/.test(text)) {
    const amt = text.match(/(\d+)\s?k/);
    return amt ? `Freeship ${amt[1]}K` : "Freeship";
  }

  const pct = text.match(/giảm\s+(\d+)\s*%|(\d+)\s*%\s*off|-\s*(\d+)\s*%/);
  if (pct) {
    const v = pct[1] ?? pct[2] ?? pct[3];
    return `Giảm ${v}%`;
  }

  const amt = text.match(/giảm\s+(\d+)\s*k|(\d+)\s*000/);
  if (amt) {
    const v = amt[1] ?? amt[2];
    return `Giảm ${v}K`;
  }

  return coupon.code ?? coupon.title?.slice(0, 24) ?? "Mã giảm";
}
