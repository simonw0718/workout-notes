///app/(hiit)/hiit/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listWorkouts, deleteWorkout,
  exportWorkouts, importWorkouts, type WorkoutsExportFile
} from '@/lib/hiit/api';
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
  const [armedId, setArmedId] = useState<string | null>(null);
  const [armedBatch, setArmedBatch] = useState(false);
  const ARM_MS = 2500;

  // 同步（匯入/匯出）彈窗
  const [syncOpen, setSyncOpen] = useState(false);
  const [overwrite, setOverwrite] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await listWorkouts();
      setWorkouts(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchList(); }, []);

  // Esc 關閉同步彈窗
  useEffect(() => {
    if (!syncOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSyncOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [syncOpen]);

  const totalsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts) {
      try { m.set(w.id, formatHMS(computeWorkoutMs(w as any))); }
      catch { m.set(w.id, '—'); }
    }
    return m;
  }, [workouts]);

  const toggleSel = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(workouts.map(w => w.id)));
  const clearSel  = () => setSelected(new Set());

  const deleteOne = async (id: string) => {
    setBusy(true);
    try {
      await deleteWorkout(id, false);
      await fetchList();
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    } finally { setBusy(false); }
  };
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

  const onDeleteClick = (id: string) => {
    if (busy) return;
    if (armedId === id) {
      setArmedId(null);
      void deleteOne(id);
    } else {
      setArmedId(id);
      window.setTimeout(() => setArmedId(curr => (curr === id ? null : curr)), ARM_MS);
    }
  };
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

  // ===== 匯入 / 匯出（同步）=====
  function openImportPicker() {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }

  async function onImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text) as WorkoutsExportFile;
      setBusy(true);
      const res = await importWorkouts(json, { overwrite });
      await fetchList();
      alert(`匯入完成：新增 ${res.added}、更新 ${res.updated}、略過 ${res.skipped}${res.conflicts.length ? `\n衝突（同名未覆蓋）：\n- ${res.conflicts.join('\n- ')}` : ''}`);
    } catch (e:any) {
      alert(`匯入失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
      setSyncOpen(false);
    }
  }

  async function handleExportAll() {
    try {
      const file = await exportWorkouts();
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `hiit-workouts-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e:any) {
      alert(`匯出失敗：${e?.message ?? e}`);
    } finally {
      setSyncOpen(false);
    }
  }

  return (
    <div className="p-4 text-white">
      {/* 第一列：標題置中 + 右側返回 Workout（同一行） */}
      <div className="relative mb-8 sm:mb-4">
        <h1 className="text-2xl font-semibold font-title absolute left-1/2 -translate-x-1/2">HIIT</h1>
        <div className="flex justify-end">
          <Link href="/" className="text-sm text-white/70 hover:text-white transition">← Workout</Link>
        </div>
      </div>

      {/* 第二列：右側工具列（歷史在動作庫左邊） */}
      <div className="flex items-center justify-between gap-4">
        <div /> {/* 左側占位，保持視覺平衡 */}
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch] pl-1 -mr-1 pr-1">
          <Link
            href="/hiit/history"
            className="shrink-0 px-3 py-1.5 sm:py-2 rounded-xl border border-white/60 text-white/90 text-sm sm:text-base"
          >
            歷史
          </Link>

          <Link
            href="/hiit/exercises"
            className="shrink-0 px-3 py-1.5 sm:py-2 rounded-xl border border-white/60 text-white/90 text-sm sm:text-base"
          >
            動作庫
          </Link>

          {/* 同步：彈窗 */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setSyncOpen(true)}
              className="px-3 py-1.5 sm:py-2 rounded-xl border border-white text-white text-sm sm:text-base"
            >
              同步
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onImportFileChange}
            />
          </div>

          {!manageMode ? (
            <button
              type="button"
              onClick={() => { setManageMode(true); clearSel(); setArmedBatch(false); }}
              className="shrink-0 px-3 py-1.5 sm:py-2 rounded-xl border border-white text-white text-sm sm:text-base"
            >
              管理
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setManageMode(false); clearSel(); setArmedBatch(false); }}
                className="shrink-0 px-3 py-1.5 sm:py-2 rounded-xl border border-white/60 text-white/90 text-sm sm:text-base"
              >
                取消
              </button>
              <button
                type="button"
                onClick={selectAll}
                className="shrink-0 px-3 py-1.5 sm:py-2 rounded-xl border border-white/60 text-white/90 text-sm sm:text-base"
              >
                全選
              </button>
              <button
                type="button"
                onClick={onBatchDeleteClick}
                disabled={busy || selected.size === 0}
                className={`shrink-0 px-3 py-1.5 sm:py-2 rounded-xl border text-sm sm:text-base ${
                  armedBatch ? 'border-red-500 text-red-200' : 'border-red-400 text-red-400'
                } disabled:opacity-50`}
                title={armedBatch ? '再按一次確認刪除' : '刪除所選'}
              >
                {armedBatch ? '確定？' : `刪除（${selected.size}）`}
              </button>
            </>
          )}

          <Link
            href="/hiit/new"
            className="shrink-0 px-3 py-1.5 sm:py-2 rounded-xl border border-white text-white text-sm sm:text-base"
          >
            新建方案
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm opacity-70">載入中…</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {workouts.map((w) => {
            const checked = selected.has(w.id);
            const total = totalsMap.get(w.id) ?? '—';
            const armed = armedId === w.id;

            return (
              <li key={w.id} className="p-3 rounded-xl border border-white/20 flex items-center justify-between">
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

                <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch] pl-1">
                  {!manageMode ? (
                    <>
                      <Link href={`/hiit/edit?wid=${encodeURIComponent(w.id)}`} className="shrink-0 text-sm underline">
                        編輯
                      </Link>
                      <Link href={`/hiit/preview?wid=${encodeURIComponent(w.id)}`} className="shrink-0 text-sm underline">
                        開始
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDeleteClick(w.id)}
                        disabled={busy}
                        className={`shrink-0 text-sm ${armed ? 'text-red-200' : 'text-red-300 hover:text-red-400'}`}
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
                      className={`shrink-0 px-2 py-1 rounded-lg border text-sm ${
                        checked ? 'border-white text-white' : 'border-white/40 text-white/60'
                      }`}
                    >
                      {checked ? '已選' : '選取'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {workouts.length === 0 && (
            <li className="p-3 rounded-xl border border-white/20 text-sm opacity-80">
              目前沒有方案，點「新建方案」開始。
            </li>
          )}
        </ul>
      )}

      {/* === 同步 Modal === */}
      {syncOpen && (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSyncOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/90 backdrop-blur shadow-xl p-4 sm:p-5">
              <div className="pb-3 border-b border-white/10">
                <h3 className="text-lg font-semibold">同步</h3>
                <p className="mt-1 text-xs text-white/70">方案資料匯入 / 匯出。</p>
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-white/15 px-3 py-2">
                  <span className="text-sm">覆蓋同名</span>
                  <input
                    type="checkbox"
                    className="size-4 accent-white"
                    checked={overwrite}
                    onChange={(e)=>setOverwrite(e.target.checked)}
                  />
                </label>

                <button
                  type="button"
                  onClick={openImportPicker}
                  className="w-full rounded-xl border border-white/60 px-4 py-2 text-sm hover:bg-white/10"
                >
                  匯入
                </button>

                <button
                  type="button"
                  onClick={handleExportAll}
                  className="w-full rounded-xl border border-white/60 px-4 py-2 text-sm hover:bg-white/10"
                >
                  匯出全部
                </button>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSyncOpen(false)}
                  className="rounded-xl border border-white/30 px-4 py-2 text-sm hover:bg-white/10"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}