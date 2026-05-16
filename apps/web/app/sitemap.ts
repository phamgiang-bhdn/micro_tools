import type { MetadataRoute } from "next";
import { fetchArticles, fetchCategoryBySlug, fetchCategories } from "../lib/api";
import { slugify } from "../lib/slug";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3100";
  const now = new Date();

  const { categories } = await fetchCategories();

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${base}/categories/${category.slug}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8
  }));

  const productDetails = await Promise.all(
    categories.slice(0, 20).map((category) => fetchCategoryBySlug(category.slug))
  );
  const productEntries: MetadataRoute.Sitemap = productDetails.flatMap((category) =>
    category
      ? category.products.map((product) => ({
          url: `${base}/categories/${category.slug}/${product.slug ?? slugify(product.name) ?? product.id}`,
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

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1
    },
    {
      url: `${base}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7
    },
    ...categoryEntries,
    ...productEntries,
    ...articleEntries
  ];
}
