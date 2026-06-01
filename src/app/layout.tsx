import type { Metadata } from "next";
import "./globals.css";

export const runtime = 'edge';

export const metadata: Metadata = {
  title: "Audiofolio",
  description: "음악 창작자 포트폴리오 관리 및 A/B 테스트 웹 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased dark">
      <body className="h-screen w-screen overflow-hidden font-sans bg-[var(--color-main-bg)] text-white relative flex justify-center">
        {children}
      </body>
    </html>
  );
}
