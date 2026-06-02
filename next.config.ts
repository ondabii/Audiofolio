import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Cloudflare Edge 렌더링을 위해 output: 'export'는 사용하지 않습니다. */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // ⚠️ 주의: 이 env 블록은 빌드 시 번들에 값이 삽입됩니다.
  // 비밀 키(API Token, Secret Key 등)는 절대 여기에 넣지 마세요.
  // 서버 컴포넌트 / API Route에서는 process.env.XXX로 직접 접근합니다.
  // 클라이언트에 노출해도 되는 공개 값만 NEXT_PUBLIC_ 접두사와 함께 여기에 선언합니다.
  env: {
    // R2_PUBLIC_URL은 오디오 URL을 서버에서 조립할 때만 사용 — 값 자체는 공개 도메인이므로 무방
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "https://afc.ondabii.com",
  }
};

export default nextConfig;
