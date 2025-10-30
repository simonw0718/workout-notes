// hooks/useBodyScrollLock.ts
import { useEffect } from "react";

/** 在 open=true 時鎖住 body 的滾動，iOS 也能穩。 */
export function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;

    // 保存原樣式
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    // 鎖住滾動（同時避免 iOS 背景位移）
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, [open]);
}