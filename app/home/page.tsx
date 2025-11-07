// File: app/home/page.tsx
// 說明：首頁改為橫向滑動 tab bar（最近 / 上肢 / 下肢 / 核心 / 其他）
//       「最近」呼叫 /exercises/recent；其他分類先從本地 DB 過濾 category。
//       加上「新訓練 / 接續紀錄」行為。

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { startSession, getLatestSession, listAllExercises } from "@/lib/db";
import type { Exercise, Session } from "@/lib/models/types";
import { continueSession as apiContinue, getRecentExercises } from "@/lib/sync/api";

type TabKey = "recent" | "upper" | "lower" | "core" | "other";

const TABS: { key: TabKey; label: string }[] = [
  { key: "recent", label: "最近使用" },
  { key: "upper", label: "上肢" },
  { key: "lower", label: "下肢" },
  { key: "core", label: "核心" },
  { key: "other", label: "其他" },
];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [all, setAll] = useState<Exercise[]>([]);
  const [recent, setRecent] = useState<Pick<Exercise, "id" | "name" | "defaultUnit" | "category">[]>([]);
  const [tab, setTab] = useState<TabKey>("recent");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setSession((await getLatestSession()) ?? null);
      setAll(await listAllExercises());

      try {
        const r = await getRecentExercises(5);
        const mapped = r.map((x) => ({
          id: x.id,
          name: x.name,
          defaultUnit: (x.defaultUnit as any) ?? null,
          category: (x.category as any) ?? "other",
        }));
        setRecent(mapped);
      } catch {
        setRecent([]);
      }
    })();
  }, []);

  const listForTab = useMemo(() => {
    if (tab === "recent") return recent;
    return all
      .filter((e: any) => (e.category ?? "other") === tab)
      .map((e) => ({ id: e.id, name: e.name, defaultUnit: e.defaultUnit, category: e.category as any }));
  }, [tab, all, recent]);

  const handleStartNew = async () => setSession(await startSession());

  const handleContinue = async () => {
    try {
      setBusy(true);
      const res = await apiContinue();
      if (res?.ok && res.session) {
        setSession(res.session as Session); // 直接採用後端回傳
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6">
      {/* Header：置中標題 + 右側按鈕 */}
      <header className="relative mb-3">
        {/* 標題置中，使用 Oswald */}
        <h1 className="font-title text-2xl font-semibold absolute left-1/2 -translate-x-1/2">
          Workout Notes
        </h1>

        {/* 右側控制列 */}
        <div className="hidden sm:flex items-center gap-3 justify-end">
          <Link
            href="/settings"
            className="px-3 py-2 rounded-xl border text-gray-200 hover:bg-white/10"
          >
            設定
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handleStartNew}
              className="px-4 py-2 rounded-2xl border border-white hover:bg-white/10"
            >
              新訓練
            </button>
            <button
              onClick={handleContinue}
              disabled={busy}
              className="px-4 py-2 rounded-2xl bg-white text-black disabled:opacity-50"
            >
              接續紀錄
            </button>
          </div>
        </div>
      </header>

        {/* 行動版主要操作列 */}
        <div className="flex sm:hidden gap-2">
          <Link href="/settings" className="flex-1 px-4 py-3 rounded-2xl border text-center">
            設定
          </Link>
          <button onClick={handleStartNew} className="flex-1 px-4 py-3 rounded-2xl border">
            新訓練
          </button>
          <button onClick={handleContinue} disabled={busy} className="flex-1 px-4 py-3 rounded-2xl bg-black text-white disabled:opacity-50">
            接續
          </button>
        </div>

        {/* 橫向滑動 TabBar */}
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 rounded-xl border ${tab === t.key ? "bg-black text-white" : "bg-white"}`}
                aria-pressed={tab === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 清單 */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {listForTab.map((ex) => (
              <Link
                key={ex.id}
                href={`/exercise?exerciseId=${ex.id}&sessionId=${session?.id ?? ""}`}
                className="rounded-2xl border p-4 text-center hover:bg-gray-50"
              >
                {ex.name}
              </Link>
            ))}
            {listForTab.length === 0 && <div className="text-sm text-gray-500">此分類尚無動作</div>}
          </div>
        </section>

        {/* 摘要 */}
        {session && (
          <div className="pt-2">
            <Link href={`/summary?sessionId=${session.id}`} className="underline text-sm">
              查看本次訓練摘要
            </Link>
          </div>
        )}
      </div>

      {/* 底部捷徑（行動版） */}
      <nav className="sm:hidden fixed bottom-4 inset-x-0 px-4">
        <div className="max-w-screen-sm mx-auto grid grid-cols-3 gap-3">
          <Link href="/history" className="rounded-2xl border bg-white py-3 text-center shadow-sm">
            歷史
          </Link>
          <Link href="/settings" className="rounded-2xl border bg-white py-3 text-center shadow-sm">
            設定
          </Link>
          <Link href="/sync" className="rounded-2xl border bg-white py-3 text-center shadow-sm">
            同步
          </Link>
        </div>
      </nav>
    </main>
  );
}