// components/ClientInit.tsx
"use client";

import { useEffect } from "react";
import { ensureRegistered } from "@/lib/sync/auth";
import syncNow from "@/lib/sync/sync";

export default function ClientInit() {
  useEffect(() => {
    (async () => {
      try {
        const r = await ensureRegistered();
        console.log("[client-init] registered:", r);
      } catch (e) {
        console.error("[client-init] ensureRegistered failed:", e);
      }

      // 啟動一次同步（不擋 UI）
      syncNow().catch((e) => console.warn("[client-init] initial sync failed:", e));

      // 網路恢復時自動同步
      const onOnline = () => {
        syncNow().catch((e) => console.warn("[client-init] online sync failed:", e));
      };
      window.addEventListener("online", onOnline);
      return () => window.removeEventListener("online", onOnline);
    })();
  }, []);

  return null;
}