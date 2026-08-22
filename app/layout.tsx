import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SessionProvider } from "@/lib/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeetLink | 社内コネクト",
  description: "人と想いをつなぐ、社内限定のマッチングアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      data-mode="work"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // ブラウザ拡張が html に属性を足すことがあり（広告ブロッカーなど）、
      // React が「サーバーの出力と違う」と警告を出す。原因はアプリの外なので
      // 直しようがなく、この要素の属性差分だけ黙らせる。
      // 中身（children）の不一致は今までどおり報告される。
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
