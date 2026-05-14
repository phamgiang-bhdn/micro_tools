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
  }
};

export default nextConfig;
