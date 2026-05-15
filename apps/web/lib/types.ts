export interface ToolItem {
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
  toolId: string;
  network: string;
  name: string;
  slug?: string | null;
  affiliateUrl: string;
  scrapedData: Record<string, unknown>;
}

export interface ToolDetail extends ToolItem {
  products: ProductItem[];
}

/**
 * Cấu trúc sau khi normalize `scrapedData` cho mọi UI hiển thị.
 * Mọi field optional — UI phải xử lý thiếu/null.
 */
export interface ProductView {
  id: string;
  toolId: string;
  network: string;
  name: string;
  slug?: string;
  brand?: string;
  store?: string;
  image?: string;
  description?: string;
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
  raw: Record<string, unknown>;
}

export type ArticleType = "BUYING_GUIDE" | "REVIEW";
export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  type: ArticleType;
  publishedAt: string | null;
  tool: { slug: string; name: string } | null;
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
}

export interface ArticleAdminDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  type: ArticleType;
  status: ArticleStatus;
  toolId: string | null;
  productIds: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  aiModel: string | null;
  aiPromptName: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tool: { id: string; slug: string; name: string } | null;
  products: Array<{ id: string; name: string; slug: string | null; network: string }>;
}
