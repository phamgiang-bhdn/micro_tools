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
  /**
   * Slug của Category mà offer sẽ được gán vào. Có thể rỗng khi client không xác định
   * (vd `accesstrade.client` mode per-campaign — CrawlerService set từ `Campaign.categoryId` sau).
   */
  categorySlug: string;
  badge?: string;
  highlights?: string[];
  /** SKU/mã sản phẩm bên merchant (Accesstrade trả ở field `sku`). */
  sku?: string;
  /** product_id internal của AT — tách rời `externalId` (offer id). */
  sourceProductId?: string;
  /** Slug danh mục theo phân loại của AT (`cate`). */
  atCategorySlug?: string;
  /** Số tiền giảm (VND). Tham khảo, không dùng làm dedup. */
  discountAmount?: number;
  /** Pre-resolved Campaign.id từ caller (crawler-cycle per-campaign). Khi set, import skip lookup theo slug. */
  campaignDbId?: string;
  /**
   * Raw fields network-specific mà NormalizedOffer chưa cover (vd shop_rating, voucher_code).
   * Mỗi client tự stash vào đây — consumer dùng `unknown` cast khi cần.
   */
  metadata?: Record<string, unknown>;
}
