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

export type FlatProduct = ProductView & {
  slug?: string | null;
  toolSlug: string;
  toolName: string;
};

export async function fetchAllProductsFlat(tools: ToolItem[]): Promise<FlatProduct[]> {
  if (tools.length === 0) return [];
  const details = await Promise.all(tools.map((tool) => fetchToolBySlug(tool.slug)));
  return details
    .filter((tool): tool is ToolDetail => tool !== null)
    .flatMap((tool) =>
      tool.products.map((product) => ({
        ...normalizeProduct(product),
        slug: product.slug ?? undefined,
        toolSlug: tool.slug,
        toolName: tool.name
      }))
    );
}
