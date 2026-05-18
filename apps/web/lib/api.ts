import { ArticleDetail, ArticleSummary, CategoryDetail, CategoryItem, ProductView } from "./types";
import { normalizeProduct } from "./format";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

async function safeFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${path} failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export type FetchCategoriesResult = {
  categories: CategoryItem[];
  loadError: string | null;
};

export async function fetchCategories(): Promise<FetchCategoriesResult> {
  try {
    const categories = await safeFetch<CategoryItem[]>("/categories");
    return { categories, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch categories:", error);
    return { categories: [], loadError: message };
  }
}

export async function fetchCategoryBySlug(slug: string): Promise<CategoryDetail | null> {
  try {
    return await safeFetch<CategoryDetail>(`/categories/${slug}`);
  } catch (error) {
    console.error(`Failed to fetch category slug=${slug}:`, error);
    return null;
  }
}

export type FlatProduct = ProductView & {
  slug?: string | null;
  categorySlug: string;
  categoryName: string;
};

export interface FetchArticlesOptions {
  type?: "BUYING_GUIDE" | "REVIEW";
  categorySlug?: string;
  limit?: number;
}

export async function fetchArticles(options: FetchArticlesOptions = {}): Promise<ArticleSummary[]> {
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.categorySlug) params.set("categorySlug", options.categorySlug);
  if (options.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  try {
    return await safeFetch<ArticleSummary[]>(`/articles${qs ? `?${qs}` : ""}`);
  } catch (error) {
    console.error("Failed to fetch articles:", error);
    return [];
  }
}

export async function fetchArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  try {
    return await safeFetch<ArticleDetail>(`/articles/${slug}`);
  } catch (error) {
    console.error(`Failed to fetch article slug=${slug}:`, error);
    return null;
  }
}

export interface PublicCoupon {
  id: string;
  code: string;
  description: string | null;
  discountPercent: number | null;
  discountAmount: string | null;
  merchantSlug: string | null;
  merchantDisplay: string | null;
  merchantLogo: string | null;
  iconText: string | null;
  contentHtml: string | null;
  imageUrl: string | null;
  affiliateUrl: string | null;
  prodLink: string | null;
  startsAt: string | null;
  expiresAt: string | null;
}

export async function fetchCouponsByMerchant(
  merchantSlug: string,
  limit = 50
): Promise<PublicCoupon[]> {
  try {
    const qs = new URLSearchParams({ merchantSlug, limit: String(limit) });
    return await safeFetch<PublicCoupon[]>(`/coupons?${qs.toString()}`);
  } catch (error) {
    console.error(`Failed to fetch coupons merchantSlug=${merchantSlug}:`, error);
    return [];
  }
}

export interface TopProductSnapshotItem {
  id: string;
  position: number;
  atProductId: string;
  name: string;
  brand: string | null;
  image: string | null;
  link: string;
  affLink: string;
  categoryName: string | null;
  price: string | null;
  discount: string | null;
  merchant: string | null;
  snapshotDate: string;
}

export async function fetchTopProducts(limit = 12): Promise<TopProductSnapshotItem[]> {
  try {
    return await safeFetch<TopProductSnapshotItem[]>(`/top-products?limit=${limit}`);
  } catch (error) {
    console.error("Failed to fetch top-products:", error);
    return [];
  }
}

export async function fetchAllProductsFlat(categories: CategoryItem[]): Promise<FlatProduct[]> {
  if (categories.length === 0) return [];
  const details = await Promise.all(categories.map((category) => fetchCategoryBySlug(category.slug)));
  return details
    .filter((category): category is CategoryDetail => category !== null)
    .flatMap((category) =>
      category.products.map((product) => ({
        ...normalizeProduct(product),
        slug: product.slug ?? undefined,
        categorySlug: category.slug,
        categoryName: category.name
      }))
    );
}
