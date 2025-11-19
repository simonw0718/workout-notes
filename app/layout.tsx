/// app/layout.tsx
"use client";

import "./globals.css";
import type { ReactNode } from "react";
import RegisterSW from "@/components/RegisterSW";
import NetworkToast from "@/components/NetworkToast";
import { Oswald } from "next/font/google";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-title",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-Hant"
      className={`h-full bg-black text-white ${oswald.variable}`}
    >
      <head>
        <title>Workout Notes</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="application-name" content="Workout Notes" />
        <meta name="apple-mobile-web-app-title" content="Workout" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content="#111827" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="h-full">
        {children}
        {/* 離線 / 上線 簡單 toast 提示，不佔版面 */}
        <NetworkToast />
        {/* 註冊 Service Worker */}
        <RegisterSW />
      </body>
    </html>
  );
}