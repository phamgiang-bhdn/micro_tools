import { ToolDetail, ToolItem, ProductView } from "./types";
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

export type FetchToolsResult = {
  tools: ToolItem[];
  /** API unreachable / 5xx — không giống "DB rỗng". */
  loadError: string | null;
};

export async function fetchTools(): Promise<FetchToolsResult> {
  try {
    const tools = await safeFetch<ToolItem[]>("/tools");
    return { tools, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch tools:", error);
    return { tools: [], loadError: message };
  }
}

export async function fetchToolBySlug(slug: string): Promise<ToolDetail | null> {
  try {
    return await safeFetch<ToolDetail>(`/tools/${slug}`);
  } catch (error) {
    console.error(`Failed to fetch tool slug=${slug}:`, error);
    return null;
  }
}

/**
 * Trộn sản phẩm từ N tool đầu để hiển thị "Deal hot" trên homepage.
 * Sắp theo discountPercent desc, ưu tiên item có ảnh + giá.
 */
export async function fetchFeaturedProducts(
  tools: ToolItem[],
  limit = 8
): Promise<Array<ProductView & { toolSlug: string; toolName: string }>> {
  if (tools.length === 0) return [];

  const topTools = tools.slice(0, 5);
  const details = await Promise.all(topTools.map((tool) => fetchToolBySlug(tool.slug)));

  const merged = details
    .filter((tool): tool is ToolDetail => tool !== null)
    .flatMap((tool) =>
      tool.products.map((product) => ({
        ...normalizeProduct(product),
        toolSlug: tool.slug,
        toolName: tool.name
      }))
    );

  return merged
    .sort((a, b) => {
      const scoreA = (a.image ? 2 : 0) + (a.price ? 1 : 0) + (a.discountPercent ?? 0) / 10;
      const scoreB = (b.image ? 2 : 0) + (b.price ? 1 : 0) + (b.discountPercent ?? 0) / 10;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}
