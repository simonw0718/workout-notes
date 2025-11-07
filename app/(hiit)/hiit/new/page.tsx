///app/(hiit)/hiit/new/page.tsx
'use client';
import { useMemo, useState, useEffect } from 'react';
import { createWorkout } from '@/lib/hiit/api';
import StepEditor from '@/components/hiit/StepEditor';
import type { HiitStep } from '@/lib/hiit/types';
import BackButton from '@/components/BackButton';
import { computeWorkoutMs, formatHMS } from '@/lib/hiit/time';

export default function New() {
  const [name, setName] = useState('My HIIT');
  const [warmup, setWarmup] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // 預設 rounds=1
  const [steps, setSteps] = useState<HiitStep[]>([{
    order: 1, title: 'Step 1', mode: 'time', work_sec: 20, rest_sec: 10, rounds: 1, sets: 1, inter_set_rest_sec: 0
  }]);

  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const mapSteps = () => steps.map((s, i) => ({
    order: s.order ?? (i + 1),
    title: (s.title?.trim() || `Step ${i + 1}`),
    work_sec: Number.isFinite(Number(s.work_sec)) ? Number(s.work_sec) : 20,
    rest_sec: Number.isFinite(Number(s.rest_sec)) ? Number(s.rest_sec) : 10,
    rounds: Math.max(1, Number.isFinite(Number(s.rounds)) ? Number(s.rounds) : 1),
    sets:   Math.max(1, Number.isFinite(Number(s.sets))   ? Number(s.sets)   : 1),
    inter_set_rest_sec: Math.max(0, Number.isFinite(Number(s.inter_set_rest_sec)) ? Number(s.inter_set_rest_sec) : 0),
  }));

  const totalText = useMemo(() => {
    const dto = { warmup_sec: warmup, cooldown_sec: cooldown, steps: mapSteps() };
    try { return formatHMS(computeWorkoutMs(dto as any)); }
    catch { return '—'; }
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

      <div className="text-sm opacity-80">總時長：{totalText}</div>

      <div className="space-y-2">
        <label className="block text-sm text-white/80">名稱</label>
        <input
          className="border rounded-xl px-3 py-2 w-full bg-black text-white border-white/20"
          value={name}
          onChange={e=>setName(e.target.value)}
        />
      </div>

      {/* Warmup / Cooldown 使用可清空 + 有 ± 的數字元件 */}
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Warmup 秒" value={warmup} min={0} onChange={setWarmup}/>
        <NumField label="Cooldown 秒" value={cooldown} min={0} onChange={setCooldown}/>
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

/* ------- 可清空 + ± 數字欄（與 StepEditor.Num 一致行為） ------- */
function NumField({
  label, value, onChange, min = 0, className = '',
}:{
  label:string; value:number; onChange:(v:number)=>void; min?:number; className?:string;
}) {
  const [text, setText] = useState<string>(String(Number.isFinite(value) ? value : min));
  useEffect(() => { setText(String(Number.isFinite(value) ? value : min)); }, [value, min]);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value;
    if (/^\d*$/.test(t)) setText(t);    // 只允許數字或空字串
  };

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
      <div className="text-sm mb-1 text-white/80">{label}</div>
      <div className="flex items-stretch gap-2">
        <button type="button" className="px-2 py-1 border rounded-lg text-sm" onClick={() => step(-1)} disabled={atMin}>−</button>
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
        <button type="button" className="px-2 py-1 border rounded-lg text-sm" onClick={() => step(+1)}>+</button>
      </div>
    </div>
  );
}