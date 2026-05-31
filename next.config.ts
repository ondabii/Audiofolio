import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 풀스택 SSR 빌드를 위해 output: "export" 비활성화
  images: { unoptimized: true },
  trailingSlash: false, // ⚡️ trailingSlash 해제하여 URL 꼬임 원천 차단
};

export default nextConfig;
