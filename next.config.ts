import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 풀스택 SSR 빌드를 위해 output: "export" 비활성화
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
