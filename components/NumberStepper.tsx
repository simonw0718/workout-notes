"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";

type Props = {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: Dispatch<SetStateAction<number>>; // 用 React setter，支援函式更新
};

export default function NumberStepper({
  label,
  value,
  step = 1,
  min = 0,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const holdTimeout = useRef<NodeJS.Timeout | null>(null);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const applyChange = (delta: number) => {
    onChange((prev) => {
      const next = Math.max(min, prev + delta);
      // 避免浮點誤差（像 62.5 ± 2.5）
      return Math.round(next * 1000) / 1000;
    });
  };

  const startHold = (delta: number) => {
    // 立刻觸發一次
    applyChange(delta);
    // 300ms 後開始連續觸發
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => applyChange(delta), 120);
    }, 300);
  };

  const stopHold = () => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  };

  const handleBlur = () => {
    const raw = inputRef.current?.value ?? "";
    const num = Number(raw);
    if (!Number.isNaN(num)) {
      onChange(() => Math.max(min, num));
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3">
      <label className="w-16">{label}</label>

      <button
        onMouseDown={() => startHold(-step)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold(-step)}
        onTouchEnd={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        className="px-3 py-2 border rounded-lg"
      >
        −
      </button>

      <div
        className="w-20 text-center cursor-pointer select-none"
        onClick={() => setEditing(true)}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            defaultValue={value}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBlur();
            }}
            autoFocus
            className="w-full text-center border rounded"
          />
        ) : (
          value
        )}
      </div>

      <button
        onMouseDown={() => startHold(step)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold(step)}
        onTouchEnd={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        className="px-3 py-2 border rounded-lg"
      >
        +
      </button>
    </div>
  );
}
