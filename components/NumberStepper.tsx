// components/NumberStepper.tsx
"use client";

type Props = {
  label?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  onEnter?: () => void; // ← 新增
};

export default function NumberStepper({
  label,
  value,
  step = 1,
  min,
  max,
  onChange,
  onEnter,
}: Props) {
  const clamp = (v: number) => {
    if (typeof min === "number" && v < min) v = min;
    if (typeof max === "number" && v > max) v = max;
    return v;
  };

  return (
    <div className="space-y-1">
      {label && <div className="text-sm text-gray-600">{label}</div>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border"
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>

        <input
          type="number"
          className="w-full border rounded-lg px-3 py-2 text-right"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
        />

        <button
          type="button"
          className="px-3 py-2 rounded-lg border"
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}
