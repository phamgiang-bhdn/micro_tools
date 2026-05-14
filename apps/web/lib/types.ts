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
