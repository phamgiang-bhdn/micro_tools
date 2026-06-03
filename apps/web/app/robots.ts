import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL ?? "http://localhost:3100";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ai", "/coming-soon", "/ve-chung-toi"],
        disallow: [
          "/admin",
          "/api/admin",
          // Per-user result pages — không cần SEO index (mỗi session khác nhau)
          "/ai/*/result/*",
          // Viral share redirect — landing thật ở /ai/[slug]/result/[id]
          "/r/*"
        ]
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
