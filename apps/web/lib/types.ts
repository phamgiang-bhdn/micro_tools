export interface NicheItem {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  schemaConfig: Record<string, unknown>;
  seoTitle?: string | null;
  seoDescription?: string | null;
  _count?: {
    products: number;
  };
}

/** V4: verdict deal — khớp enum backend (price-intelligence.types.ts). */
export type PriceVerdict = "GIA_TOT" | "GIA_AO" | "DAY_GIA" | "BINH_THUONG" | "THIEU_DU_LIEU";

/** V4: summary giá real-time, derived từ PriceSnapshot, lưu trên Product.priceIntel. */
export interface PriceIntel {
  verdict: PriceVerdict;
  currentPrice: number | null;
  lowest30d: number | null;
  lowest90d: number | null;
  highest90d: number | null;
  avg30d: number | null;
  dropFromAvgPct: number | null;
  isAtLowest: boolean;
  sampleCount: number;
  spanDays: number;
  firstSeenAt: string | null;
  computedAt: string;
}

export interface ProductItem {
  id: string;
  nicheId: string;
  network: string;
  name: string;
  slug?: string | null;
  affiliateUrl: string;
  scrapedData: Record<string, unknown>;
  /** V4: price-intelligence summary (null khi chưa có lịch sử). */
  priceIntel?: PriceIntel | null;
  updatedAt?: string;
  shop?: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
  } | null;
}

export interface NicheDetail extends NicheItem {
  products: ProductItem[];
}

/**
 * Cấu trúc sau khi normalize `scrapedData` cho mọi UI hiển thị.
 * Mọi field optional — UI phải xử lý thiếu/null.
 */
export interface ProductView {
  id: string;
  nicheId: string;
  network: string;
  name: string;
  slug?: string;
  brand?: string;
  store?: string;
  image?: string;
  description?: string;
  /** AT raw category string, free text. KHÔNG phải Niche. */
  category?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  highlights?: string[];
  /** % giảm so với originalPrice */
  discountPercent?: number;
  /** Số lượng đã bán (sales count) — từ scrapedData (sold/salesCount/purchasedCount). */
  salesCount?: number;
  /** Tier shop — mall (Lazada Mall / Shopee Mall / Tiki Trading) vs regular. */
  storeTier?: "mall" | "regular" | null;
  /** ISO string từ Product.updatedAt — dùng cho verified-price chip. */
  updatedAt?: string;
  /** V4: price-intelligence summary (verdict thật/ảo/đáy + lowest/avg). Null khi chưa đủ lịch sử. */
  priceIntel?: PriceIntel | null;
  /** Affiliate URL gốc — copy từ ProductItem.affiliateUrl để inline CTA form action. */
  affiliateUrl?: string;
  /** Shop admin gán tay (replace cho campaign trên storefront). */
  shop?: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
  } | null;
  raw: Record<string, unknown>;
}

export type ArticleType = "BUYING_GUIDE" | "REVIEW";
export type ArticleStatus =
  | "DRAFT_BRIEF"
  | "RESEARCHING"
  | "REVIEWS_SCRAPED"
  | "OUTLINE_READY"
  | "IMAGES_READY"
  | "DRAFTING"
  | "SELF_CRITIQUED"
  | "FACT_CHECKED"
  | "PENDING_REVIEW"
  | "NEEDS_REVISION"
  | "PUBLISHED"
  | "ARCHIVED"
  | "FAILED";

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  type: ArticleType;
  publishedAt: string | null;
  niche: { slug: string; name: string } | null;
  coverImage: string | null;
}

export interface ArticleAdminSummary extends ArticleSummary {
  status: ArticleStatus;
  updatedAt: string;
}

export type ArticleBlock =
  | { type: "hero_quote"; text: string; attribution?: string }
  | {
      type: "criteria_grid";
      title?: string;
      items: { icon?: string; title: string; body: string }[];
    }
  | {
      type: "product_spotlight";
      productId: string;
      angle: string;
      pros?: string[];
      cons?: string[];
      imageUrl?: string;
    }
  | { type: "callout"; tone: "info" | "warning" | "tip" | "success"; title: string; body: string }
  | { type: "prose"; markdown: string }
  | { type: "comparison"; productIds: string[] }
  | { type: "pros_cons"; pros: string[]; cons: string[] }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "verdict"; summary: string; bestFor?: string[]; notFor?: string[] }
  | {
      /**
       * Slot do AI Writer chèn vào sections phù hợp. Lúc viết bài chưa có Product gắn
       * (productId undefined) → storefront ẩn block. Admin vào tab "Gắn sản phẩm" pick
       * Product từ DB → storefront render mini-card có giá + nút "Xem deal".
       * `slotKey` unique trong scope article — admin matcher dùng để target chính xác.
       */
      type: "product_slot";
      slotKey: string;
      hint: string;
      productId?: string;
      angle?: string;
    }
  | {
      type: "image";
      src: string;
      alt?: string;
      caption?: string;
      attribution?: string;
      attributionUrl?: string;
      width?: number;
      height?: number;
    }
  | {
      type: "review_quote";
      body: string;
      author?: string;
      rating?: number;
      sourceUrl?: string;
      sourceName?: string;
      verifiedBuyer?: boolean;
    };

export interface ArticleDetail extends ArticleSummary {
  body: string;
  blocks: ArticleBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  productIds: string[];
  pinnedProductIds?: string[];
  products: ProductItem[];
  updatedAt: string;
  // V2 fields (null if article còn legacy v1)
  sections?: ArticleSectionPublic[];
  author?: { id: string; slug: string; name: string; bio: string | null; avatarUrl: string | null } | null;
  layoutVariant?: string | null;
  evidence?: ArticleEvidencePublic[];
  related?: ArticleSummary[];
}

export interface ArticleSectionPublic {
  id: string;
  anchorSlug: string;
  heading: string;
  summary: string;
  order: number;
  blocks: ArticleBlock[];
  evidenceRefs: string[];
  wordCount: number;
}

export interface ArticleEvidencePublic {
  id: string;
  type: string;
  sourceUrl: string;
  sourceDomain: string;
  title: string | null;
  payload: Record<string, unknown>;
}

export interface ArticleAdminDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  blocks: ArticleBlock[] | null;
  coverImage: string | null;
  type: ArticleType;
  status: ArticleStatus;
  nicheId: string | null;
  productIds: string[];
  pinnedProductIds: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  aiModel: string | null;
  aiPromptName: string | null;
  generationError: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  niche: { id: string; slug: string; name: string } | null;
  products: Array<{ id: string; name: string; slug: string | null; network: string; isPublic: boolean }>;
  // V2 markers (null nếu là article legacy v1)
  topic?: string | null;
  briefJson?: Record<string, unknown> | null;
  authorId?: string | null;
}
