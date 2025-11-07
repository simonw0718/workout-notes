///app/(hiit)/hiit/edit/page.tsx

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import StepEditor from '@/components/hiit/StepEditor';
import type { HiitStep } from '@/lib/hiit/types';
import { getWorkout, updateWorkout } from '@/lib/hiit/api';
import { computeWorkoutMs, formatHMS } from '@/lib/hiit/time';

function clamp0(v: any) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; }

function EditHiitInner() {
  const sp = useSearchParams();
  const wid = sp.get('wid') || '';

  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [name, setName]         = useState('');
  const [warmup, setWarmup]     = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [steps, setSteps]       = useState<HiitStep[]>([]);

  useEffect(() => {
    if (!wid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const w = await getWorkout(wid);
        if (!alive) return;

        setName(w.name ?? '');
        setWarmup(Number(w.warmup_sec ?? 0));
        setCooldown(Number(w.cooldown_sec ?? 0));

        const mapped: HiitStep[] = (w.steps ?? []).map((s: any) => ({
          order: s.order,
          title: s.title,
          mode: 'time',
          work_sec: Number(s.work_sec ?? 40),
          rest_sec: Number(s.rest_sec ?? 20),
          rounds: Math.max(1, Number(s.rounds ?? 1)),
          sets: Math.max(1, Number(s.sets ?? 1)),
          inter_set_rest_sec: Number(s.inter_set_rest_sec ?? 0),
        }));
        setSteps(mapped);
      } catch (e: any) {
        alert(`載入失敗：${e?.message ?? e}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [wid]);

  const totalText = useMemo(() => {
    const dto = {
      id: wid,
      name,
      warmup_sec: warmup,
      cooldown_sec: cooldown,
      steps: steps.map((s, i) => ({
        order: s.order ?? (i + 1),
        title: s.title?.trim() || `Step ${i + 1}`,
        work_sec: s.work_sec ?? 40,
        rest_sec: s.rest_sec ?? 20,
        rounds: Math.max(1, s.rounds ?? 1),
        sets: Math.max(1, s.sets ?? 1),
        inter_set_rest_sec: s.inter_set_rest_sec ?? 0,
      })),
    };
    try { return formatHMS(computeWorkoutMs(dto as any)); }
    catch { return '—'; }
  }, [wid, name, warmup, cooldown, steps]);

  const buildPayload = () => ({
    name,
    warmup_sec: clamp0(warmup),
    cooldown_sec: clamp0(cooldown),
    steps: steps.map((s, i) => ({
      order: s.order ?? (i + 1),
      title: s.title?.trim() || `Step ${i + 1}`,
      work_sec: clamp0(s.work_sec ?? 40),
      rest_sec: clamp0(s.rest_sec ?? 20),
      rounds: Math.max(1, Number(s.rounds ?? 1)),
      sets: Math.max(1, Number(s.sets ?? 1)),
      inter_set_rest_sec: clamp0(s.inter_set_rest_sec ?? 0),
    })),
  });

  const handleSave = async () => {
    if (!wid) return;
    setBusy(true);
    try {
      await updateWorkout(wid, buildPayload());
      alert('已儲存修改');
    } catch (e: any) {
      alert(`儲存失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAndPlay = async () => {
    if (!wid) return;
    setBusy(true);
    try {
      await updateWorkout(wid, buildPayload());
      location.href = `/hiit/preview?wid=${encodeURIComponent(wid)}`;
    } catch (e: any) {
      alert(`儲存失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!wid) return <div className="p-4 text-sm text-white/80">缺少 wid。</div>;
  if (loading) return <div className="p-4 text-white">載入中…</div>;

  return (
    <div className="p-4 space-y-4 text-white">
      <div className="mb-2">
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) history.back();
            else location.href = '/hiit';
          }}
          className="px-3 py-1 rounded-xl border border-white/60 text-white/90"
        >
          ← 上一頁
        </button>
      </div>

      <h1 className="text-xl font-semibold font-title text-center">編輯 HIIT</h1>

      <div className="text-sm opacity-80">總時長：{totalText}</div>

      <div className="space-y-2">
        <label className="block text-sm text-white/80">名稱</label>
        <input
          className="border rounded-xl px-3 py-2 w-full bg-black text-white border-white/20"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />
      </div>

      {/* Warmup / Cooldown 換成可清空 + 有 ± 的輸入 */}
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Warmup 秒" value={warmup} min={0} onChange={setWarmup}/>
        <NumField label="Cooldown 秒" value={cooldown} min={0} onChange={setCooldown}/>
      </div>

      <StepEditor value={steps} onChange={setSteps} />

      <div className="flex gap-2 overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch]">
        <button onClick={handleSave} disabled={busy} className="shrink-0 px-4 py-2 rounded-xl border border-white">
          {busy ? '儲存中…' : '儲存變更'}
        </button>
        <button onClick={handleSaveAndPlay} disabled={busy} className="shrink-0 px-4 py-2 rounded-xl border border-white">
          {busy ? '儲存中…' : '儲存並預覽'}
        </button>
      </div>
    </div>
  );
}

export default function EditHiit() {
  return (
    <Suspense fallback={<div className="p-4 text-white">載入中…</div>}>
      <EditHiitInner />
    </Suspense>
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
    if (/^\d*$/.test(t)) setText(t);
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