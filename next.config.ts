import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Cloudflare Edge 렌더링을 위해 output: 'export'는 사용하지 않습니다. */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    CLOUDFLARE_D1_DATABASE_ID: process.env.CLOUDFLARE_D1_DATABASE_ID || "",
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "",
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "",
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "",
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "",
  }
};

export default nextConfig;
