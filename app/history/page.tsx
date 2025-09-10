// app/history/page.tsx
"use client";
export const dynamic = "force-static";
export const fetchCache = "force-cache";

import type React from "react";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getDB,
  deleteSessionWithSets,
  deleteAllHistory,
  listSetsBySessionSafe,
} from "@/lib/db";
import type { Session, SetRecord } from "@/lib/models/types";

type Row = { s: Session; totalVolume?: number; setsCount?: number };

function fmt(ts?: number | null) {
  if (!ts) return "-";
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** 外層：只放 Suspense 邊界，避免 CSR bail out */
export default function HistoryPage() {
  return (
    <Suspense fallback={<main className="p-6">載入中…</main>}>
      <HistoryInner />
    </Suspense>
  );
}

/** 內層：實際使用 useSearchParams */
function HistoryInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const currentId = sp.get("sessionId") ?? "";

  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // 右側明細
  const [sets, setSets] = useState<SetRecord[]>([]);
  const selectedSession = useMemo(
    () => items.find((r) => r.s.id === currentId)?.s ?? null,
    [items, currentId],
  );

  const load = useCallback(async () => {
    const db = await getDB();
    const all = (await db.getAll("sessions")) as Session[];
    all.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)).reverse();
    setItems(all.map((s) => ({ s })));
    setSelected({});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 載入右側場次明細
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentId) {
        setSets([]);
        return;
      }
      const list = await listSetsBySessionSafe(currentId);
      if (!alive) return;
      setSets(list ?? []);
    })();
    return () => { alive = false; };
  }, [currentId]);

  const allChecked = useMemo(
    () => items.length > 0 && items.every((r) => selected[r.s.id]),
    [items, selected],
  );
  const checkedCount = useMemo(
    () => items.filter((r) => selected[r.s.id]).length,
    [items, selected],
  );

  const toggleOne = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleAll = () => {
    if (allChecked) setSelected({});
    else setSelected(Object.fromEntries(items.map((r) => [r.s.id, true])));
  };

  const handleDeleteSelected = async () => {
    if (busy) return;
    const ids = items.filter((r) => selected[r.s.id]).map((r) => r.s.id);
    if (ids.length === 0) return;
    if (!window.confirm(`確定要刪除 ${ids.length} 筆場次（含所有組）嗎？此動作無法復原。`)) return;
    try {
      setBusy(true);
      for (const id of ids) await deleteSessionWithSets(id);
      if (ids.includes(currentId)) router.replace("/history");
      await load();
    } catch (e) {
      console.error("[batch delete] failed:", e);
      alert("刪除失敗，請稍後再試。詳見 Console。");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAll = async () => {
    if (busy) return;
    if (!window.confirm("確定要刪除「目前所有歷史資料」（所有 sessions 與 sets）嗎？此動作無法復原。")) return;
    try {
      setBusy(true);
      await deleteAllHistory();
      router.replace("/history");
      await load();
    } catch (e) {
      console.error("[deleteAllHistory] failed:", e);
      alert("刪除失敗，請稍後再試。詳見 Console。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-screen-lg mx-auto p-6 space-y-6">
      {/* Header + 工具列 */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">歷史紀錄</h1>
        <div className="flex items-center gap-3">
          <Link href="/" className="underline">回首頁</Link>
          <Link
            href="/analytics"
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
            title="視覺化分析"
          >
            Analytics
          </Link>
        </div>
      </header>

      {/* 主區：左清單／右明細 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左：清單 + 批次工具 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={toggleAll} className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">
              {allChecked ? "取消全選" : "全選"}
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={busy || checkedCount === 0}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              刪除勾選（{checkedCount}）
            </button>

            <button
              onClick={handleDeleteAll}
              disabled={busy || items.length === 0}
              className="rounded-xl border px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              title="清空所有歷史資料"
            >
              清空全部歷史
            </button>
          </div>

          {/* 清單 */}
          <div className="space-y-3">
            {items.length === 0 && <p className="text-gray-500">目前沒有歷史紀錄。</p>}

            {items.map(({ s }) => {
              const status = s.endedAt ? "已結束" : "進行中";
              const started = s.startedAt ? new Date(s.startedAt).toLocaleString() : "(未知開始時間)";
              const checked = !!selected[s.id];
              const active = s.id === currentId;

              return (
                <div
                  key={s.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${active ? "bg-black text-white" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={checked}
                    onChange={() => toggleOne(s.id)}
                  />
                  <button
                    onClick={() => router.push(`/history?sessionId=${encodeURIComponent(s.id)}`)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{started}</div>
                      <div className={`text-sm ${active ? "text-white/80" : "text-orange-600"}`}>{status}</div>
                    </div>
                    <div className={`text-xs break-all mt-1 ${active ? "text-white/70" : "text-gray-400"}`}>
                      sessionId: {s.id}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* 右：場次明細 */}
        <section className="space-y-3">
          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">場次明細</h2>
              {selectedSession ? (
                <Link
                  href={`/summary?sessionId=${encodeURIComponent(selectedSession.id)}`}
                  className="text-sm underline"
                >
                  查看本次訓練摘要
                </Link>
              ) : (
                <span className="text-sm text-gray-400">未選擇場次</span>
              )}
            </div>

            {!selectedSession ? (
              <div className="text-gray-500 text-sm mt-2">左側點選任一場次，即可在此看到細節。</div>
            ) : sets.length === 0 ? (
              <div className="text-gray-500 text-sm mt-2">此場次尚無紀錄。</div>
            ) : (
              <>
                <div className="text-sm text-gray-600 mt-2">
                  開始：{fmt(selectedSession.startedAt)}　/　結束：{fmt(selectedSession.endedAt)}
                </div>
                <ul className="divide-y mt-3">
                  {sets.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between">
                      <div className="text-sm font-mono">
                        {r.weight} {r.unit ?? "kg"} × {r.reps}{r.rpe != null ? ` · RPE${r.rpe}` : ""}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(r.createdAt).toLocaleTimeString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}