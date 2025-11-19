// components/NetworkToast.tsx
"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type ToastState = {
  visible: boolean;
  message: string;
  type: "online" | "offline";
};

export default function NetworkToast() {
  const isOnline = useOnlineStatus();
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "online",
  });

  useEffect(() => {
    // 初始載入時不顯示，只有狀態切換時才顯示
    setToast((prev) => {
      // 第一次 render：prev.message === ""，直接跳過顯示
      if (prev.message === "") {
        return {
          visible: false,
          message: isOnline ? "目前為線上模式" : "目前為離線模式，本機暫存中",
          type: isOnline ? "online" : "offline",
        };
      }

      return {
        visible: true,
        message: isOnline
          ? "✅ 已恢復連線"
          : "📴 目前為離線模式，本機暫存中",
        type: isOnline ? "online" : "offline",
      };
    });

    if (toast.visible) return;

    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  if (!toast.visible) return null;

  const bgClass =
    toast.type === "offline" ? "bg-red-600" : "bg-emerald-600";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center z-50">
      <div
        className={`pointer-events-auto px-3 py-2 rounded-full text-xs shadow-lg ${bgClass}`}
      >
        {toast.message}
      </div>
    </div>
  );
}