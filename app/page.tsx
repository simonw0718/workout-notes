// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";

import {
  startSession,
  endSession,
  listAllExercises,
  listFavorites,
  resumeLatestSession,       // 本機接續 fallback
  listAllSessions,           // 本機最近使用：抓最近 N 場
  listSetsBySessionSafe,     // 本機最近使用：抓各場的組數
  listAllSets,               // 本機最近使用：全庫掃描備援
} from "@/lib/db";
import { getLatestSession } from "@/lib/db";

import type { Session, Exercise, SetRecord } from "@/lib/models/types";
import CurrentProgressCard from "@/components/CurrentProgressCard";
import { getRecentExercises, continueSession as apiContinue } from "@/lib/sync/api";

type TabKey = "recent" | "upper" | "lower" | "core" | "other";
const TABS: { key: TabKey; label: string }[] = [
  { key: "recent", label: "最近使用" },
  { key: "upper", label: "上肢" },
  { key: "lower", label: "下肢" },
  { key: "core", label: "核心" },
  { key: "other", label: "其他" },
];

// 更魯棒的本機備援：由最近 N 場訓練與必要時全庫的 sets 推出「最近使用」，依最後出現時間去重
async function buildLocalRecent(
  N = 3
): Promise<Array<Pick<Exercise, "id" | "name" | "defaultUnit" | "category">>> {
  const exAll = await listAllExercises();
  if (!exAll.length) return [];

  // 1) 取最近 N 場（優先 updatedAt，退而求其次 startedAt）
  const sessions = (await listAllSessions())
    .filter((s) => !s.deletedAt)
    .sort((a, b) => {
      const au = a.updatedAt ?? a.startedAt ?? 0;
      const bu = b.updatedAt ?? b.startedAt ?? 0;
      return bu - au;
    })
    .slice(0, Math.max(1, N));

  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushFromSets = (sets: SetRecord[]) => {
    sets
      .filter((x) => !x.deletedAt)
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      .forEach((r) => {
        if (!seen.has(r.exerciseId)) {
          seen.add(r.exerciseId);
          ordered.push(r.exerciseId);
        }
      });
  };

  // 掃最近 N 場
  for (const s of sessions) {
    const z = await listSetsBySessionSafe(s.id);
    pushFromSets(z);
  }

  // 2) 仍為空 → 用最新一場的所有組數推
  if (ordered.length === 0 && sessions[0]) {
    const z = await listSetsBySessionSafe(sessions[0].id);
    pushFromSets(z);
  }

  // 3) 仍為空 → 全庫所有組數（離線老資料也能顯示）
  if (ordered.length === 0) {
    const all = await listAllSets();
    pushFromSets(all);
  }

  if (ordered.length === 0) return [];

  const map = new Map(exAll.map((e) => [e.id, e]));
  return ordered
    .map((id) => map.get(id))
    .filter(Boolean)
    .map((e) => ({
      id: e!.id,
      name: e!.name,
      defaultUnit: e!.defaultUnit ?? null,
      category: (e!.category as any) ?? "other",
    }));
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [favorites, setFavorites] = useState<Exercise[]>([]);
  const [all, setAll] = useState<Exercise[]>([]);
  const [tab, setTab] = useState<TabKey>("recent");
  const [recent, setRecent] = useState<
    Pick<Exercise, "id" | "name" | "defaultUnit" | "category">[]
  >([]);
  const [busy, setBusy] = useState(false);

  // 只要 session 尚未 ended 視為訓練中
  const isActive = useMemo(() => !!(session && !session.endedAt), [session]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [s, favs, exAll] = await Promise.allSettled([
          getLatestSession(),
          listFavorites(),
          listAllExercises(),
        ]);
        if (!alive) return;
        setSession(s.status === "fulfilled" ? (s.value ?? null) : null);
        setFavorites(favs.status === "fulfilled" ? (favs.value ?? []) : []);
        setAll(exAll.status === "fulfilled" ? (exAll.value ?? []) : []);
      } catch {
        if (!alive) return;
        setSession(null);
        setFavorites([]);
        setAll([]);
      }
    })();

    (async () => {
      // 先打 API（伺服器版「最近使用」）
      let filled = false;
      try {
        const r = await getRecentExercises(5);
        const mapped = r.map((x) => ({
          id: x.id,
          name: x.name,
          defaultUnit: (x.defaultUnit as any) ?? null,
          category: (x.category as any) ?? "other",
        }));
        if (alive && mapped.length > 0) {
          setRecent(mapped);
          filled = true;
        }
      } catch (e) {
        console.warn("[Home] recent via API failed, will fallback to local:", e);
      }
      // 再用本機備援（離線 / server 未啟）
      if (!filled) {
        try {
          const local = await buildLocalRecent(3);
          if (alive) setRecent(local);
        } catch (e) {
          if (alive) setRecent([]);
          console.warn("[Home] local recent failed:", e);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const listForTab = useMemo(() => {
    if (tab === "recent") return recent;
    return all
      .filter((e: any) => (e.category ?? "other") === tab)
      .map((e) => ({
        id: e.id,
        name: e.name,
        defaultUnit: e.defaultUnit,
        category: e.category as any,
      }));
  }, [tab, all, recent]);

  const handleStart = async () => {
    try {
      setBusy(true);
      const s = await startSession();
      setSession(s ?? null);
    } catch (e: any) {
      alert(`無法開始新訓練：${e?.message ?? e}`);
      console.error("[Home] startSession failed:", e);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!session) return;
    try {
      setBusy(true);
      await endSession(session.id);
      const s = await getLatestSession();
      setSession(s ?? null);
    } catch (e: any) {
      alert(`無法結束訓練：${e?.message ?? e}`);
      console.error("[Home] endSession failed:", e);
    } finally {
      setBusy(false);
    }
  };

  // 接續：先打 API；失敗就本機接續（離線/未開 server 也能用）
  const handleContinue = async () => {
    try {
      setBusy(true);
      try {
        const res = await apiContinue();
        if (res?.ok && res.session) {
          setSession(res.session as Session);
          return;
        }
      } catch (e) {
        console.warn("[Home] server continue failed, fallback to local:", e);
      }
      const s = await resumeLatestSession();
      if (!s) {
        alert("找不到可接續的訓練。可以直接「開始訓練」。");
        return;
      }
      setSession(s);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-black">
      {/* 內容區 */}
      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6 sm:pb-6 relative">
        {/* 狀態 Banner */}
        <div className="w-full flex justify-center">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {isActive ? "訓練中" : "休息中"}
          </div>
        </div>

        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Workout Notes</h1>
          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/history"
              className="rounded-xl bg-black text-white border border-white px-3 py-1 text-sm hover:opacity-90"
            >
              歷史
            </Link>
            <Link
              href="/settings"
              className="rounded-xl bg-black text-white border border-white px-3 py-1 text-sm hover:opacity-90"
            >
              設定
            </Link>

            {!isActive ? (
              <>
                <button
                  onClick={handleStart}
                  disabled={busy}
                  className="px-3 py-1 rounded-xl bg-black text-white border border-white hover:opacity-90 disabled:opacity-50"
                >
                  開始訓練
                </button>
                <button
                  onClick={handleContinue}
                  disabled={busy}
                  className="px-3 py-1 rounded-xl bg-black text-white border border-white hover:opacity-90 disabled:opacity-50"
                >
                  繼續上次訓練
                </button>
              </>
            ) : (
              <button
                onClick={handleEnd}
                disabled={busy}
                className="px-3 py-1 rounded-xl bg-black text-white border border-white hover:opacity-90 disabled:opacity-50"
              >
                結束
              </button>
            )}
          </div>
        </header>

        {/* 行動版操作列 */}
        <div className="flex sm:hidden gap-2">
          {!isActive ? (
            <>
              <button
                onClick={handleStart}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white disabled:opacity-50"
              >
                開始訓練
              </button>
              <button
                onClick={handleContinue}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white disabled:opacity-50"
              >
                繼續上次
              </button>
              <Link
                href="/settings"
                className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white text-center"
              >
                設定
              </Link>
            </>
          ) : (
            <button
              onClick={handleEnd}
              disabled={busy}
              className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white disabled:opacity-50"
            >
              結束
            </button>
          )}
        </div>

        {/* 分類 Tabs */}
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 rounded-xl border ${
                  tab === t.key
                    ? "bg-black text-white border-white"
                    : "bg-white text-black"
                }`}
                aria-pressed={tab === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 清單（休息中唯讀） */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {listForTab.length === 0 && (
              <div className="text-gray-400">此分類尚無動作</div>
            )}
            {listForTab.map((ex) =>
              isActive && session ? (
                <Link
                  key={ex.id}
                  className="rounded-2xl bg-black text-white border border-white p-4 text-center hover:opacity-90"
                  href={`/exercise?exerciseId=${encodeURIComponent(
                    ex.id
                  )}&sessionId=${encodeURIComponent(session.id)}`}
                >
                  {ex.name}
                </Link>
              ) : (
                <button
                  key={ex.id}
                  disabled
                  className="rounded-2xl border border-neutral-700 p-4 text-center bg-neutral-800 text-neutral-300 cursor-not-allowed"
                  aria-disabled="true"
                >
                  {ex.name}
                </button>
              )
            )}
          </div>
        </section>

        <Suspense fallback={null}>
          <CurrentProgressCard />
        </Suspense>

        {/* 查看摘要 + 歷史（並排、同風格） */}
        {session && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Link
              href={`/summary?sessionId=${encodeURIComponent(session.id)}`}
              className="rounded-2xl bg-black text-white border border-white px-4 py-3 text-center hover:opacity-90"
            >
              查看本次訓練摘要
            </Link>
            <Link
              href="/history"
              className="rounded-2xl bg-black text-white border border-white px-4 py-3 text-center hover:opacity-90"
            >
              歷史
            </Link>
          </div>
        )}
      </div>
      {/* ✅ 已移除：底下四個浮動按鈕（避免行動版點擊失效問題） */}
            {/* --- 暫時測試用：HIIT 入口 --- */}
      <div className="mt-10 p-6 text-center border-t border-neutral-800">
        <Link
          href="/hiit"
          className="inline-block px-4 py-2 rounded-xl border border-white text-white bg-black hover:opacity-80"
        >
          🚀 前往 HIIT 測試頁
        </Link>
      </div>
      {/* --- 之後上線時可刪除 --- */}
    </main>
  );
}