import type { Metadata } from "next";
import "./globals.css";

if (typeof self === 'undefined') {
  (globalThis as any).self = globalThis;
}

export const metadata: Metadata = {
  title: "Audiofolio",
  description: "음악 창작자 포트폴리오 관리 및 A/B 테스트 웹 서비스",
};

import { PullToRefresh } from "@/components/common/PullToRefresh";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="min-h-full antialiased dark">
      <body className="min-h-screen w-full overflow-y-auto overscroll-y-auto font-sans bg-[var(--color-main-bg)] text-white relative flex justify-center">
        <PullToRefresh>
          {children}
        </PullToRefresh>
      </body>
    </html>
  );
}
