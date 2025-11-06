// /app/(hiit)/hiit/new/page.tsx
'use client';
import { useMemo, useState } from 'react';
import { createWorkout } from '@/lib/hiit/api';
import StepEditor from '@/components/hiit/StepEditor';
import type { HiitStep } from '@/lib/hiit/types';
import BackButton from '@/components/BackButton';
import { computeWorkoutMs, formatHMS } from '@/lib/hiit/time';

export default function New() {
  const [name, setName] = useState('My HIIT');
  const [warmup, setWarmup] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [steps, setSteps] = useState<HiitStep[]>([{
    order: 1, title: 'Step 1', mode: 'time', work_sec: 20, rest_sec: 10, rounds: 8, sets: 1, inter_set_rest_sec: 0
  }]);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const mapSteps = () => steps.map((s, i) => ({
    order: s.order ?? (i + 1),
    title: (s.title?.trim() || `Step ${i + 1}`),
    work_sec: s.work_sec ?? 20,
    rest_sec: s.rest_sec ?? 10,
    rounds: s.rounds ?? 1,
    sets: s.sets ?? 1,
    inter_set_rest_sec: s.inter_set_rest_sec ?? 0,
  }));

  // ⏱️ 新建頁即時計算總時長
  const totalText = useMemo(() => {
    const dto = {
      warmup_sec: warmup,
      cooldown_sec: cooldown,
      steps: mapSteps(),
    };
    return formatHMS(computeWorkoutMs(dto as any));
  }, [warmup, cooldown, steps]);

  async function saveOnly() {
    setBusy(true);
    try {
      const payload = { name, warmup_sec: warmup, cooldown_sec: cooldown, steps: mapSteps() };
      const w = await createWorkout(payload as any);
      if (!w?.id) throw new Error('API 沒回 id');
      setSavedId(w.id);
      alert('已儲存');
    } catch (e:any) {
      alert(`儲存失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-4 text-white">
      <div className="mb-2"><BackButton /></div>
      <h1 className="text-xl font-semibold font-title text-center">新建 HIIT</h1>

      {/* 總時長 */}
      <div className="text-sm opacity-80">總時長：{totalText}</div>

      <div className="space-y-2">
        <label className="block text-sm text-white/80">名稱</label>
        <input
          className="border rounded-xl px-3 py-2 w-full bg黑 text白 border-white/20"
          value={name}
          onChange={e=>setName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm mb-1 text-white/80">Warmup 秒</div>
          <input
            type="number"
            className="border rounded-xl px-3 py-2 w-full bg-black text-white border-white/20"
            value={warmup}
            onChange={e=>setWarmup(+e.target.value)}
          />
        </div>
        <div>
          <div className="text-sm mb-1 text-white/80">Cooldown 秒</div>
          <input
            type="number"
            className="border rounded-xl px-3 py-2 w-full bg-black text-white border-white/20"
            value={cooldown}
            onChange={e=>setCooldown(+e.target.value)}
          />
        </div>
      </div>

      <StepEditor value={steps} onChange={setSteps} />

      <div className="flex gap-2">
        <button onClick={saveOnly} disabled={busy} className="px-4 py-2 rounded-xl border border-white">
          {busy ? '儲存中…' : '儲存'}
        </button>
      </div>

      {savedId && (
        <div className="text-sm opacity-80">
          已儲存。你可以到 <a className="underline" href="/hiit">HIIT 清單</a> 查看或播放。
        </div>
      )}
    </div>
  );
}