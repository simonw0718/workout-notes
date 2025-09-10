// components/NumberStepper.tsx
"use client";
import React from "react";

type Props = {
  label?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  onEnter?: () => void;
  /** 針對暗色區塊可傳入自訂 input 樣式（例如白底黑字 + 白框） */
  classNameInput?: string;
};

export default function NumberStepper({
  label,
  value,
  step = 1,
  min,
  max,
  onChange,
  onEnter,
  classNameInput = "",
}: Props) {
  const apply = (next: number) => {
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    onChange(next);
  };
  const dec = () => apply(value - step);
  const inc = () => apply(value + step);

  return (
    <div className="space-y-1">
      {label && <div className="text-sm text-white/80 sm:text-gray-600">{label}</div>}
      <div className="flex items-center gap-3">
        {/* 減號固定寬度 */}
        <button
          type="button"
          onClick={dec}
          className="w-12 h-12 rounded-xl border border-white/50 sm:border-gray-300 grid place-items-center text-lg font-medium hover:bg-white/10 sm:hover:bg-gray-50 active:scale-[0.98] transition"
          aria-label="decrease"
        >
          −{step}
        </button>

        {/* 數值：固定寬度 + 等寬字元 + 白框 */}
        <input
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          inputMode="numeric"
          className={[
            "h-12 w-24 rounded-xl border text-center text-lg outline-none font-mono tabular-nums",
            "border-white/60 bg-transparent text-white placeholder-white/60",
            "sm:border-gray-300 sm:text-gray-900 sm:bg-white",
            classNameInput,
          ].join(" ")}
        />

        {/* 加號固定寬度 */}
        <button
          type="button"
          onClick={inc}
          className="w-12 h-12 rounded-xl border border-white/50 sm:border-gray-300 grid place-items-center text-lg font-medium hover:bg-white/10 sm:hover:bg-gray-50 active:scale-[0.98] transition"
          aria-label="increase"
        >
          +{step}
        </button>
      </div>
    </div>
  );
}