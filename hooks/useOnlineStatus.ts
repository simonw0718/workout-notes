// hooks/useOnlineStatus.ts
"use client";

import { useEffect, useState } from "react";

/**
 * 基於 navigator.onLine + online/offline 事件的簡單 hook。
 * iOS PWA 也支援，適合做輕量級 UI 提示。
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}