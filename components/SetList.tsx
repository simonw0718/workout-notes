"use client";

import { useMemo, useState } from "react";
import type { SetRecord } from "@/lib/models/types";

type Props = {
  items: SetRecord[];
  onDelete: (id: string) => void;
  onUndo?: () => void;
  showUndoHint?: boolean;
};

export default function SetList({
  items,
  onDelete,
  onUndo,
  showUndoHint,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      items.map((s, idx) => {
        const unit = s.unit ?? "lb";
        const rpeTxt = s.rpe != null ? ` RPE${s.rpe}` : ""; // ← 新增
        return {
          ...s,
          displayNo: items.length - idx,
          label: `${s.weight}${unit}×${s.reps}${rpeTxt}`, // ← 改這
          time: new Date(s.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      }),
    [items],
  );

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">已記錄</h3>

      {rows.length === 0 && <p className="text-sm text-gray-500">尚無紀錄</p>}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-xl border p-3"
          >
            <div className="text-sm">
              <div className="font-medium">
                #{r.displayNo} {r.label}
              </div>
              <div className="text-xs text-gray-500">{r.time}</div>
            </div>

            {confirmId === r.id ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onDelete(r.id);
                    setConfirmId(null);
                  }}
                  className="px-2 py-1 text-white bg-red-500 rounded-md"
                >
                  確認刪除
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="px-2 py-1 border rounded-md"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId(r.id)}
                className="px-2 py-1 border rounded-md"
              >
                刪除
              </button>
            )}
          </li>
        ))}
      </ul>

      {showUndoHint && onUndo && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          已刪除一筆，5 秒內可
          <button onClick={onUndo} className="ml-1 underline">
            撤銷
          </button>
        </div>
      )}
    </div>
  );
}
