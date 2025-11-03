// /components/hiit/StepEditor.tsx
'use client';
import { useState } from 'react';
import type { HiitStep } from '@/lib/hiit/types';
import { computeStepMs, formatHMS } from '@/lib/hiit/time';

type Props = {
  value: HiitStep[];
  onChange: (v: HiitStep[]) => void;
};

export default function StepEditor({ value, onChange }: Props) {
  const [steps, setSteps] = useState<HiitStep[]>(value);

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
    setSteps(next); onChange(reorder(next));
  };

  const del = (i: number) => {
    const next = steps.filter((_, idx) => idx !== i);
    setSteps(next); onChange(reorder(next));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next); onChange(reorder(next));
  };

  const edit = (i: number, patch: Partial<HiitStep>) => {
    const next = steps.slice();
    next[i] = { ...next[i], ...patch };
    setSteps(next); onChange(reorder(next));
  };

  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const stepMs = computeStepMs({
          work_sec: s.work_sec ?? 0,
          rest_sec: s.rest_sec ?? 0,
          rounds: s.rounds ?? 1,
          sets: s.sets ?? 1,
          inter_set_rest_sec: s.inter_set_rest_sec ?? 0,
        });
        const stepText = formatHMS(stepMs);

        return (
          <div key={i} className="rounded-xl border border-white/20 p-3 text-white">
            <div className="flex items-center justify-between gap-2">
              <input
                className="bg-black border border-white/20 rounded-lg px-3 py-1 w-1/2"
                value={s.title ?? ''}
                onChange={e => edit(i, { title: e.target.value })}
                placeholder={`Step ${i + 1} 名稱`}
              />
              {/* 每步驟合計 */}
              <div className="text-xs opacity-80">
                合計：{stepText}
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 border rounded-lg" onClick={() => move(i, -1)}>↑</button>
                <button className="px-2 py-1 border rounded-lg" onClick={() => move(i, 1)}>↓</button>
                <button className="px-2 py-1 border rounded-lg" onClick={() => del(i)}>刪</button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3">
              {/* 固定 time 模式（已決議不使用 reps） */}
              <div>
                <label className="text-xs opacity-70">Work(秒)</label>
                <input
                  type="number"
                  className="w-full bg-black border border-white/20 rounded-lg px-2 py-1"
                  value={s.work_sec ?? 0}
                  onChange={e => edit(i, { work_sec: +e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Rest(秒)</label>
                <input
                  type="number"
                  className="w-full bg-black border border-white/20 rounded-lg px-2 py-1"
                  value={s.rest_sec ?? 0}
                  onChange={e => edit(i, { rest_sec: +e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Rounds</label>
                <input
                  type="number"
                  className="w-full bg-black border border-white/20 rounded-lg px-2 py-1"
                  value={s.rounds ?? 1}
                  onChange={e => edit(i, { rounds: +e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Sets</label>
                <input
                  type="number"
                  className="w-full bg-black border border-white/20 rounded-lg px-2 py-1"
                  value={s.sets ?? 1}
                  onChange={e => edit(i, { sets: +e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs opacity-70">組間休息(秒)</label>
                <input
                  type="number"
                  className="w-full bg-black border border-white/20 rounded-lg px-2 py-1"
                  value={s.inter_set_rest_sec ?? 0}
                  onChange={e => edit(i, { inter_set_rest_sec: +e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      })}

      <button onClick={push} className="px-3 py-2 rounded-xl border border-white text-white">＋ 新增步驟</button>
    </div>
  );
}

function reorder(arr: HiitStep[]) {
  return arr.map((s, idx) => ({ ...s, order: idx + 1 }));
}