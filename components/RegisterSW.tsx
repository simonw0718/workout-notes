//components/RegisterSW.tsx
"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    const isSecure =
      typeof window !== "undefined" &&
      (location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1");

    if (!("serviceWorker" in navigator) || !isSecure) {
      console.log("[SW] skip (insecure or unsupported)");
      return;
    }

    const RELOAD_FLAG = "sw-hard-reload-once";
    const COMMON_ROUTES = [
      "/",
      "/history",
      "/settings",
      "/sync",
      "/summary",
      "/diagnostics",
    ];

    async function warmFromManifest() {
      if (!navigator.serviceWorker.controller) return;
      try {
        const res = await fetch("/precache-assets.json", {
          cache: "no-cache",
        });
        if (!res.ok) return;
        const json = await res.json();
        const list: string[] = Array.isArray(json)
          ? json
          : (json.assets ?? []);
        const origin = location.origin;
        const urls = Array.from(
          new Set(
            list.map((p) => (p.startsWith("http") ? p : origin + p))
          )
        );
        console.log("[SW] warm-from-manifest urls:", urls.length);
        navigator.serviceWorker.controller!.postMessage({
          type: "WARM_CACHE",
          urls,
        });
      } catch {
        // 靜默失敗即可，之後可再視狀況補抓
      }
    }

    async function warmRoutes() {
      if (!navigator.serviceWorker.controller) return;
      const urls = COMMON_ROUTES.map((p) =>
        new URL(p, location.origin).toString()
      );
      navigator.serviceWorker.controller!.postMessage({
        type: "WARM_CACHE",
        urls,
      });
    }

    // SW 啟用後會送 READY，這裡接到後幫忙預熱常用路由與 chunks
    navigator.serviceWorker.addEventListener("message", (ev) => {
      if (ev?.data === "READY") {
        setTimeout(() => {
          warmFromManifest();
          warmRoutes();
        }, 120);
      }
    });

    // controllerchange：例如新 SW 接手控制
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      setTimeout(() => {
        warmFromManifest();
        warmRoutes();
      }, 150);
    });

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log("[SW] registered:", reg.scope);

        // 不再主動呼叫 SKIP_WAITING：
        // - 新版 SW 會在舊版關掉後自動接手，符合「靜默更新、下次重開才生效」。

        // 等待 SW 準備好（至少有一個 active worker）
        await navigator.serviceWorker.ready;

        // 首次註冊時，可能沒有 controller（舊頁還沒 reload）
        if (!navigator.serviceWorker.controller) {
          const once = sessionStorage.getItem(RELOAD_FLAG);
          if (!once) {
            sessionStorage.setItem(RELOAD_FLAG, "1");
            console.log("[SW] forcing one-time reload to gain control");
            location.reload();
            return;
          } else {
            console.warn("[SW] still no controller after reload");
          }
        } else {
          // 有 controller → 直接預熱
          warmFromManifest();
          warmRoutes();
        }

        // 回前景 / 網路恢復時再補暖（iOS PWA 常見情境）
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            setTimeout(() => {
              warmFromManifest();
              warmRoutes();
            }, 300);
          }
        });
        window.addEventListener("online", () => {
          setTimeout(() => {
            warmFromManifest();
            warmRoutes();
          }, 200);
        });
      } catch (err) {
        console.warn("[SW] register failed:", err);
      }
    })();
  }, []);

  return null;
}