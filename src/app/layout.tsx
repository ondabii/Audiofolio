import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audiofolio",
  description: "음악 창작자 포트폴리오 및 오디오 A/B 테스트 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="h-screen w-screen overflow-hidden antialiased bg-main-bg relative flex justify-center">
        {children}
      </body>
    </html>
  );
}
