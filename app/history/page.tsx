// app/history/page.tsx
"use client";
export const dynamic = "force-static";
export const fetchCache = "force-cache"
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getDB, deleteSessionWithSets, deleteAllHistory } from "@/lib/db";
import type { Session } from "@/lib/models/types";

type Row = {
  s: Session;
  // 可選：若要顯示統計，可把下兩欄做成實際資料
  totalVolume?: number;
  setsCount?: number;
};



export default function HistoryListPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = await getDB();
    const all = (await db.getAll("sessions")) as Session[];
    all.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)).reverse();

    // 若要計算每場的總量/組數，可在此批次撈取（避免頁面顯示時再一筆筆撈）
    const rows: Row[] = [];
    for (const s of all) {
      // 可選：取出 sets 做彙總（若資料量很大可略過）
      // const sets = await listSetsBySession(s.id);
      // const setsCount = sets.length;
      // const totalVolume = sets.reduce((acc, r) => acc + r.weight * r.reps, 0);
      rows.push({ s /*, totalVolume, setsCount*/ });
    }
    setItems(rows);

    // 勾選狀態重置（避免殘留）
    setSelected({});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allChecked = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((r) => selected[r.s.id]);
  }, [items, selected]);

  const checkedCount = useMemo(
    () => items.filter((r) => selected[r.s.id]).length,
    [items, selected],
  );

  const toggleOne = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    if (allChecked) {
      // 取消全選
      const next: Record<string, boolean> = {};
      setSelected(next);
    } else {
      // 全選
      const next: Record<string, boolean> = {};
      for (const r of items) next[r.s.id] = true;
      setSelected(next);
    }
  };

  const handleDeleteSelected = async () => {
    if (busy) return;
    const ids = items.filter((r) => selected[r.s.id]).map((r) => r.s.id);
    if (ids.length === 0) return;

    const ok = window.confirm(
      `確定要刪除 ${ids.length} 筆場次（含所有組）嗎？此動作無法復原。`,
    );
    if (!ok) return;

    try {
      setBusy(true);
      // 最穩定的是逐筆刪（內部會一併刪 sets）
      for (const id of ids) {
        await deleteSessionWithSets(id);
      }
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
    const ok = window.confirm(
      "確定要刪除「目前所有歷史資料」（所有 sessions 與 sets）嗎？此動作無法復原。",
    );
    if (!ok) return;

    try {
      setBusy(true);
      await deleteAllHistory(); // 清空 sessions + sets
      await load();
    } catch (e) {
      console.error("[deleteAllHistory] failed:", e);
      alert("刪除失敗，請稍後再試。詳見 Console。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-6 space-y-6">
      {/* Header + 工具列 */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">歷史紀錄</h1>
        <div className="flex items-center gap-3">
          <Link href="/" className="underline">
            回首頁
          </Link>
          {/* (1) 導覽入口到 Analytics */}
          <Link
            href="/analytics"
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
            title="視覺化分析"
          >
            Analytics
          </Link>
        </div>
      </header>

      {/* 批次工具列 */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleAll}
          className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
        >
          {allChecked ? "取消全選" : "全選"}
        </button>

        <button
          onClick={handleDeleteSelected}
          disabled={busy || checkedCount === 0}
          className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          刪除勾選（{checkedCount}）
        </button>

        {/* (3) 刪除目前所有資料（sessions + sets） */}
        <button
          onClick={handleDeleteAll}
          disabled={busy || items.length === 0}
          className="rounded-xl border px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          title="清空所有歷史資料"
        >
          清空全部歷史
        </button>
      </div>

      {/* 列表 */}
      <div className="space-y-4">
        {items.length === 0 && (
          <p className="text-gray-500">目前沒有歷史紀錄。</p>
        )}

        {items.map(({ s /*, totalVolume, setsCount*/ }) => {
          const status = s.endedAt ? "已結束" : "進行中";
          const started = s.startedAt
            ? new Date(s.startedAt).toLocaleString()
            : "(未知開始時間)";
          const checked = !!selected[s.id];

          return (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-2xl border p-4"
            >
              {/* 勾選框 */}
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={checked}
                onChange={() => toggleOne(s.id)}
              />

              {/* 內容區塊（可點擊進入詳情） */}
              <Link
                href={`/history/${encodeURIComponent(s.id)}`}
                className="flex-1 block"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{started}</div>
                  <div className="text-sm text-orange-600">{status}</div>
                </div>

                {/* 若要顯示統計，取消註解上面 rows 彙總並改用這段 */}
                {/* <div className="text-sm text-gray-600 mt-1">
                  總量 {totalVolume ?? 0}　組數 {setsCount ?? 0}
                </div> */}
                <div className="text-xs text-gray-400 break-all mt-1">
                  sessionId: {s.id}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </main>
  );
}
