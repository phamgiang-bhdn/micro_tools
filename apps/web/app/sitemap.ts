import type { MetadataRoute } from "next";
import { fetchToolBySlug, fetchTools } from "../lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3100";
  const now = new Date();

  const { tools } = await fetchTools();

  const toolEntries: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: `${base}/tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8
  }));

  const productDetails = await Promise.all(tools.slice(0, 20).map((tool) => fetchToolBySlug(tool.slug)));
  const productEntries: MetadataRoute.Sitemap = productDetails
    .flatMap((tool) =>
      tool
        ? tool.products.map((product) => ({
            url: `${base}/tools/${tool.slug}/${product.id}`,
            lastModified: now,
            changeFrequency: "daily" as const,
            priority: 0.6
          }))
        : []
    );

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1
    },
    ...toolEntries,
    ...productEntries
  ];
}
