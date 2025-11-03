///components/hiit/StepEditor.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HiitStep } from '@/lib/hiit/types';
import ExercisePicker from '@/components/hiit/ExercisePicker';

type Props = {
  value: HiitStep[];
  onChange: (v: HiitStep[]) => void;
};

export default function StepEditor({ value, onChange }: Props) {
  // 內部暫存，並保持與父層同步
  const [steps, setSteps] = useState<HiitStep[]>(value);
  useEffect(() => setSteps(value), [value]);

  // 動作庫抽屜：目前作用的 step 索引
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const push = () => {
    const s: HiitStep = {
      order: steps.length + 1,
      title: `Step ${steps.length + 1}`,
      mode: 'time',
      work_sec: 20,
      rest_sec: 10,
      rounds: 1,
      sets: 1,
      inter_set_rest_sec: 0,
    };
    const next = [...steps, s];
    setSteps(next);
    onChange(reorder(next));
  };

  const del = (i: number) => {
    const next = steps.filter((_, idx) => idx !== i);
    setSteps(next);
    onChange(reorder(next));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
    onChange(reorder(next));
  };

  const edit = (i: number, patch: Partial<HiitStep>) => {
    const next = steps.slice();
    next[i] = { ...next[i], ...patch };
    setSteps(next);
    onChange(reorder(next));
  };

  // 從「動作庫」選擇後帶入：標題 + 預設秒數
  const handlePick = (ex: any) => {
    if (pickerIndex == null) return;
    edit(pickerIndex, {
      title: ex?.name || steps[pickerIndex].title,
      work_sec: clampNum(ex?.defaultValue, steps[pickerIndex].work_sec ?? 20),
    });
  };

  // 每個步驟小計（即時顯示）
  const stepTotalText = (s: HiitStep) => formatHMS(stepMs(s));

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={i} className="rounded-xl border border-white/20 p-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center gap-2">
              <input
                className="flex-1 bg-black border border-white/20 rounded-lg px-3 py-1"
                value={s.title ?? ''}
                onChange={(e) => edit(i, { title: e.target.value })}
                placeholder={`Step ${i + 1} 名稱`}
              />
              <button
                className="text-xs px-2 py-1 rounded-lg border border-white/30 hover:bg-white/10"
                onClick={() => setPickerIndex(i)}
              >
                從動作庫
              </button>
            </div>

            {/* 小計 */}
            <div className="text-xs text-white/70 whitespace-nowrap">小計：{stepTotalText(s)}</div>

            <div className="flex gap-2">
              <button className="px-2 py-1 border rounded-lg" onClick={() => move(i, -1)} aria-label="上移">↑</button>
              <button className="px-2 py-1 border rounded-lg" onClick={() => move(i, 1)}  aria-label="下移">↓</button>
              <button className="px-2 py-1 border rounded-lg" onClick={() => del(i)}     aria-label="刪除">刪</button>
            </div>
          </div>

          {/* 固定為計時模式（time） */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3">
            <Num
              label="Work(秒)"
              value={s.work_sec ?? 0}
              min={0}
              onChange={(v)=>edit(i,{work_sec:v})}
            />
            <Num
              label="Rest(秒)"
              value={s.rest_sec ?? 0}
              min={0}
              onChange={(v)=>edit(i,{rest_sec:v})}
            />
            <Num
              label="Rounds"
              value={s.rounds ?? 1}
              min={1}
              onChange={(v)=>edit(i,{rounds:v})}
            />
            <Num
              label="Sets"
              value={s.sets ?? 1}
              min={1}
              onChange={(v)=>edit(i,{sets:v})}
            />
            <Num
              label="組間休息(秒)"
              value={s.inter_set_rest_sec ?? 0}
              min={0}
              onChange={(v)=>edit(i,{inter_set_rest_sec:v})}
              className="sm:col-span-2"
            />
          </div>
        </div>
      ))}

      <button onClick={push} className="px-3 py-2 rounded-xl border border-white text-white">
        ＋ 新增步驟
      </button>

      {/* 抽屜：動作選擇器 */}
      <ExercisePicker
        open={pickerIndex !== null}
        onClose={() => setPickerIndex(null)}
        onPick={handlePick}
      />
    </div>
  );
}

/* ---------- 小工具 ---------- */

// 重新編號、固定 mode=time
function reorder(arr: HiitStep[]) {
  return arr.map((s, idx) => ({ ...s, order: idx + 1, mode: 'time' as const }));
}

// 單一步驟時間（毫秒）
// 每組：rounds * work + (rounds-1) * rest
// 全部：sets * perSet + (sets-1) * interSetRest
function stepMs(s: HiitStep): number {
  const work  = toInt(s.work_sec, 0);
  const rest  = toInt(s.rest_sec, 0);
  const r     = Math.max(1, toInt(s.rounds, 1));
  const sets  = Math.max(1, toInt(s.sets, 1));
  const inter = toInt(s.inter_set_rest_sec, 0);
  const perSet = r * work + Math.max(0, r - 1) * rest;
  const totalSec = sets * perSet + Math.max(0, sets - 1) * inter;
  return totalSec * 1000;
}

function formatHMS(ms: number): string {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function clampNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function Num({
  label, value, onChange, min = 0, className = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs opacity-70">{label}</label>
      <input
        type="number"
        className="w-full bg-black border border-white/20 rounded-lg px-2 py-1"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      />
    </div>
  );
}