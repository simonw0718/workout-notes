"use client";
//app/page.tsx
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  startSession,
  endSession,
  listFavorites,
  listAllExercises,
} from "@/lib/db";
import { getLatestSession } from "@/lib/db/index";
import type { Session, Exercise } from "@/lib/models/types";
import CurrentProgressCard from "@/components/CurrentProgressCard";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [favorites, setFavorites] = useState<Exercise[]>([]);
  const [all, setAll] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<string>("");

  const isActive = useMemo(() => !!(session && !session.endedAt), [session]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getLatestSession();
        const favs = await listFavorites();
        const exAll = await listAllExercises();
        if (!alive) return;
        setSession(s ?? null);
        setFavorites(favs ?? []);
        setAll(exAll ?? []);
      } catch (e) {
        console.error("[Home] init failed:", e);
        setFavorites([]);
        setAll([]);
        setSession(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleStart = async () => {
    const s = await startSession();
    setSession(s);
  };

  const handleEnd = async () => {
    if (!session) return;
    await endSession(session.id);
    const s = await getLatestSession();
    setSession(s ?? null);
  };

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6">
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
            {favorites.map((ex) =>
              isActive ? (
                <Link
                  key={ex.id}
                  className="rounded-2xl bg-black text-white border border-white p-4 text-center hover:opacity-90"
                  href={`/exercise?exerciseId=${ex.id}&sessionId=${session!.id}`}
                >
                  {ex.name}
                </Link>
              ) : (
                <button
                  key={ex.id}
                  disabled
                  className="rounded-2xl border p-4 text-center bg-gray-100 text-gray-400 cursor-not-allowed"
                  aria-disabled="true"
                >
                  {ex.name}
                </button>
              ),
            )}
            {favorites.length === 0 && (
              <div className="text-gray-500">尚未設定常用動作</div>
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

            {selected && isActive ? (
              <Link
                href={`/exercise?exerciseId=${selected}&sessionId=${session!.id}`}
                className="px-4 py-3 rounded-2xl bg-black text-white border border-white"
              >
                前往
              </Link>
            ) : (
              <button
                disabled
                className="px-4 py-3 rounded-2xl bg-gray-200 text-gray-500 cursor-not-allowed"
                aria-disabled="true"
              >
                前往
              </button>
            )}
          </div>
        </section>

        {/* 本次進度卡（黑底白字） */}
        <CurrentProgressCard />

        {/* 訓練摘要入口 */}
        {session && (
          <div className="pt-2">
            <Link href={`/summary?sessionId=${session.id}`} className="underline text-sm">
              查看本次訓練摘要
            </Link>
          </div>
        )}
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