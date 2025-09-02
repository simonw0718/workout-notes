// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

import RegisterSW from "@/components/RegisterSW";
import InstallPrompt from "@/components/InstallPrompt";

/** 建議把 themeColor 移到 viewport（Next 15） */
export const viewport: Viewport = {
  themeColor: "#111827",
};

export const metadata: Metadata = {
  title: "Workout Notes",
  description: "快速記錄訓練組數、重量、次數；離線可用，支援安裝到主畫面。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS 會優先使用 apple-touch-icon（建議 180×180）
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      // 若另有 180x180 可改用：
      // { url: "/icons/apple-touch-icon.png", sizes: "180x180" }
    ],
    shortcut: "/icons/icon-192.png",
  },
  // ⚠️ NOTE: 這裡不要再放 themeColor，已移到 viewport
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workout Notes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* 保險再放一份連結/Meta，確保各 UA 都吃得到 */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-title" content="Workout Notes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        {/* 不需要再手動放 theme-color，viewport 會注入；若想保險也可保留，但建議移除避免重複 */}
        {/* <meta name="theme-color" content="#111827" /> */}
      </head>
      <body>
        {children}
        {/* 放在 body 最後：SW 註冊 + 安裝提示 */}
        <RegisterSW />
        <InstallPrompt />
      </body>
    </html>
  );
}
