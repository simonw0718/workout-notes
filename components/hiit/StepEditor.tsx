// /components/hiit/StepEditor.tsx
'use client';

import { useEffect, useState } from 'react';
import type { HiitStep } from '@/lib/hiit/types';
import ExercisePicker from '@/components/hiit/ExercisePicker';

type Props = { value: HiitStep[]; onChange: (v: HiitStep[]) => void };

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
          {/* 第一列：標題 + 從動作庫 + 小計 + 操作鍵（在小螢幕不外溢） */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 左：可縮的輸入與動作庫按鈕 */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <input
                className="flex-1 min-w-0 bg-black border border-white/20 rounded-lg px-3 py-1"
                value={s.title ?? ''}
                onChange={(e) => edit(i, { title: e.target.value })}
                placeholder={`Step ${i + 1} 名稱`}
                aria-label={`Step ${i + 1} 名稱`}
              />
              <button
                className="text-[11px] sm:text-xs px-2 py-1 rounded-lg border border-white/30 hover:bg-white/10 shrink-0 leading-none"
                onClick={() => setPickerIndex(i)}
                aria-label="從動作庫選擇"
              >
                從動作庫
              </button>
            </div>

            {/* 小計 */}
            <div className="text-[11px] sm:text-xs text-white/70 whitespace-nowrap shrink-0">
              小計：{stepTotalText(s)}
            </div>

            {/* 右：操作鍵（緊湊不外溢） */}
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <button className="px-2 py-1 border rounded-lg text-xs" onClick={() => move(i, -1)} aria-label="上移">↑</button>
              <button className="px-2 py-1 border rounded-lg text-xs" onClick={() => move(i, 1)}  aria-label="下移">↓</button>
              <button className="px-2 py-1 border rounded-lg text-xs" onClick={() => del(i)}     aria-label="刪除">刪</button>
            </div>
          </div>

          {/* 參數列 */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3">
            <Num label="Work(秒)" value={s.work_sec ?? 0} min={0} onChange={(v)=>edit(i,{work_sec:v})}/>
            <Num label="Rest(秒)" value={s.rest_sec ?? 0} min={0} onChange={(v)=>edit(i,{rest_sec:v})}/>
            <Num label="Rounds" value={s.rounds ?? 1} min={1} onChange={(v)=>edit(i,{rounds:v})}/>
            <Num label="Sets" value={s.sets ?? 1} min={1} onChange={(v)=>edit(i,{sets:v})}/>
            <Num label="組間休息(秒)" value={s.inter_set_rest_sec ?? 0} min={0}
                 onChange={(v)=>edit(i,{inter_set_rest_sec:v})} className="sm:col-span-2"/>
          </div>
        </div>
      ))}

      <button onClick={push} className="px-3 py-2 rounded-xl border border-white text-white" aria-label="新增步驟">
        ＋ 新增步驟
      </button>

      {/* 抽屜：動作選擇器 */}
      <ExercisePicker open={pickerIndex !== null} onClose={() => setPickerIndex(null)} onPick={handlePick}/>
    </div>
  );
}

/* ---------- 小工具 ---------- */

// 重新編號、固定 mode=time
function reorder(arr: HiitStep[]) {
  return arr.map((s, idx) => ({ ...s, order: idx + 1, mode: 'time' as const }));
}

// 單一步驟時間（毫秒）
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
function formatHMS(ms: number): string { const s = Math.round(ms/1000); const m = Math.floor(s/60); return `${m}:${String(s%60).padStart(2,'0')}`; }
function toInt(v:any, d=0){ const n=Number(v); return Number.isFinite(n)?n:d; }
function clampNum(v:any, f:number){ const n=Number(v); return Number.isFinite(n)?n:f; }

/* ---------- 數字輸入（行動裝置友善） ---------- */
function Num({
  label, value, onChange, min = 0, className = '',
}:{
  label:string; value:number; onChange:(v:number)=>void; min?:number; className?:string;
}) {
  // 允許中間狀態的字串緩衝（避免 number input 立即校正）
  const [text, setText] = useState<string>(String(Number.isFinite(value) ? value : min));

  // 外部 value 變動時同步
  useEffect(() => {
    const v = Number.isFinite(value) ? value : min;
    setText(String(v));
  }, [value, min]);

  // 只接收數字，允許空字串（方便刪除重打）
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value;
    if (/^\d*$/.test(t)) setText(t);
  };

  // 失焦 / Enter / 點 ± 時才做 parse + clamp
  const commit = () => {
    const n = text === '' ? NaN : Number(text);
    const next = Number.isFinite(n) ? Math.max(min, n) : min;
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); commit(); }
  };

  const step = (delta: number) => {
    const cur = text === '' ? (Number.isFinite(value) ? value : min) : Number(text);
    const n = Math.max(min, (Number.isFinite(cur) ? cur : min) + delta);
    setText(String(n));
    if (n !== value) onChange(n);
  };

  const atMin = (Number(text || value) || 0) <= min;

  return (
    <div className={className}>
      <label className="text-xs opacity-70">{label}</label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className="px-2 py-1 border rounded-lg text-sm"
          onClick={() => step(-1)}
          aria-label={`${label} 減少`}
          disabled={atMin}
        >
          −
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="w-full bg-black border border-white/20 rounded-lg px-2 py-1"
          value={text}
          onChange={onInput}
          onBlur={commit}
          onKeyDown={onKeyDown}
          aria-label={label}
        />

        <button
          type="button"
          className="px-2 py-1 border rounded-lg text-sm"
          onClick={() => step(+1)}
          aria-label={`${label} 增加`}
        >
          +
        </button>
      </div>
    </div>
  );
}