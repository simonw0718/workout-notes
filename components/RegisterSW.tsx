// components/RegisterSW.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type SWReg = ServiceWorkerRegistration | null;

export default function RegisterSW() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);
  const regRef = useRef<SWReg>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let unbindControllerChange: (() => void) | null = null;

    const onControllerChange = () => {
      // 新 SW 接管後，重新整理讓新快取生效
      window.location.reload();
    };

    const register = async () => {
      try {
        // 你的 sw.js 放在 /public 根目錄；scope 設為整站
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        regRef.current = reg;

        // 若已有 waiting（表示有新版本），顯示更新提示
        if (reg.waiting) {
          setWaiting(reg.waiting);
          setShow(true);
        }

        // 新 SW 安裝完成 -> 進入 waiting
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;

          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              // 有舊版控制頁面，同時新 SW 安裝就緒
              setWaiting(reg.waiting);
              setShow(true);
            }
          });
        });

        // 當舊 SW 交棒給新 SW
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        unbindControllerChange = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        };
      } catch {
        // 離線或其他原因註冊失敗時，靜默即可
      }
    };

    register();

    return () => {
      if (unbindControllerChange) unbindControllerChange();
    };
  }, []);

  const handleUpdate = () => {
    if (!waiting) return;

    // 要求 waiting SW 立刻啟用
    waiting.postMessage("SKIP_WAITING");

    // iOS/Safari 有時不及時觸發 controllerchange，設置保險
    setTimeout(() => {
      if (!navigator.serviceWorker.controller) {
        window.location.reload();
      }
    }, 1200);
  };

  // 沒有更新就不顯示任何 UI（保持與現有頁面相容）
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-xl bg-black/80 text-white px-4 py-2 shadow-lg z-[1000]">
      <span className="mr-3">有新版本可用</span>
      <button
        onClick={handleUpdate}
        className="rounded-lg bg-white text-black px-3 py-1 hover:bg-gray-100"
      >
        立即更新
      </button>
      <button
        onClick={() => setShow(false)}
        className="ml-2 px-2 py-1 text-sm opacity-80 hover:opacity-100"
        aria-label="dismiss"
      >
        關閉
      </button>
    </div>
  );
}