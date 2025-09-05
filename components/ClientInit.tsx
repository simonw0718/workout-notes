// components/ClientInit.tsx
"use client";

import { useEffect } from "react";
import { getMeta } from "@/lib/db/meta"; // 你原本的 meta 存取
import { syncNow } from "@/lib/sync/sync";

export default function ClientInit() {
  useEffect(() => {
    (async () => {
      try {
        // 讀出本機的 deviceId / token / lastServerVersion
        const meta = await getMeta();
        if (!meta?.deviceId || !meta?.token) {
          // 沒登入就不主動同步
          return;
        }

        // 初始同步：帶空 changes，避免 422
        await syncNow({
          deviceId: meta.deviceId,
          token: meta.token,
          lastVersion: meta.lastServerVersion ?? 0,
          changes: { sessions: [], exercises: [], sets: [] },
        });

        // 成功就結束；若需更新 lastServerVersion / 寫回 meta，自行在這裡接續
      } catch (e) {
        console.error("[client-init] initial sync failed:", e);
      }
    })();
  }, []);

  return null;
}