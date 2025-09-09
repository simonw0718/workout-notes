// app/layout.tsx
"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { offlineChanged } from "@/lib/bus";
import RegisterSW from "@/components/RegisterSW";
// ⛔ 已移除：import DebugFloating from "@/components/DebugFloating";

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

  // 右下角 SW 小標（維持你現有版本）
  useEffect(() => {
    let box = document.getElementById("sw-badge") as HTMLDivElement | null;
    if (!box) {
      box = document.createElement("div");
      box.id = "sw-badge";
      box.style.position = "fixed";
      box.style.right = "10px";
      box.style.bottom = "10px";
      box.style.zIndex = "2147483647";
      box.style.padding = "6px 10px";
      box.style.borderRadius = "9999px";
      box.style.fontSize = "12px";
      box.style.fontFamily =
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      box.style.background = "rgba(0,0,0,0.7)";
      box.style.color = "#fff";
      box.style.border = "1px solid rgba(255,255,255,0.15)";
      box.style.backdropFilter = "blur(4px)";
      document.body.appendChild(box);
    }

    let stop = false;
    async function updateBadge() {
      try {
        const versList = await caches.keys();
        const cacheName =
          versList.find((k) => k.startsWith("workout-cache-")) ??
          (versList[0] ?? "none");

        let swState = "none";
        if ("serviceWorker" in navigator) {
          if (navigator.serviceWorker.controller) swState = "controlled";
          else {
            const regs = await navigator.serviceWorker.getRegistrations();
            if (regs.length > 0) swState = "registered";
          }
        }

        if (!stop && box) box.textContent = `SW: ${swState} · ${cacheName}`;
      } catch {
        if (!stop && box) box.textContent = `SW: -`;
      }
    }

    updateBadge();
    const t = setInterval(updateBadge, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return (
    <html lang="zh-Hant" className="h-full bg-black text-white">
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
        {/* ⛔ 已移除：<DebugFloating /> */}
        <RegisterSW />
      </body>
    </html>
  );
}