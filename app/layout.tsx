import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Foodie - 受賞店を地図で探す",
  description:
    "食べログ百名店の受賞レストランを地図で探す。ジャンルや都道府県から絞り込めます。",
  openGraph: {
    title: "Foodie - 受賞店を地図で探す",
    description:
      "食べログ百名店の受賞レストランを地図で探す。ジャンルや都道府県から絞り込めます。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
