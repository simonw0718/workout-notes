// /app/(hiit)/hiit/exercises/trash/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { listHiitExercises, deleteExercise, restoreExercise, type HiitExerciseDto } from '@/lib/hiit/api';

export default function TrashExercisesPage() {
  const [items, setItems] = useState<HiitExerciseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [armedRestore, setArmedRestore] = useState(false);
  const [armedPurge, setArmedPurge] = useState(false);
  const ARM_MS = 2500;

  const load = async () => {
    setLoading(true);
    try {
      const data = await listHiitExercises({ status: 'only', sort: 'category', limit: 300 });
      setItems(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doRestore = async () => {
    if (sel.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...sel].map(id => restoreExercise(id)));
      await load(); setSel(new Set());
    } finally { setBusy(false); }
  };
  const doPurge = async () => {
    if (sel.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...sel].map(id => deleteExercise(id, true))); // 硬刪
      await load(); setSel(new Set());
    } finally { setBusy(false); }
  };

  const onRestoreClick = () => {
    if (busy || sel.size === 0) return;
    if (armedRestore) { setArmedRestore(false); void doRestore(); }
    else { setArmedRestore(true); window.setTimeout(()=>setArmedRestore(false), ARM_MS); }
  };
  const onPurgeClick = () => {
    if (busy || sel.size === 0) return;
    if (armedPurge) { setArmedPurge(false); void doPurge(); }
    else { setArmedPurge(true); window.setTimeout(()=>setArmedPurge(false), ARM_MS); }
  };

  return (
    <div className="p-4 text-white">
      <div className="mb-3"><BackButton /></div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">回收桶</h1>
        <div className="flex items-center gap-2">
          <button onClick={onRestoreClick} disabled={busy || sel.size === 0}
            className={`px-3 py-2 rounded-xl border ${armedRestore?'border-emerald-400 text-emerald-200':'border-emerald-400 text-emerald-400'} disabled:opacity-50`}>
            {armedRestore ? '確定復原？' : `復原（${sel.size}）`}
          </button>
          <button onClick={onPurgeClick} disabled={busy || sel.size === 0}
            className={`px-3 py-2 rounded-xl border ${armedPurge?'border-red-500 text-red-200':'border-red-400 text-red-400'} disabled:opacity-50`}>
            {armedPurge ? '永久刪除？' : `永久刪除（${sel.size}）`}
          </button>
          <Link href="/hiit/exercises" className="px-3 py-2 rounded-xl border border-white/60 text-white/90">回動作庫</Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm opacity-70">載入中…</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map(x => {
            const checked = sel.has(x.id!);
            return (
              <li key={x.id} className="p-3 rounded-xl border border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="size-4 accent-white" checked={checked} onChange={() => toggle(x.id!)} aria-label={`選取 ${x.name}`} />
                  <div>
                    <div className="font-medium">{x.name}</div>
                    <div className="text-xs opacity-70">{x.primaryCategory} · 預設 {x.defaultValue}s · {x.equipment}</div>
                    {x.deletedAt && <div className="text-xs opacity-60 mt-1">刪除於：{x.deletedAt}</div>}
                  </div>
                </div>
                <div className="text-sm opacity-60">已刪</div>
              </li>
            );
          })}
          {items.length === 0 && <li className="p-3 rounded-xl border border-white/20 text-sm opacity-80">回收桶是空的。</li>}
        </ul>
      )}
    </div>
  );
}