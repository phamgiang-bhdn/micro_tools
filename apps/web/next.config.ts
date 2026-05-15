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
  // The entity was renamed Tool -> Category; the public URL changed to match.
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
      }
    ];
  }
};

export default nextConfig;
