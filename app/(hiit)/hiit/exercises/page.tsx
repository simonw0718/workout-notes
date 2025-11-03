// /app/(hiit)/hiit/exercises/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { listHiitExercises, deleteExercise, type HiitExerciseDto } from '@/lib/hiit/api';

export default function ExercisesPage() {
  const [items, setItems] = useState<HiitExerciseDto[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [manage, setManage] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [armedBatch, setArmedBatch] = useState(false);
  const ARM_MS = 2500;

  const load = async () => {
    setLoading(true);
    try {
      const data = await listHiitExercises({
        q: q.trim() || undefined,
        category: category || undefined,
        status: 'no',              // 只看未刪
        sort: 'category',
        limit: 200,
      });
      setItems(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, category]);

  const toggle = (id: string) => {
    setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const deleteSelected = async () => {
    if (sel.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...sel].map(id => deleteExercise(id, false))); // 軟刪
      await load();
      setSel(new Set()); setManage(false);
    } finally { setBusy(false); }
  };

  const onBatchDeleteClick = () => {
    if (busy || sel.size === 0) return;
    if (armedBatch) { setArmedBatch(false); void deleteSelected(); }
    else { setArmedBatch(true); window.setTimeout(() => setArmedBatch(false), ARM_MS); }
  };

  return (
    <div className="p-4 text-white">
      <div className="mb-3"><BackButton /></div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">動作庫</h1>
        <div className="flex items-center gap-2">
          {!manage ? (
            <button onClick={() => { setManage(true); setSel(new Set()); setArmedBatch(false); }} className="px-3 py-2 rounded-xl border border-white">管理</button>
          ) : (
            <>
              <button onClick={() => { setManage(false); setSel(new Set()); setArmedBatch(false); }} className="px-3 py-2 rounded-xl border border-white/60">取消</button>
              <button
                onClick={onBatchDeleteClick}
                disabled={busy || sel.size === 0}
                className={`px-3 py-2 rounded-xl border ${armedBatch ? 'border-red-500 text-red-200' : 'border-red-400 text-red-400'} disabled:opacity-50`}
                title={armedBatch ? '再按一次確認刪除' : '刪除所選'}
              >
                {armedBatch ? '確定？' : `刪除（${sel.size}）`}
              </button>
            </>
          )}
          <Link href="/hiit/exercises/new" className="px-3 py-2 rounded-xl border border-white">新增</Link>
          <Link href="/hiit/exercises/trash" className="px-3 py-2 rounded-xl border border-white/60 text-white/90">回收桶</Link>
          <Link href="/hiit" className="px-3 py-2 rounded-xl border border-white/60 text-white/90">回 HIIT</Link>
        </div>
      </div>

      {/* 篩選 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜尋名稱 / 提示 / 目標…" className="bg-black border border-white/20 rounded-lg px-3 py-2 min-w-[220px]" />
        <select value={category} onChange={e=>setCategory(e.target.value)} className="bg-black border border-white/20 rounded-lg px-3 py-2">
          <option value="">全部分類</option>
          <option value="cardio">心肺</option><option value="lower">下肢</option><option value="upper">上肢</option><option value="core">核心</option><option value="full">全身</option>
        </select>
      </div>

      {/* 清單 */}
      {loading ? (
        <div className="mt-4 text-sm opacity-70">載入中…</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map(x => {
            const checked = sel.has(x.id!);
            return (
              <li key={x.id} className="p-3 rounded-xl border border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {manage && <input type="checkbox" className="size-4 accent-white" checked={checked} onChange={() => toggle(x.id!)} aria-label={`選取 ${x.name}`} />}
                  <div>
                    <div className="font-medium">{x.name}</div>
                    <div className="text-xs opacity-70">{x.primaryCategory} · 預設 {x.defaultValue}s · {x.equipment}</div>
                    {x.cue && <div className="text-xs opacity-60 mt-1">提示：{x.cue}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!manage ? (
                    <Link href={`/hiit/exercises/edit?id=${encodeURIComponent(x.id!)}`} className="text-sm underline">編輯</Link>
                  ) : (
                    <button onClick={() => toggle(x.id!)} className={`px-2 py-1 rounded-lg border ${checked ? 'border-white text-white' : 'border-white/40 text-white/70'}`}>{checked ? '已選' : '選取'}</button>
                  )}
                </div>
              </li>
            );
          })}
          {items.length === 0 && <li className="p-3 rounded-xl border border-white/20 text-sm opacity-80">沒有資料。</li>}
        </ul>
      )}
    </div>
  );
}