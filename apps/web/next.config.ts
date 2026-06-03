import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Monorepo: tránh Next chọn nhầm root (vd. pnpm-lock ở thư mục home) và lỗi trace/manifest.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),

  // Cần thiết để build Docker image gọn (~150MB vs ~900MB).
  output: "standalone",

  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },

  // Permanent redirects from the legacy /tools URL scheme to /categories.
  // The entity was renamed Tool -> Category (niche); the public URL changed to match.
  // NOTE: new AI Tool storefront dùng /ai/[slug], không phải /tools/[slug] (clash legacy).
  async redirects() {
    return [
      {
        source: "/tools/:slug",
        destination: "/categories/:slug",
        permanent: true
      },
      {
        source: "/tools/:slug/:productSlug",
        destination: "/categories/:slug/:productSlug",
        permanent: true
      },
      // Short URL aliases cho TikTok/FB bio. Mỗi niche launch thêm 1 entry ở đây.
      // Format: /<short-niche> → /ai/<full-tool-slug>
      // Sample Tool seed sinh slug "chon-<niche-slug>" — đồng bộ ở đây.
      {
        source: "/loc-nuoc",
        destination: "/ai/chon-may-loc-nuoc",
        permanent: false
      },
      {
        source: "/loc-khong-khi",
        destination: "/ai/chon-may-loc-khong-khi",
        permanent: false
      },
      {
        source: "/robot",
        destination: "/ai/chon-robot-hut-bui-lau-nha",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
