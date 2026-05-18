export interface NicheItem {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  schemaConfig: Record<string, unknown>;
  _count?: {
    products: number;
  };
}

export interface ProductItem {
  id: string;
  nicheId: string;
  network: string;
  name: string;
  slug?: string | null;
  affiliateUrl: string;
  scrapedData: Record<string, unknown>;
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
export type ArticleStatus = "GENERATING" | "DRAFT" | "PUBLISHED" | "ARCHIVED" | "FAILED";

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
  | { type: "verdict"; summary: string; bestFor?: string[]; notFor?: string[] };

export interface ArticleDetail extends ArticleSummary {
  body: string;
  blocks: ArticleBlock[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  productIds: string[];
  products: ProductItem[];
  // coverImage already on ArticleSummary; restate for clarity in detail consumers.
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
}
