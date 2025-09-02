// components/InstallPrompt.tsx
"use client";

import { useEffect, useState } from "react";

// 非標準，但各瀏覽器實作的 beforeinstallprompt 事件型別
interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // 將原生 Event 縮小轉型為 BeforeInstallPromptEvent（避免 any）
      const bip = e as unknown as BeforeInstallPromptEvent;
      // 攔截預設行為，改用自訂 UI
      e.preventDefault();
      setDeferred(bip);
      setVisible(true);
    };

    // 用 EventListener 來符合 Window 的 addEventListener 型別要求
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handler as EventListener,
      );
    };
  }, []);

  if (!visible || !deferred) return null;

  const onInstall = async () => {
    setVisible(false);
    try {
      await deferred.prompt();
      // 可選：結果處理
      // const { outcome } = await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  };

  const onClose = () => setVisible(false);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-xl shadow-lg bg-black text-white px-4 py-3 flex items-center gap-3">
        <span>安裝「Workout Notes」到手機？</span>
        <button
          onClick={onInstall}
          className="px-3 py-1 bg-white text-black rounded"
        >
          安裝
        </button>
        <button onClick={onClose} className="px-2 text-gray-300">
          關閉
        </button>
      </div>
    </div>
  );
}
