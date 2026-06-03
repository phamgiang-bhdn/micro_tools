import type { MetadataRoute } from "next";
import { fetchArticles, fetchNicheBySlug, fetchNiches } from "../lib/api";
import { slugify } from "../lib/slug";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

interface PublicTool {
  slug: string;
  status: string;
  updatedAt: string;
}

async function fetchActiveTools(): Promise<PublicTool[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/tool/active?limit=50`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as PublicTool[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3100";
  const now = new Date();

  const { niches } = await fetchNiches();
  const tools = await fetchActiveTools();

  const nicheEntries: MetadataRoute.Sitemap = niches.map((niche) => ({
    url: `${base}/categories/${niche.slug}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8
  }));

  const toolEntries: MetadataRoute.Sitemap = tools.map((t) => ({
    url: `${base}/ai/${t.slug}`,
    lastModified: t.updatedAt ? new Date(t.updatedAt) : now,
    changeFrequency: "daily",
    priority: 0.9
  }));

  const productDetails = await Promise.all(
    niches.slice(0, 20).map((niche) => fetchNicheBySlug(niche.slug))
  );
  const productEntries: MetadataRoute.Sitemap = productDetails.flatMap((niche) =>
    niche
      ? niche.products.map((product) => ({
          url: `${base}/categories/${niche.slug}/${product.slug ?? slugify(product.name) ?? product.id}`,
          lastModified: now,
          changeFrequency: "daily" as const,
          priority: 0.6
        }))
      : []
  );

  const articles = await fetchArticles({ limit: 100 });
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${base}/blog/${article.slug}`,
    lastModified: article.publishedAt ? new Date(article.publishedAt) : now,
    changeFrequency: "weekly",
    priority: 0.7
  }));

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/khuyen-mai`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/deal-hot`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/ve-chung-toi`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tuyen-bo-affiliate`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/chinh-sach-bao-mat`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/dieu-khoan`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/lien-he`, lastModified: now, changeFrequency: "monthly", priority: 0.5 }
  ];

  return [
    ...staticEntries,
    ...toolEntries,
    ...nicheEntries,
    ...productEntries,
    ...articleEntries
  ];
}
