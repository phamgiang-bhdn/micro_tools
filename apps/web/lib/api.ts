import { ArticleDetail, ArticleSummary, NicheDetail, NicheItem, ProductView } from "./types";
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

export type FetchNichesResult = {
  niches: NicheItem[];
  loadError: string | null;
};

export async function fetchNiches(): Promise<FetchNichesResult> {
  try {
    const niches = await safeFetch<NicheItem[]>("/niches");
    return { niches, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch niches:", error);
    return { niches: [], loadError: message };
  }
}

export async function fetchNicheBySlug(slug: string): Promise<NicheDetail | null> {
  try {
    return await safeFetch<NicheDetail>(`/niches/${slug}`);
  } catch (error) {
    console.error(`Failed to fetch niche slug=${slug}:`, error);
    return null;
  }
}

export type FlatProduct = ProductView & {
  slug?: string | null;
  nicheSlug: string;
  nicheName: string;
};

export interface FetchArticlesOptions {
  type?: "BUYING_GUIDE" | "REVIEW";
  nicheSlug?: string;
  limit?: number;
}

export async function fetchArticles(options: FetchArticlesOptions = {}): Promise<ArticleSummary[]> {
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.nicheSlug) params.set("nicheSlug", options.nicheSlug);
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

export async function fetchAllCoupons(limit = 100): Promise<PublicCoupon[]> {
  try {
    const qs = new URLSearchParams({ limit: String(limit), sort: "expiresAt:asc" });
    return await safeFetch<PublicCoupon[]>(`/coupons?${qs.toString()}`);
  } catch (error) {
    console.error("Failed to fetch all coupons:", error);
    return [];
  }
}

/** Coupon list cho homepage preview — sắp theo gần hết hạn nhất (urgency). */
export async function fetchActiveCoupons(limit = 3): Promise<PublicCoupon[]> {
  try {
    const qs = new URLSearchParams({ limit: String(limit), sort: "expiresAt:asc" });
    return await safeFetch<PublicCoupon[]>(`/coupons?${qs.toString()}`);
  } catch (error) {
    console.error("Failed to fetch active coupons:", error);
    return [];
  }
}

/**
 * Lấy FAQ items từ latest BUYING_GUIDE article của niche — extract `faq` block đầu tiên
 * trong sections/blocks. Trả [] nếu niche chưa có guide hoặc guide chưa có faq block.
 * Best-effort: fail silent (network/4xx), không throw lên page.
 */
export async function fetchNicheFaqFromArticle(nicheSlug: string): Promise<Array<{ q: string; a: string }>> {
  try {
    const guides = await fetchArticles({ nicheSlug, type: "BUYING_GUIDE", limit: 1 });
    const summary = guides[0];
    if (!summary) return [];
    const detail = await fetchArticleBySlug(summary.slug);
    if (!detail) return [];
    // Source 1: top-level blocks (article v1).
    const flatBlocks = Array.isArray(detail.blocks) ? detail.blocks : [];
    // Source 2: V2 sections[].blocks[].
    const sectionBlocks = Array.isArray(detail.sections)
      ? detail.sections.flatMap((s) => (Array.isArray(s.blocks) ? s.blocks : []))
      : [];
    const allBlocks = [...flatBlocks, ...sectionBlocks];
    for (const block of allBlocks) {
      if (!block || typeof block !== "object") continue;
      const b = block as { type?: string; items?: unknown };
      if (b.type !== "faq" || !Array.isArray(b.items)) continue;
      const items: Array<{ q: string; a: string }> = [];
      for (const it of b.items) {
        if (!it || typeof it !== "object") continue;
        const row = it as { q?: unknown; a?: unknown };
        if (typeof row.q === "string" && typeof row.a === "string" && row.q.trim() && row.a.trim()) {
          items.push({ q: row.q.trim(), a: row.a.trim() });
        }
      }
      if (items.length > 0) return items;
    }
    return [];
  } catch (error) {
    console.error(`Failed to fetch niche FAQ slug=${nicheSlug}:`, error);
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
  merchantDisplay: string | null;
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

export async function fetchAllProductsFlat(niches: NicheItem[]): Promise<FlatProduct[]> {
  if (niches.length === 0) return [];
  const details = await Promise.all(niches.map((niche) => fetchNicheBySlug(niche.slug)));
  return details
    .filter((niche): niche is NicheDetail => niche !== null)
    .flatMap((niche) =>
      niche.products.map((product) => ({
        ...normalizeProduct(product),
        slug: product.slug ?? undefined,
        nicheSlug: niche.slug,
        nicheName: niche.name
      }))
    );
}
