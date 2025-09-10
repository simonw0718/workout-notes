"use client";
// app/page.tsx
import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";

import {
  startSession,
  endSession,
  listFavorites,
  listAllExercises,
} from "@/lib/db";
import { getLatestSession } from "@/lib/db";

import type { Session, Exercise } from "@/lib/models/types";
import CurrentProgressCard from "@/components/CurrentProgressCard";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [favorites, setFavorites] = useState<Exercise[]>([]);
  const [all, setAll] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<string>("");

  // === SW 狀態（頁面底部顯示；不再有浮動提示） ===
  const [swControlled, setSwControlled] = useState<boolean | null>(null);
  const [swFileName, setSwFileName] = useState<string | null>(null);
  const [swShellVersion, setSwShellVersion] = useState<string | null>(null); // e.g. workout-shell-v4.5.8

  // 只要 session 存在且「尚未結束」就視為訓練中
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
      } catch (e) {
        console.error("[Home] init failed:", e);
        setSession(null);
        setFavorites([]);
        setAll([]);
      }
    })();

    // === 讀取 SW 狀態與 workout-shell 版本（顯示在頁面底部） ===
    (async () => {
      try {
        // 1) 是否受 SW 控制
        const controlled = !!navigator.serviceWorker?.controller;
        setSwControlled(controlled);

        // 2) 取得目前註冊的 SW 檔案 URL
        const reg = await navigator.serviceWorker?.getRegistration?.();
        const url =
          reg?.active?.scriptURL ||
          reg?.waiting?.scriptURL ||
          reg?.installing?.scriptURL ||
          null;

        // 檔名（備援顯示）
        const file = url ? url.split("/").pop() || "sw.js" : "sw.js";
        setSwFileName(file);

        // 3) 擷取 workout-shell 版本字串（e.g. "workout-shell-v4.5.8"）
        //    會去抓 SW 檔案內容，找 const VERSION = "vX.Y.Z" 或直接找 "workout-shell-vX.Y.Z"
        let shell: string | null = null;
        if (url) {
          try {
            const res = await fetch(url, { cache: "no-store" });
            const js = await res.text();

            // a) 先找 const VERSION = "v4.5.8"
            const m1 = js.match(/const\s+VERSION\s*=\s*["'`](v[\d.]+)["'`]/);
            if (m1 && m1[1]) {
              shell = `workout-shell-${m1[1]}`;
            } else {
              // b) 找到直接出現的 workout-shell-v4.5.8
              const m2 = js.match(/workout-shell-(v[\d.]+)/);
              if (m2 && m2[1]) shell = `workout-shell-${m2[1]}`;
            }
          } catch (e) {
            // 同源抓取失敗就忽略，改用檔名備援
            console.warn("[Home] fetch SW script failed:", e);
          }
        }
        setSwShellVersion(shell);

        // 4) 極端情況：若仍有舊版「浮動 SW 提示」DOM，直接隱藏
        try {
          document
            .querySelectorAll('[data-sw-toast], #sw-toast, .sw-floating-badge')
            .forEach((el) => (el as HTMLElement).style.display = "none");
        } catch {}
      } catch {
        setSwControlled(false);
        setSwFileName("sw.js");
        setSwShellVersion(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const handleStart = async () => {
    try {
      const s = await startSession();
      setSession(s ?? null);
    } catch (e) {
      console.error("[Home] startSession failed:", e);
    }
  };

  const handleEnd = async () => {
    if (!session) return;
    try {
      await endSession(session.id);
      const s = await getLatestSession();
      setSession(s ?? null);
    } catch (e) {
      console.error("[Home] endSession failed:", e);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-white">
      {/* 內容加下邊界，避免被行動版底部捷徑遮住 */}
      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6 pb-24 sm:pb-6">
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

        {/* 頁首 */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Workout Notes</h1>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/history" className="underline text-sm">歷史</Link>
            <Link
              href="/settings"
              className="rounded-xl bg-black text-white border border-white px-3 py-1 text-sm hover:opacity-90"
            >
              設定
            </Link>
            <button
              onClick={handleStart}
              className="px-3 py-1 rounded-xl bg-black text-white border border-white hover:opacity-90"
            >
              重新開始今天
            </button>
            {isActive && (
              <button
                onClick={handleEnd}
                className="px-3 py-1 rounded-xl bg-black text-white border border-white hover:opacity-90"
              >
                結束目前場次
              </button>
            )}
          </div>
        </header>

        {/* 行動版主要操作列 */}
        <div className="flex sm:hidden gap-2">
          <button
            onClick={handleStart}
            className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white"
          >
            重新開始今天
          </button>
          {isActive ? (
            <button
              onClick={handleEnd}
              className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white"
            >
              結束
            </button>
          ) : (
            <Link
              href="/settings"
              className="flex-1 px-4 py-3 rounded-2xl bg-black text-white border border-white text-center"
            >
              設定
            </Link>
          )}
        </div>

        {/* 常用動作 */}
        <section>
          <h2 className="font-semibold mb-2">常用動作</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {favorites.length === 0 && (
              <div className="text-gray-500">尚未設定常用動作</div>
            )}
            {favorites.map((ex) =>
              isActive && session ? (
                <Link
                  key={ex.id}
                  className="rounded-2xl bg-black text-white border border-white p-4 text-center hover:opacity-90"
                  href={`/exercise?exerciseId=${encodeURIComponent(ex.id)}&sessionId=${encodeURIComponent(session.id)}`}
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

        {/* 備選動作 */}
        <section>
          <h2 className="font-semibold mb-2">備選動作</h2>
          <div className="flex gap-3">
            <select
              className="border rounded-xl p-3 flex-1"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={!isActive}
            >
              <option value="">— 選擇動作 —</option>
              {all.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>

            {selected && isActive && session ? (
              <Link
                href={`/exercise?exerciseId=${encodeURIComponent(selected)}&sessionId=${encodeURIComponent(session.id)}`}
                className="px-4 py-3 rounded-2xl bg-black text-white border border-white"
              >
                前往
              </Link>
            ) : (
              <button
                disabled
                className="px-4 py-3 rounded-2xl bg-gray-200 text-gray-400 border border-gray-200 cursor-not-allowed"
                aria-disabled="true"
              >
                前往
              </button>
            )}
          </div>
        </section>

        {/* 本次進度卡 */}
        <Suspense fallback={null}>
          <CurrentProgressCard />
        </Suspense>

        {/* 訓練摘要入口 */}
        {session && (
          <div className="pt-2">
            <Link
              href={`/summary?sessionId=${encodeURIComponent(session.id)}`}
              className="underline text-sm"
            >
              查看本次訓練摘要
            </Link>
          </div>
        )}

        {/* 固定在內容最底的 SW 狀態列（不再有浮動訊息） */}
        <div className="pt-2 text-center text-xs text-gray-500">
          SW: {swControlled === null ? "—" : swControlled ? "controlled" : "not controlled"}
          {" · "}
          {swShellVersion ?? swFileName ?? "sw.js"}
        </div>
      </div>

      {/* 底部固定捷徑（行動版） */}
      <nav className="sm:hidden fixed bottom-4 inset-x-0 px-4">
        <div className="max-w-screen-sm mx-auto grid grid-cols-4 gap-3">
          <Link href="/history" className="rounded-2xl bg-black text-white border border-white py-3 text-center shadow-sm">
            歷史
          </Link>
          <Link href="/settings" className="rounded-2xl bg-black text-white border border-white py-3 text-center shadow-sm">
            設定
          </Link>
          <Link href="/sync" className="rounded-2xl bg-black text-white border border-white py-3 text-center shadow-sm">
            資料搬運
          </Link>
          <Link href="/diagnostics" className="rounded-2xl bg-black text-white border border-white py-3 text-center shadow-sm">
            偵錯
          </Link>
        </div>
      </nav>
    </main>
  );
}