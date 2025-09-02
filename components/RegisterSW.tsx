"use client";
import { useEffect, useState } from "react";

type UpdateState = { reg: ServiceWorkerRegistration | null };

export default function RegisterSW() {
  const [updateReady, setUpdateReady] = useState<UpdateState>({ reg: null });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        console.log("[SW] registered:", reg);

        // 1) 如果已經有 waiting（例如你重新整理之後）
        if (reg.waiting) {
          console.log("[SW] already waiting");
          setUpdateReady({ reg });
        }

        // 2) 偵測到新的 SW
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          if (!newSW) return;

          console.log("[SW] updatefound, installing:", newSW);

          newSW.addEventListener("statechange", () => {
            // 當新 SW 進到 waiting，代表可更新
            if (
              newSW.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log('[SW] newSW state: "installed" (waiting)');
              setUpdateReady({ reg });
            }
          });
        });

        // 3) 如果這個頁面目前沒被任何 SW 控制，等 controller 設好
        if (!navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              console.log("[SW] ready (controller set):", reg);
            },
            { once: true },
          );
        }
      } catch (err) {
        console.error("[SW] register failed:", err);
      }
    };

    register();
  }, []);

  const refreshToNew = async () => {
    const reg = updateReady.reg;
    if (!reg || !reg.waiting) return;
    // 通知 waiting 的 SW 直接接管
    reg.waiting.postMessage("SKIP_WAITING");

    // controller 變更後重新載入
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.location.reload();
      },
      { once: true },
    );
  };

  // ✅ 有 waiting 才顯示提示條
  if (!updateReady.reg) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-xl shadow-lg bg-black text-white px-4 py-3 flex items-center gap-3">
        <span>有新版本可用</span>
        <button
          onClick={refreshToNew}
          className="px-3 py-1 rounded-lg bg-white text-black hover:bg-gray-200"
        >
          立即更新
        </button>
      </div>
    </div>
  );
}
