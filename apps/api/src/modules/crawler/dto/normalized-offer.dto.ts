/**
 * Output chung sau khi normalize từ mọi nguồn (Accesstrade / Shopee / web-scrape).
 * Mọi adapter phải trả về kiểu này; mọi consumer (enrichment / import) chỉ làm việc với nó.
 */
export interface NormalizedOffer {
  source: "accesstrade" | "shopee" | "tiktok" | "lazada" | "manual";
  /** ID của sản phẩm trên nguồn gốc — để dedup khi crawl lại. */
  externalId: string;
  name: string;
  affiliateUrl: string;
  image?: string;
  price?: number;
  originalPrice?: number;
  currency: string;
  description?: string;
  category?: string;
  brand?: string;
  store?: string;
  discountPercent?: number;
  campaign?: string;
  merchantName?: string;
  /** slug của Category mà offer sẽ được gán vào. */
  categorySlug: string;
  badge?: string;
  highlights?: string[];
  /**
   * Raw fields network-specific mà NormalizedOffer chưa cover (vd shop_rating, voucher_code).
   * Mỗi client tự stash vào đây — consumer dùng `unknown` cast khi cần.
   */
  metadata?: Record<string, unknown>;
}
