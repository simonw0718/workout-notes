// components/WheelOptionsDrawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BasicDrawer from "./BasicDrawer";

type WheelOptionsDrawerProps = {
  open: boolean;
  onClose: () => void;
  leftOptions: string[];   // 器材（左滾輪）
  rightOptions: string[];  // 常見動作（右滾輪）
  onSave: (left: string[], right: string[]) => void;
};

export default function WheelOptionsDrawer({
  open,
  onClose,
  leftOptions,
  rightOptions,
  onSave,
}: WheelOptionsDrawerProps) {
  const [left, setLeft] = useState<string[]>(leftOptions);
  const [right, setRight] = useState<string[]>(rightOptions);
  const [leftNew, setLeftNew] = useState("");
  const [rightNew, setRightNew] = useState("");

  // ✅ 開啟抽屜時，用外部最新資料覆蓋內部編輯狀態（避免不同步）
  useEffect(() => {
    if (!open) return;
    setLeft(leftOptions);
    setRight(rightOptions);
    setLeftNew("");
    setRightNew("");
  }, [open, leftOptions, rightOptions]);

  const moveUp = (arr: string[], i: number) => {
    if (i <= 0) return arr;
    const c = arr.slice();
    [c[i - 1], c[i]] = [c[i], c[i - 1]];
    return c;
  };
  const moveDown = (arr: string[], i: number) => {
    if (i >= arr.length - 1) return arr;
    const c = arr.slice();
    [c[i], c[i + 1]] = [c[i + 1], c[i]];
    return c;
  };

  const Row = (list: string[], setList: (v: string[]) => void) =>
    (text: string, i: number) => (
      <div key={`${text}-${i}`} className="flex items-center gap-2 py-2">
        <div className="flex-1 rounded-xl border border-white/20 px-3 py-2 bg-transparent">
          {text}
        </div>
        <button
          className="rounded-xl border border-white/25 px-2 py-1 hover:bg-white/10"
          onClick={() => setList(moveUp(list, i))}
          aria-label="上移"
          title="上移"
        >↑</button>
        <button
          className="rounded-xl border border-white/25 px-2 py-1 hover:bg-white/10"
          onClick={() => setList(moveDown(list, i))}
          aria-label="下移"
          title="下移"
        >↓</button>
        <button
          className="rounded-xl border border-red-500 text-red-400 px-2 py-1 hover:bg-red-500/10"
          onClick={() => setList(list.filter((_, idx) => idx !== i))}
          aria-label="刪除"
          title="刪除"
        >刪</button>
      </div>
    );

  const addIfValid = (val: string, list: string[], setList: (v: string[]) => void) => {
    const v = (val ?? "").trim();
    if (!v) return;
    if (list.includes(v)) return;
    setList([...list, v]);
  };

  return (
    <BasicDrawer
      open={open}
      onClose={onClose}
      title="編輯滾輪選項"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/20 px-3 py-2 hover:bg-white/10"
          >
            取消
          </button>
          <button
            onClick={() => { onSave(left, right); onClose(); }}
            className="rounded-xl bg-white text-black px-4 py-2 font-medium"
          >
            儲存
          </button>
        </div>
      }
      widthClass="max-w-screen-sm"
    >
      {/* 左滾輪：器材 */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">器材（左滾輪）</h3>
        <div className="space-y-2">
          {left.map(Row(left, setLeft))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={leftNew}
            onChange={(e) => setLeftNew(e.target.value)}
            placeholder="新增器材…（例：啞鈴）"
            className="flex-1 rounded-xl border border-white/20 bg-transparent px-3 py-2"
          />
          <button
            onClick={() => { addIfValid(leftNew, left, setLeft); setLeftNew(""); }}
            className="rounded-xl border border-white/25 px-3 py-2 hover:bg白/10"
          >
            新增
          </button>
        </div>
      </section>

      <hr className="my-5 border-white/10" />

      {/* 右滾輪：常見動作 */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">常見動作（右滾輪）</h3>
        <div className="space-y-2">
          {right.map(Row(right, setRight))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={rightNew}
            onChange={(e) => setRightNew(e.target.value)}
            placeholder="新增動作…（例：胸推）"
            className="flex-1 rounded-xl border border-white/20 bg-transparent px-3 py-2"
          />
          <button
            onClick={() => { addIfValid(rightNew, right, setRight); setRightNew(""); }}
            className="rounded-xl border border-white/25 px-3 py-2 hover:bg白/10"
          >
            新增
          </button>
        </div>
      </section>
    </BasicDrawer>
  );
}