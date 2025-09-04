// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

import {
  startSession,
  endSession,
  listFavorites,
  listAllExercises,
  getLatestSession,   // ← 加進來
} from "@/lib/db";
import type { Session, Exercise } from "@/lib/models/types";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [favorites, setFavorites] = useState<Exercise[]>([]);
  const [all, setAll] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<string>("");

  // 是否為「進行中」場次（可新增動作）
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
    return () => {
      alive = false;
    };
  }, []);

  const handleStart = async () => {
    // 無論是否已有結束的 session，直接新開一場
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
    <main className="p-6 space-y-8">
      {/* 狀態 Banner：訓練中 / 休息中 */}
      <div className="w-full flex justify-center">
        <div
          className={`px-4 py-1 rounded-full text-sm font-medium ${
            isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {isActive ? "訓練中" : "休息中"}
        </div>
      </div>

      {/* 頁首 */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workout Notes</h1>
        <div className="space-x-3">
          <Link href="/history" className="underline">
            歷史
          </Link>

          <Link
            href="/settings"
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
          >
            設定
          </Link>

          <button
            onClick={handleStart}
            className="px-3 py-1 rounded-xl bg-black text-white"
          >
            重新開始今天
          </button>

          {isActive && (
            <button onClick={handleEnd} className="px-3 py-1 rounded-xl border">
              結束目前場次
            </button>
          )}
        </div>
      </header>

      {/* 常用動作 */}
      <section>
        <h2 className="font-semibold mb-2">常用動作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {favorites.map((ex) =>
            isActive ? (
              // 進行中：可點前往
              <Link
                key={ex.id}
                className="rounded-2xl border p-4 text-center hover:bg-gray-50"
                href={`/exercise?exerciseId=${ex.id}&sessionId=${session!.id}`}
              >
                {ex.name}
              </Link>
            ) : (
              // 非進行中：禁用（灰掉不可點）
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
            className="border rounded-lg p-2 flex-1"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!isActive}
          >
            <option value="">— 選擇動作 —</option>
            {all.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          {/* 前往按鈕：需要「已選動作 + 進行中」才開放 */}
          {selected && isActive ? (
            <Link
              href={`/exercise?exerciseId=${selected}&sessionId=${session!.id}`}
              className="px-4 py-2 rounded-xl bg-black text-white"
            >
              前往
            </Link>
          ) : (
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-gray-200 text-gray-500 cursor-not-allowed"
              aria-disabled="true"
            >
              前往
            </button>
          )}
        </div>
      </section>

      {/* 訓練摘要入口（有 session 才顯示即可，結束與否都能看摘要） */}
      {session && (
        <div className="pt-4">
          <Link
            href={`/summary?sessionId=${session.id}`}
            className="underline text-sm"
          >
            查看本次訓練摘要
          </Link>
        </div>
      )}
    </main>
  );
}
