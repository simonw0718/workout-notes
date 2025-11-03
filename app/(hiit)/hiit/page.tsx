// /app/(hiit)/hiit/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BackButton from '@/components/BackButton';
import { listWorkouts, deleteWorkout } from '@/lib/hiit/api';
import { computeWorkoutMs, formatHMS } from '@/lib/hiit/time';

type Workout = {
  id: string;
  name: string;
  warmup_sec?: number;
  cooldown_sec?: number;
  steps?: Array<{
    order: number; title: string;
    work_sec: number; rest_sec: number;
    rounds: number; sets: number; inter_set_rest_sec: number;
  }>;
  deletedAt?: string | null;
};

export default function Page() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // 兩段式刪除：單筆與批次的「待確認」狀態
  const [armedId, setArmedId] = useState<string | null>(null);
  const [armedBatch, setArmedBatch] = useState(false);
  const ARM_MS = 2500; // 幾秒內第二次點才會真的刪

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await listWorkouts();
      setWorkouts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchList(); }, []);

  // 頂層算總時長
  const totalsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts) {
      try { m.set(w.id, formatHMS(computeWorkoutMs(w as any))); }
      catch { m.set(w.id, '—'); }
    }
    return m;
  }, [workouts]);

  // 勾選
  const toggleSel = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(workouts.map(w => w.id)));
  const clearSel  = () => setSelected(new Set());

  // 單筆刪除（真正執行）
  const deleteOne = async (id: string) => {
    setBusy(true);
    try {
      await deleteWorkout(id, false);
      await fetchList();
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    } finally { setBusy(false); }
  };

  // 批次刪除（真正執行）
  const deleteBatch = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map(id => deleteWorkout(id, false)));
      await fetchList();
      clearSel();
      setManageMode(false);
    } finally { setBusy(false); }
  };

  // 兩段式：單筆按下
  const onDeleteClick = (id: string) => {
    if (busy) return;
    if (armedId === id) {
      setArmedId(null);
      void deleteOne(id);
    } else {
      setArmedId(id);
      // 幾秒後自動解除
      window.setTimeout(() => setArmedId(curr => (curr === id ? null : curr)), ARM_MS);
    }
  };

  // 兩段式：批次按下
  const onBatchDeleteClick = () => {
    if (busy || selected.size === 0) return;
    if (armedBatch) {
      setArmedBatch(false);
      void deleteBatch();
    } else {
      setArmedBatch(true);
      window.setTimeout(() => setArmedBatch(false), ARM_MS);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3"><BackButton /></div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">HIIT</h1>

        <div className="flex items-center gap-2">
          <Link href="/hiit/exercises" className="px-3 py-2 rounded-xl border border-white/60 text-white/90">
            動作庫
          </Link>

          {!manageMode ? (
            <button
              type="button"
              onClick={() => { setManageMode(true); clearSel(); setArmedBatch(false); }}
              className="px-3 py-2 rounded-xl border border-white text-white"
            >
              管理
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setManageMode(false); clearSel(); setArmedBatch(false); }}
                className="px-3 py-2 rounded-xl border border-white/60 text-white/90"
              >
                取消
              </button>
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-2 rounded-xl border border-white/60 text-white/90"
              >
                全選
              </button>
              <button
                type="button"
                onClick={onBatchDeleteClick}
                disabled={busy || selected.size === 0}
                className={`px-3 py-2 rounded-xl border ${
                  armedBatch
                    ? 'border-red-500 text-red-200'
                    : 'border-red-400 text-red-400'
                } disabled:opacity-50`}
                title={armedBatch ? '再按一次確認刪除' : '刪除所選'}
              >
                {armedBatch ? '確定？' : `刪除（${selected.size}）`}
              </button>
            </>
          )}

          <Link href="/hiit/new" className="px-3 py-2 rounded-xl border border-white text-white">
            新建方案
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm opacity-70 text-white/80">載入中…</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {workouts.map((w) => {
            const checked = selected.has(w.id);
            const total = totalsMap.get(w.id) ?? '—';
            const armed = armedId === w.id;

            return (
              <li
                key={w.id}
                className="p-3 rounded-xl border border-white/20 flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-3">
                  {manageMode && (
                    <input
                      type="checkbox"
                      className="size-4 accent-white"
                      checked={checked}
                      onChange={() => toggleSel(w.id)}
                      aria-label={`選取 ${w.name}`}
                    />
                  )}
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs opacity-70">
                      {(w.steps?.length ?? 0)} steps · {total}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!manageMode ? (
                    <>
                      <Link
                        href={`/hiit/edit?wid=${encodeURIComponent(w.id)}`}
                        className="text-sm underline"
                      >
                        編輯
                      </Link>
                      <Link
                        href={`/hiit/play?wid=${encodeURIComponent(w.id)}`}
                        className="text-sm underline"
                      >
                        開始
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDeleteClick(w.id)}
                        disabled={busy}
                        className={`text-sm ${armed ? 'text-red-200' : 'text-red-300 hover:text-red-400'}`}
                        aria-label={`刪除 ${w.name}`}
                        title={armed ? '再按一次確認刪除' : '刪除'}
                      >
                        {armed ? '確定？' : '刪除'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSel(w.id)}
                      className={`px-2 py-1 rounded-lg border ${checked ? 'border-white text-white' : 'border-white/40 text-white/60'}`}
                    >
                      {checked ? '已選' : '選取'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}

          {workouts.length === 0 && (
            <li className="p-3 rounded-xl border border-white/20 text-sm opacity-80 text-white">
              目前沒有方案，點「新建方案」開始。
            </li>
          )}
        </ul>
      )}
    </div>
  );
}