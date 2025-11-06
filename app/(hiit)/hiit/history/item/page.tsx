// /app/(hiit)/hiit/history/item/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { getHistory, updateHistory } from '@/lib/hiit/api';

export default function HistoryDetailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-white"><BackButton /> 載入中…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';

  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await getHistory(id);
        if (!alive) return;
        setRow(r);
        setNotes(r?.notes ?? '');
      } catch (e:any) {
        setErr(e?.message ?? String(e));
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  const saveNotes = async () => {
    setBusy(true);
    try {
      await updateHistory(id, { notes: notes.trim() || null });
      // 可加 toast
    } finally { setBusy(false); }
  };

  const exportTxt = () => {
    if (!row) return;
    const when = row.endedAt ? new Date(row.endedAt).toLocaleString() : new Date(row.startedAt).toLocaleString();
    const lines = [
      `${row.workoutName} (${row.status})`,
      `時間：${when}`,
      `總計：work ${row.totalWorkSec}s / rest ${row.totalRestSec}s`,
      row.notes ? `備註：${row.notes}` : '',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hiit-history-${row.id}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const exportJson = () => {
    if (!row) return;
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hiit-history-${row.id}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  if (!id) return <div className="p-4 text-white"><BackButton /> 缺少 id</div>;
  if (loading) return <div className="p-4 text-white"><BackButton /> 載入中…</div>;
  if (err) return <div className="p-4 text-white"><BackButton /> 載入失敗：{err}</div>;
  if (!row) return <div className="p-4 text-white"><BackButton /> 找不到資料</div>;

  return (
    <div className="p-4 text-white">
      <div className="mb-2"><BackButton /></div>
      <h1 className="text-xl font-semibold font-title text-center">{row.workoutName}</h1>
      <div className="text-sm opacity-80 mt-1">
        {row.endedAt ? new Date(row.endedAt).toLocaleString() : new Date(row.startedAt).toLocaleString()} · {row.status}
        {' · '}work {row.totalWorkSec}s / rest {row.totalRestSec}s
      </div>

      {/* Snapshot（只顯示重點） */}
      <div className="mt-4 p-3 rounded-xl border border-white/20">
        <div className="font-medium">當下配置（snapshot）</div>
        <div className="text-sm opacity-80 mt-1">
          熱身 {row.snapshot.warmup_sec}s · 收操 {row.snapshot.cooldown_sec}s · 步驟 {row.snapshot.steps?.length ?? 0} 個
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {row.snapshot.steps?.map((s:any) => (
            <li key={`${s.order}-${s.title}`} className="opacity-90">
              #{s.order} {s.title} · {s.work_sec}s / rest {s.rest_sec}s · rounds {s.rounds} · sets {s.sets}
            </li>
          ))}
        </ul>
      </div>

      {/* 備註 */}
      <div className="mt-4">
        <div className="text-sm opacity-80 mb-1">備註</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4}
          className="w-full bg-black border border-white/20 rounded-xl px-3 py-2" />
        <div className="mt-2 flex gap-2">
          <button onClick={saveNotes} disabled={busy} className="px-3 py-1.5 rounded-xl border border-white">{busy ? '儲存中…' : '儲存備註'}</button>
          <button onClick={exportTxt} className="px-3 py-1.5 rounded-xl border border-white/60 text-white/80">匯出 TXT</button>
          <button onClick={exportJson} className="px-3 py-1.5 rounded-xl border border-white/60 text-white/80">匯出 JSON</button>
        </div>
      </div>
    </div>
  );
}