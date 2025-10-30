// components/WheelOptionsDrawer.tsx
// 說明：設定頁用的抽屜，提供新增/刪除/上下移/編輯（inline）功能

"use client";
import { useEffect, useState } from "react";
import { loadWheels, saveWheels } from "@/lib/db/wheels";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void; // 儲存後回呼（設定頁可同步刷新）
};

export default function WheelOptionsDrawer({ open, onClose, onSaved }: Props) {
  const [equip, setEquip] = useState<string[]>([]);
  const [moves, setMoves] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { equip, moves } = await loadWheels();
      setEquip(equip.slice());
      setMoves(moves.slice());
    })();
  }, [open]);

  const handleSave = async () => {
    if (busy) return;
    try {
      setBusy(true);
      await saveWheels({ equip, moves });
      onSaved?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* 背景 */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* 右側抽屜 */}
      <div
        className={`absolute right-0 top-0 h-full w-[min(640px,100%)] bg-black border-l border-white/10 p-4 sm:p-6 transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-lg font-semibold">編輯滾輪選項</h2>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border px-3 py-1 text-sm hover:bg-white/10"
              onClick={onClose}
            >
              關閉
            </button>
            <button
              className="rounded-xl border px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-50"
              disabled={busy}
              onClick={handleSave}
            >
              儲存
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <ListEditor
            title="器材（左滾輪）"
            items={equip}
            onChange={setEquip}
            placeholder="新增器材…（例：啞鈴）"
          />
          <ListEditor
            title="常見動作（右滾輪）"
            items={moves}
            onChange={setMoves}
            placeholder="新增動作…（例：胸推）"
          />
        </div>

        <p className="text-xs text-white/50 mt-4">
          小提醒：重複或空白項目會在儲存時自動清理；順序會影響下拉選單顯示順序。
        </p>
      </div>
    </div>
  );
}

/** 可重用的清單編輯器（上移/下移/刪除/inline 編輯 + 最後一列新增） */
function ListEditor({
  title,
  items,
  onChange,
  placeholder,
}: {
  title: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const setAt = (i: number, v: string) => {
    const next = items.slice();
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => {
    const next = items.slice();
    next.splice(i, 1);
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addOne = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, t]);
    setDraft("");
  };

  return (
    <div className="rounded-2xl border border-white/10 p-3 sm:p-4">
      <h3 className="font-medium mb-2">{title}</h3>
      <ul className="space-y-2 max-h-[52vh] overflow-auto pr-1">
        {items.map((v, i) => (
          <li key={`${v}-${i}`} className="flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border border-white/15 bg-transparent px-2 py-2"
              value={v}
              onChange={(e) => setAt(i, e.target.value)}
            />
            <div className="flex items-center gap-1">
              <button
                className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                onClick={() => move(i, -1)}
                title="上移"
              >
                ↑
              </button>
              <button
                className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                onClick={() => move(i, +1)}
                title="下移"
              >
                ↓
              </button>
              <button
                className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                onClick={() => removeAt(i)}
                title="刪除"
              >
                刪
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-white/15 bg-transparent px-2 py-2"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addOne();
          }}
        />
        <button
          className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
          onClick={addOne}
        >
          新增
        </button>
      </div>
    </div>
  );
}