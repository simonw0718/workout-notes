'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listHistory, deleteHistory, restoreHistory, clearAllHistory } from '@/lib/hiit/api';
import BackButton from '@/components/BackButton';

type Row = Awaited<ReturnType<typeof listHistory>> extends (infer R)[] ? R : any;

export default function HistoryPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [workoutId, setWorkoutId] = useState('');
  const [status, setStatus] = useState<'no'|'only'|'all'>('no');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [manage, setManage] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [armedBatch, setArmedBatch] = useState(false);
  const ARM_MS = 2500;

  const load = async (reset=false) => {
    setLoading(true);
    try {
      const res = await listHistory({
        q: q.trim() || undefined,
        workoutId: workoutId || undefined,
        status,
        limit: 50,
        offset: reset ? 0 : offset,
        sort: 'endedAt_desc'
      });
      setItems(reset ? res : [...items, ...res]);
      setHasMore(res.length === 50);
      if (reset) setOffset(50);
      else setOffset(offset + res.length);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => { const t = setTimeout(() => load(true), 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, workoutId]);

  const toggle = (id: string) => setSel(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const clearSel = () => setSel(new Set());

  const onBatchDeleteClick = async () => {
    if (busy || sel.size===0) return;
    if (armedBatch) {
      setArmedBatch(false);
      setBusy(true);
      try {
        await Promise.all([...sel].map(id => deleteHistory(id, false)));
        clearSel();
        setManage(false);
        await load(true);
      } finally { setBusy(false); }
    } else {
      setArmedBatch(true);
      window.setTimeout(() => setArmedBatch(false), ARM_MS);
    }
  };

  const exportTxt = (rows: Row[]) => {
    const lines = rows.map(x => {
      const when = x.endedAt ? new Date(x.endedAt).toLocaleString() : new Date(x.startedAt).toLocaleString();
      return `${when} | ${x.workoutName} | ${x.status} | work ${x.totalWorkSec}s / rest ${x.totalRestSec}s`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hiit-history-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportJson = (rows: Row[]) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hiit-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const uniqueWorkouts = useMemo(() => {
    const m = new Map<string,string>();
    for (const it of items) m.set(it.workoutId, it.workoutName);
    return Array.from(m.entries());
  }, [items]);

  return (
    <div className="p-4 text-white">
      {/* 第一列：左上角返回，標題置中（與整站一致時可加 font-title） */}
      <div className="relative mb-3">
        <div className="absolute left-0 top-0"><BackButton /></div>
        <h1 className="text-xl sm:text-2xl font-semibold font-title text-center">HIIT 歷史</h1>
      </div>

      {/* 篩選列 */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜尋：名稱 / 備註" className="bg-black border border-white/20 rounded-lg px-3 py-2" />
        <select value={workoutId} onChange={e=>setWorkoutId(e.target.value)} className="bg黑 border border-white/20 rounded-lg px-3 py-2">
          <option value="">全部方案</option>
          {uniqueWorkouts.map(([id,name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value as any)} className="bg-black border border-white/20 rounded-lg px-3 py-2">
          <option value="no">未刪</option>
          <option value="only">回收桶</option>
          <option value="all">全部</option>
        </select>

        <div className="flex gap-2">
          {!manage ? (
            <button onClick={() => { setManage(true); clearSel(); }} className="flex-1 px-3 py-2 rounded-xl border border-white">管理</button>
          ) : (
            <>
              <button onClick={() => { setManage(false); clearSel(); }} className="flex-1 px-3 py-2 rounded-xl border border-white/60 text-white/80">取消</button>
              <button onClick={onBatchDeleteClick} disabled={busy || sel.size===0}
                className={`flex-1 px-3 py-2 rounded-xl border ${armedBatch ? 'border-red-500 text-red-200' : 'border-red-400 text-red-400'} disabled:opacity-50`}>
                {armedBatch ? '確定？' : `刪除（${sel.size}）`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 工具列 */}
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => exportTxt(items)} className="px-3 py-1.5 rounded-xl border border-white">匯出 TXT（目前頁）</button>
        <button onClick={() => exportJson(items)} className="px-3 py-1.5 rounded-xl border border-white">匯出 JSON（目前頁）</button>
        <button
          onClick={async () => {
            if (!confirm('清空全部歷史？此動作不可復原。')) return;
            await clearAllHistory();
            setItems([]); setOffset(0); setHasMore(false);
          }}
          className="ml-auto px-3 py-1.5 rounded-xl border border-red-400 text-red-300"
        >
          清空全部
        </button>
      </div>

      {/* 清單 */}
      {loading ? (
        <div className="mt-4 text-sm opacity-70">載入中…</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map(x => {
            const checked = sel.has(x.id);
            const when = x.endedAt ? new Date(x.endedAt).toLocaleString() : new Date(x.startedAt).toLocaleString();

            // 動作摘要：每個 title 的 (rounds * sets) 次數，串成「A×n + B×m…」
            const summary = (() => {
              const m = new Map<string, number>();
              const steps = x?.snapshot?.steps ?? [];
              for (const s of steps) {
                const title = (s?.title || '').trim() || '動作';
                const count = Math.max(1, Number(s?.rounds ?? 1)) * Math.max(1, Number(s?.sets ?? 1));
                m.set(title, (m.get(title) ?? 0) + count);
              }
              return Array.from(m.entries()).slice(0, 6).map(([t, c]) => `${t}×${c}`).join(' + ');
            })();

            return (
              <li key={x.id} className="p-3 rounded-xl border border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {manage && (
                    <input
                      type="checkbox"
                      className="size-4 accent-white"
                      checked={checked}
                      onChange={() => toggle(x.id)}
                      aria-label={`選取 ${x.workoutName}`}
                    />
                  )}
                  <div>
                    <Link href={`/hiit/history/item?id=${encodeURIComponent(x.id)}`} className="font-medium underline">
                      {x.workoutName}
                    </Link>
                    <div className="text-xs opacity-70">
                      {when} · {x.status}
                    </div>
                    {summary && <div className="text-xs opacity-70 mt-0.5">{summary}</div>}
                    {x.deletedAt && <div className="text-xs text-red-300 mt-0.5">已刪除：{new Date(x.deletedAt).toLocaleString()}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!x.deletedAt ? (
                    <button onClick={() => deleteHistory(x.id, false).then(()=>load(true))} className="text-sm text-red-300 hover:text-red-400">刪除</button>
                  ) : (
                    <>
                      <button onClick={() => restoreHistory(x.id).then(()=>load(true))} className="text-sm underline">還原</button>
                      <button onClick={() => deleteHistory(x.id, true).then(()=>load(true))} className="text-sm text-red-300 hover:text-red-400">永久刪除</button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {items.length === 0 && <li className="p-3 rounded-xl border border-white/20 text-sm opacity-80">沒有資料。</li>}
        </ul>
      )}

      {/* 分頁：載入更多 */}
      {!loading && hasMore && (
        <div className="mt-3 flex justify-center">
          <button onClick={() => load(false)} className="px-4 py-2 rounded-xl border border-white">載入更多</button>
        </div>
      )}
    </div>
  );
}