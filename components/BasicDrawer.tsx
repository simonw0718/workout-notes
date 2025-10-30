// components/BasicDrawer.tsx
"use client";

import React, { PropsWithChildren, useEffect, useRef } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type BasicDrawerProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  widthClass?: string; // 例：max-w-screen-sm
};

export default function BasicDrawer({
  open,
  title,
  onClose,
  footer,
  children,
  widthClass = "max-w-screen-sm",
}: PropsWithChildren<BasicDrawerProps>) {
  useBodyScrollLock(open);

  // 阻擋觸控滾動傳遞
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const stop = (e: TouchEvent) => e.stopPropagation();
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, [panelRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
      // 點背景關閉
      onClick={onClose}
      // 防止背景被滾動（安卓某些機種）
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* Drawer 面板（從底部滑出） */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`mt-auto w-full ${widthClass} mx-auto rounded-t-2xl bg-black text-white shadow-xl
                    max-h-[90vh] overflow-y-auto overscroll-contain
                    [--sabb:env(safe-area-inset-bottom)] pb-[max(16px,var(--sabb))]
                    animate-[slideUp_.2s_ease-out]`}
        style={{
          WebkitOverflowScrolling: "touch" as any,
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
          <div className="text-base font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
          >
            關閉
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4">{children}</div>

        {/* Footer */}
        {footer ? (
          <div className="sticky bottom-0 z-10 border-t border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}