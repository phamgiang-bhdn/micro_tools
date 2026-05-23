/**
 * STORY-07: pick best coupon cho product render-time.
 * Match priority: freeship → earliest expiry (urgency).
 */
export interface CouponMatchInput {
  id: string;
  title?: string | null;
  contentHtml?: string | null;
  code?: string | null;
  merchantSlug?: string | null;
  expiresAt?: string | Date | null;
  isActive?: boolean | null;
}

export interface ProductMatchInput {
  store?: string | null;
  merchantSlug?: string | null;
}

export function pickBestCouponForProduct<T extends CouponMatchInput>(
  product: ProductMatchInput,
  coupons: T[]
): T | null {
  const slug = (product.merchantSlug ?? product.store ?? "").toLowerCase().trim();
  if (!slug) return null;
  const now = Date.now();

  const matched = coupons.filter((c) => {
    const cs = (c.merchantSlug ?? "").toLowerCase();
    if (cs !== slug && !slug.includes(cs) && !cs.includes(slug)) return false;
    if (c.isActive === false) return false;
    if (c.expiresAt) {
      const exp = new Date(c.expiresAt).getTime();
      if (Number.isFinite(exp) && exp < now) return false;
    }
    return true;
  });
  if (matched.length === 0) return null;

  matched.sort((a, b) => {
    const af = isFreeshipCoupon(a) ? 1 : 0;
    const bf = isFreeshipCoupon(b) ? 1 : 0;
    if (af !== bf) return bf - af;
    const ax = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
    const bx = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
    return ax - bx;
  });
  return matched[0];
}

function isFreeshipCoupon(c: CouponMatchInput): boolean {
  const text = ((c.title ?? "") + " " + (c.contentHtml ?? "")).toLowerCase();
  return /freeship|free\s?ship|miễn phí/.test(text);
}
