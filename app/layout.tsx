///app/layout.tsx
"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { offlineChanged } from "@/lib/bus";
import RegisterSW from "@/components/RegisterSW";
import { Oswald } from "next/font/google";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-title",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setOffline(!!ce.detail);
    };
    offlineChanged.addEventListener("change", handler);
    return () => offlineChanged.removeEventListener("change", handler);
  }, []);

  return (
    <html lang="zh-Hant" className={`h-full bg-black text-white ${oswald.variable}`}>
      <head>
        <title>Workout Notes</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="application-name" content="Workout Notes" />
        <meta name="apple-mobile-web-app-title" content="Workout" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#111827" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="h-full">
        {offline && (
          <div className="bg-red-600 text-white text-center py-2 text-sm">
            📴 離線模式中，操作將暫存於本機
          </div>
        )}
        {children}
        {/* 只保留註冊 SW；已移除任何浮動徽章插入程式 */}
        <RegisterSW />
      </body>
    </html>
  );
}