// app/workout/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";

import {
  startSession,
  endSession,
  listAllExercises,
  resumeLatestSession,
  listAllSessions,
  listSetsBySessionSafe,
  listAllSets,
  getLatestSession,
} from "@/lib/db";
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

/* 本機備援：推出「最近使用」清單 */
async function buildLocalRecent(
  N = 3
): Promise<Array<Pick<Exercise, "id" | "name" | "defaultUnit" | "category">>> {
  const exAll = await listAllExercises();
  if (!exAll.length) return [];

  const sessions = (await listAllSessions()) as Session[];
  const recentSessions = sessions
    .filter((s) => !s.deletedAt)
    .sort((a, b) => {
      const au = Number(a.updatedAt ?? a.startedAt ?? 0);
      const bu = Number(b.updatedAt ?? b.startedAt ?? 0);
      return bu - au; // 新到舊
    })
    .slice(0, Math.max(1, N));

  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushFromSets = (sets: SetRecord[]) => {
    sets
      .filter((x) => !x.deletedAt)
      .sort(
        (a, b) =>
          Number(b.updatedAt ?? b.createdAt ?? 0) -
          Number(a.updatedAt ?? a.createdAt ?? 0)
      )
      .forEach((r) => {
        if (!seen.has(r.exerciseId)) {
          seen.add(r.exerciseId);
          ordered.push(r.exerciseId);
        }
      });
  };

  for (const s of recentSessions) {
    const z = await listSetsBySessionSafe(s.id);
    pushFromSets(z);
  }

  if (ordered.length === 0 && recentSessions[0]) {
    const z = await listSetsBySessionSafe(recentSessions[0].id);
    pushFromSets(z);
  }

  if (ordered.length === 0) {
    const allSets = await listAllSets();
    pushFromSets(allSets);
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
  /* ===== 訓練狀態/控制 ===== */
  const [session, setSession] = useState<Session | null>(null);
  const isActive = useMemo(() => !!(session && !session.endedAt), [session]);
  const [busy, setBusy] = useState(false);

  // 🔑 強制 CurrentProgressCard remount 的 key
  const [progressKey, setProgressKey] = useState(0);

  // 抽出共用的 session 重新載入邏輯
  const reloadSession = async () => {
    try {
      const s = await getLatestSession();
      setSession(s ?? null);
    } catch {
      setSession(null);
    }
  };

  // 首次載入：抓一次 session 狀態
  useEffect(() => {
    void reloadSession();
  }, []);

  // 頁面重新變可見 / 從 bfcache 回來時，重抓 session + 進度
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void (async () => {
          await reloadSession();
          setProgressKey((k) => k + 1); // 讓 CurrentProgressCard 重掛一次
        })();
      }
    };

    window.addEventListener("pageshow", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.removeEventListener("pageshow", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, []);

  const handleStart = async () => {
    try {
      setBusy(true);
      const s = await startSession();
      setSession(s ?? null);
      setProgressKey((k) => k + 1);
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
      setProgressKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = async () => {
    try {
      setBusy(true);
      try {
        const res = await apiContinue();
        if (res?.ok && res.session) {
          setSession(res.session as Session);
          setProgressKey((k) => k + 1);
          return;
        }
      } catch {
        // server 失敗就走本機
      }
      const s = await resumeLatestSession();
      if (!s) {
        alert("找不到可接續的訓練。可以直接「開始訓練」。");
        return;
      }
      setSession(s);
      setProgressKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  /* ===== 資料（各分頁） ===== */
  const [all, setAll] = useState<Exercise[]>([]);
  const [recent, setRecent] = useState<
    Pick<Exercise, "id" | "name" | "defaultUnit" | "category">[]
  >([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const exAll = await listAllExercises();
        if (alive) setAll(exAll ?? []);
      } catch {
        if (alive) setAll([]);
      }
    })();

    (async () => {
      let filled = false;
      try {
        const r = await getRecentExercises(5);
        const mapped = r.map((x) => ({
          id: x.id,
          name: x.name,
          defaultUnit: (x.defaultUnit as any) ?? null,
          category: (x.category as any) ?? "other",
        }));
        if (mapped.length) {
          if (alive) setRecent(mapped);
          filled = true;
        }
      } catch {
        // ignore
      }
      if (!filled) {
        try {
          const local = await buildLocalRecent(3);
          if (alive) setRecent(local);
        } catch {
          if (alive) setRecent([]);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const listForTab = (key: TabKey) => {
    if (key === "recent") return recent;
    return all
      .filter((e) => (e.category ?? "other") === key)
      .map((e) => ({
        id: e.id,
        name: e.name,
        defaultUnit: e.defaultUnit,
        category: e.category as any,
      }));
  };

  /* ===== Deck（水平卡片） ===== */
  const [index, setIndex] = useState(0); // 預設「最近使用」
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 當前卡片置中
  useEffect(() => {
    const wrap = wrapRef.current;
    const card = cardRefs.current[index];
    if (!wrap || !card) return;
    const delta = card.offsetLeft - (wrap.clientWidth / 2 - card.clientWidth / 2);
    wrap.scrollTo({ left: delta, behavior: "smooth" });
  }, [index]);

  const go = (dir: -1 | 1) => {
    setIndex((i) => Math.min(TABS.length - 1, Math.max(0, i + dir)));
  };

  /* 點清單 → 只有「訓練中」才允許導入動作頁 */
  async function goExercise(exId: string) {
    if (!isActive) return; // 休息中不可進入

    let s = session; // Session | null
    if (!s || s.endedAt) {
      const latest = await getLatestSession(); // Session | undefined
      if (!latest || latest.endedAt) return;
      setSession(latest);
      s = latest;
    }
    if (!s) return;

    // 這邊維持 location.href，避免跟現有路由行為打架
    location.href = `/exercise?exerciseId=${encodeURIComponent(
      exId
    )}&sessionId=${encodeURIComponent(s.id)}`;
  }

  return (
    <main className="min-h-[100dvh] bg-black">
      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6 sm:pb-6">
        {/* Title */}
        <h1 className="font-title text-2xl font-semibold text-center">Workout Note</h1>

        {/* 狀態膠囊 */}
        <div className="w-full flex justify-center">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {isActive ? "訓練中" : "休息中"}
          </div>
        </div>

        {/* 工具列（桌機版：置中） */}
        <div className="hidden sm:flex items-center justify-center gap-2">
          <Link
            href="/settings"
            className="px-3 py-1 rounded-xl border border-white text-white hover:opacity-90"
          >
            設定
          </Link>

          {!isActive ? (
            <>
              <button
                onClick={handleStart}
                disabled={busy}
                className="px-3 py-1 rounded-xl border border-white text-white hover:opacity-90 disabled:opacity-50"
              >
                開始訓練
              </button>
              <button
                onClick={handleContinue}
                disabled={busy}
                className="px-3 py-1 rounded-xl border border-white text-white hover:opacity-90 disabled:opacity-50"
              >
                繼續上次
              </button>
            </>
          ) : (
            <button
              onClick={handleEnd}
              disabled={busy}
              className="px-3 py-1 rounded-xl border border-white text-white hover:opacity-90 disabled:opacity-50"
            >
              結束
            </button>
          )}
        </div>

        {/* 行動版操作列（手機顯示） */}
        <div className="flex sm:hidden gap-2">
          <Link
            href="/settings"
            className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white text-center"
          >
            設定
          </Link>

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

        {/* Deck：水平卡片 */}
        <div className="relative">
          {/* 左/右箭頭 */}
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            className="absolute left-[-4px] top-1/2 -translate-y-1/2 z-10 px-2 py-1 rounded-xl border border-white/40 text-white/80 disabled:opacity-30"
            aria-label="上一頁"
          >
            ←
          </button>
          <button
            onClick={() => go(1)}
            disabled={index === TABS.length - 1}
            className="absolute right-[-4px] top-1/2 -translate-y-1/2 z-10 px-2 py-1 rounded-xl border border-white/40 text-white/80 disabled:opacity-30"
            aria-label="下一頁"
          >
            →
          </button>

          {/* 容器 */}
          <div
            ref={wrapRef}
            className="overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex gap-4 px-6">
              {TABS.map((t, i) => {
                const rows = listForTab(t.key);
                return (
                  <div
                    key={t.key}
                    ref={(el: HTMLDivElement | null) => {
                      cardRefs.current[i] = el;
                    }}
                    className="snap-center shrink-0 w-[86%] sm:w-[70%]"
                  >
                    <div className="rounded-2xl border border-white/15 bg-black/70 p-4">
                      {/* 主題文字置中 */}
                      <div className="text-lg font-semibold mb-2 text-center">
                        {t.label}
                      </div>

                      <ul className="space-y-2">
                        {rows.length === 0 && (
                          <li className="text-sm text-white/50 text-center">
                            此分類尚無動作
                          </li>
                        )}

                        {rows.map((ex) => (
                          <li key={ex.id}>
                            {isActive ? (
                              <button
                                onClick={() => goExercise(ex.id)}
                                className="w-full rounded-xl border border-white/15 bg-neutral-900/70 px-4 py-3 text-center hover:bg-neutral-800 active:opacity-90"
                                aria-label={`前往 ${ex.name}`}
                              >
                                {ex.name}
                              </button>
                            ) : (
                              <div
                                className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-center text-neutral-300 cursor-not-allowed"
                                aria-disabled="true"
                              >
                                {ex.name}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 頁點 */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {TABS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`size-2 rounded-full ${
                  i === index ? "bg-white" : "bg-white/30"
                }`}
                aria-label={`切換到第 ${i + 1} 頁`}
              />
            ))}
          </div>
        </div>

        {/* 本次進度卡片（用 key 控制 remount） */}
        <Suspense fallback={null}>
          <CurrentProgressCard key={progressKey} />
        </Suspense>

        {/* ===== 兩顆按鈕：查看本次訓練摘要 / 歷史 ===== */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {session ? (
            <Link
              href={`/summary?sessionId=${encodeURIComponent(session.id)}`}
              className="rounded-2xl bg-black text-white border border-white px-4 py-3 text-center hover:opacity-90"
            >
              查看本次訓練摘要
            </Link>
          ) : (
            <div
              className="rounded-2xl bg-black text-white/50 border border-white/30 px-4 py-3 text-center cursor-not-allowed"
              aria-disabled="true"
              title="目前沒有進行中的訓練"
            >
              查看本次訓練摘要
            </div>
          )}

          <Link
            href="/history"
            className="rounded-2xl bg-black text-white border border-white px-4 py-3 text-center hover:opacity-90"
          >
            歷史
          </Link>
        </div>
      </div>

      {/* 回到 HOME */}
      <div className="mt-10 p-6 text-center border-t border-neutral-800">
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl border border-white text-white bg-black hover:opacity-80"
        >
          HOME
        </Link>
      </div>
    </main>
  );
}