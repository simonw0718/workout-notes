// /app/(hiit)/hiit/exercises/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import {
  listHiitExercises,
  deleteExercise,
  reloadSeedExercises,
  type HiitExerciseDto,
} from '@/lib/hiit/api';

type Cat = HiitExerciseDto['primaryCategory'] | ''; // 空字串代表「全部」

export default function ExercisesPage() {
  const [items, setItems] = useState<HiitExerciseDto[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Cat>(''); // ✅ 改成字面量聯集
  const [loading, setLoading] = useState(true);
  const [manage, setManage] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [armedBatch, setArmedBatch] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // reseed 對話框
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string>('');

  const ARM_MS = 2500;

  const load = async () => {
    setLoading(true);
    try {
      // ✅ 先把 '' 轉成 undefined，型別就會是 Cat 去掉 '' → 正確的聯集或 undefined
      const cat = category === '' ? undefined : category;
      const data = await listHiitExercises({
        q: q.trim() || undefined,
        category: cat,
        status: 'no',
        sort: 'category',
        limit: 200,
      });
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category]);

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const deleteSelected = async () => {
    if (sel.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...sel].map((id) => deleteExercise(id, false)));
      await load();
      setSel(new Set());
      setManage(false);
    } finally {
      setBusy(false);
    }
  };

  const onBatchDeleteClick = () => {
    if (busy || sel.size === 0) return;
    if (armedBatch) {
      setArmedBatch(false);
      void deleteSelected();
    } else {
      setArmedBatch(true);
      window.setTimeout(() => setArmedBatch(false), ARM_MS);
    }
  };

  // ---------- 匯出：產生一行一個動作的文字 ----------
  const generateText = () => {
    const lines = items.map((x) => {
      const name = (x.name || '').trim();
      const cat = x.primaryCategory || '';
      const body = (x.bodyPart || []).join(', ');
      return `${name} | ${cat} | ${body}`.trim();
    });
    return lines.join('\n');
  };

  // ---------- 下載 .txt 檔 ----------
  const handleDownload = () => {
    try {
      const text = generateText();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hiit-exercises.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportDialog(false);
    } catch (e: any) {
      alert(`下載失敗：${e?.message ?? e}`);
    }
  };

  // ---------- iOS 也能用的複製 ----------
  async function copyText(text: string): Promise<boolean> {
    try {
      if (
        typeof navigator !== 'undefined' &&
        'clipboard' in navigator &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fallback */
    }

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);

    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    ta.select();
    try {
      ta.setSelectionRange(0, ta.value.length);
    } catch {}

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }

    sel?.removeAllRanges();
    document.body.removeChild(ta);
    return ok;
  }

  const handleCopy = async () => {
    try {
      setBusy(true);
      const ok = await copyText(generateText());
      if (ok) alert('清單已複製到剪貼簿。');
      else alert('複製失敗，請改用下載或手動選取。');
    } catch (e: any) {
      alert(`複製失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
      setShowExportDialog(false);
    }
  };

  // ---------- 重新載入預設（seed） ----------
  const handleReseed = async (mode: 'merge' | 'clear') => {
    try {
      setBusy(true);
      setSeedMsg(mode === 'clear' ? '清空並載入中…' : '合併匯入中…');
      const { added, total } = await reloadSeedExercises({
        clearExisting: mode === 'clear',
      });
      setSeedMsg(`完成：新增 ${added} 筆，現有總數 ${total}。`);
      await load();
    } catch (e: any) {
      alert(`重新載入失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 text-white">
      <div className="mb-3">
        <BackButton />
      </div>

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold whitespace-nowrap overflow-hidden text-ellipsis font-title text-center">
          動作庫
        </h1>

        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch]">
          <button
            onClick={() => setShowExportDialog(true)}
            className="inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border border-white text-sm md:text-base"
          >
            匯出清單
          </button>

          {!manage ? (
            <button
              onClick={() => {
                setManage(true);
                setSel(new Set());
                setArmedBatch(false);
              }}
              className="inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border border-white text-sm md:text-base"
            >
              管理
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setManage(false);
                  setSel(new Set());
                  setArmedBatch(false);
                }}
                className="inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border border-white/60 text-white/90 text-sm md:text-base"
              >
                取消
              </button>

              <button
                onClick={() => {
                  setShowSeedDialog(true);
                  setSeedMsg('');
                }}
                disabled={busy}
                className="inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border border-white text-sm md:text-base disabled:opacity-50"
                title="重新載入預設動作"
              >
                重新載入預設
              </button>

              <button
                onClick={onBatchDeleteClick}
                disabled={busy || sel.size === 0}
                className={`inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border text-sm md:text-base ${
                  armedBatch
                    ? 'border-red-500 text-red-200'
                    : 'border-red-400 text-red-400'
                } disabled:opacity-50`}
                title={armedBatch ? '再按一次確認刪除' : '刪除所選'}
              >
                {armedBatch ? '確定？' : `刪除（${sel.size}）`}
              </button>
            </>
          )}

          <Link
            href="/hiit/exercises/new"
            className="inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border border-white text-sm md:text-base"
          >
            新增
          </Link>
          <Link
            href="/hiit/exercises/trash"
            className="inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border border-white/60 text-white/90 text-sm md:text-base"
          >
            回收桶
          </Link>
          <Link
            href="/hiit"
            className="inline-flex px-2 py-1 md:px-3 md:py-2 rounded-lg md:rounded-xl border border-white/60 text-white/90 text-sm md:text-base"
          >
            回 HIIT
          </Link>
        </div>
      </div>

      {/* 篩選 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋名稱 / 提示 / 目標…"
          className="bg-black border border-white/20 rounded-lg px-3 py-2 min-w-[220px]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Cat)}
          className="bg-black border border-white/20 rounded-lg px-3 py-2"
        >
          <option value="">全部分類</option>
          <option value="cardio">心肺</option>
          <option value="lower">下肢</option>
          <option value="upper">上肢</option>
          <option value="core">核心</option>
          <option value="full">全身</option>
        </select>
      </div>

      {/* 清單 */}
      {loading ? (
        <div className="mt-4 text-sm opacity-70">載入中…</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((x) => {
            const checked = sel.has(x.id!);
            return (
              <li
                key={x.id}
                className="p-3 rounded-xl border border-white/20 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {manage && (
                    <input
                      type="checkbox"
                      className="size-4 accent-white"
                      checked={checked}
                      onChange={() => toggle(x.id!)}
                      aria-label={`選取 ${x.name}`}
                    />
                  )}
                  <div>
                    <div className="font-medium">{x.name}</div>
                    <div className="text-xs opacity-70">
                      {x.primaryCategory} · 預設 {x.defaultValue}s · {x.equipment}
                    </div>
                    {x.cue && (
                      <div className="text-xs opacity-60 mt-1">提示：{x.cue}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!manage ? (
                    <Link
                      href={`/hiit/exercises/edit?id=${encodeURIComponent(x.id!)}`}
                      className="text-sm underline"
                    >
                      編輯
                    </Link>
                  ) : (
                    <button
                      onClick={() => toggle(x.id!)}
                      className={`px-2 py-1 rounded-lg border ${
                        checked
                          ? 'border-white text-white'
                          : 'border-white/40 text-white/70'
                      }`}
                    >
                      {checked ? '已選' : '選取'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="p-3 rounded-xl border border-white/20 text-sm opacity-80">
              沒有資料。
            </li>
          )}
        </ul>
      )}

      {/* 匯出對話框 */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
          <div className="w-full sm:w-[520px] bg-zinc-900 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 border border-white/10">
            <div className="text-base sm:text-lg font-medium">匯出清單</div>
            <div className="text-sm text-white/70 mt-1">
              內容格式：<code className="text-white/90">名稱 | 類別 | 部位</code>
              ，一行一個動作。
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 px-4 py-2 rounded-xl border border-white text-white"
              >
                ⬇️ 下載清單名稱
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 px-4 py-2 rounded-xl border border-white text-white"
              >
                📋 複製到剪貼簿
              </button>
            </div>

            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setShowExportDialog(false)}
                className="px-3 py-1.5 rounded-lg border border-white/40 text-white/70 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重新載入預設對話框 */}
      {showSeedDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
          <div className="w-full sm:w-[520px] bg-zinc-900 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 border border-white/10">
            <div className="text-base sm:text-lg font-medium">重新載入預設動作</div>
            <div className="text-sm text-white/70 mt-1">
              若清單為空或想補回預設，可在此重新匯入
              <code className="text-white/90"> seed_exercises.json</code>。
            </div>

            {seedMsg && <div className="mt-3 text-sm text-white/80">{seedMsg}</div>}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleReseed('merge')}
                className="px-4 py-2 rounded-xl border border-white text-white disabled:opacity-50"
                title="不刪除現有自訂，僅補回缺少的預設（避免重複）"
              >
                合併匯入（不清空）
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      '清空後匯入會刪除你自訂的 HIIT 動作，確定要繼續？',
                    )
                  ) {
                    void handleReseed('clear');
                  }
                }}
                className="px-4 py-2 rounded-xl border border-red-400 text-red-300 disabled:opacity-50"
                title="會先清空動作庫，再匯入預設"
              >
                清空後匯入
              </button>
            </div>

            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowSeedDialog(false)}
                className="px-3 py-1.5 rounded-lg border border-white/40 text-white/70 text-sm"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}