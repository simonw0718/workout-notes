"use client";
//app/home/page.tsx

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  startSession,
  getLatestSession,
  listFavorites,
  listAllExercises,
} from "@/lib/db";
import type { Exercise, Session } from "@/lib/models/types";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [favorites, setFavorites] = useState<Exercise[]>([]);
  const [all, setAll] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    (async () => {
      setSession((await getLatestSession()) ?? null);
      setFavorites(await listFavorites());
      setAll(await listAllExercises());
    })();
  }, []);

  const handleStart = async () => {
    const s = await startSession();
    setSession(s);
  };

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Workout Notes</h1>
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/settings"
              className="px-3 py-2 rounded-xl border text-gray-800 hover:bg-gray-50"
            >
              設定
            </Link>
            <button
              onClick={handleStart}
              className="px-4 py-2 rounded-2xl bg-black text-white"
            >
              重新開始今天
            </button>
          </div>
        </header>

        {/* 行動版主要操作列 */}
        <div className="flex sm:hidden gap-2">
          <Link
            href="/settings"
            className="flex-1 px-4 py-3 rounded-2xl border text-center"
          >
            設定
          </Link>
          <button
            onClick={handleStart}
            className="flex-1 px-4 py-3 rounded-2xl bg-black text-white"
          >
            重新開始
          </button>
        </div>

        {/* 常用動作 */}
        <section>
          <h2 className="font-semibold mb-2">常用動作</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {favorites.map((ex) => (
              <Link
                key={ex.id}
                href={`/exercise?exerciseId=${ex.id}&sessionId=${session?.id ?? ""}`}
                className="rounded-2xl border p-4 text-center hover:bg-gray-50"
              >
                {ex.name}
              </Link>
            ))}
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
            >
              <option value="">— 選擇動作 —</option>
              {all.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>

            <Link
              href={
                selected && session
                  ? `/exercise?exerciseId=${selected}&sessionId=${session.id}`
                  : "#"
              }
              className={`px-4 py-3 rounded-2xl text-center ${
                selected && session ? "bg-black text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              前往
            </Link>
          </div>
        </section>

        {/* 摘要 */}
        {session && (
          <div className="pt-2">
            <Link
              href={`/summary?sessionId=${session.id}`}
              className="underline text-sm"
            >
              查看本次訓練摘要
            </Link>
          </div>
        )}
      </div>

      {/* 底部捷徑（行動版） */}
      <nav className="sm:hidden fixed bottom-4 inset-x-0 px-4">
        <div className="max-w-screen-sm mx-auto grid grid-cols-3 gap-3">
          <Link
            href="/history"
            className="rounded-2xl border bg-white py-3 text-center shadow-sm"
          >
            歷史
          </Link>
          <Link
            href="/settings"
            className="rounded-2xl border bg-white py-3 text-center shadow-sm"
          >
            設定
          </Link>
          <Link
            href="/sync"
            className="rounded-2xl border bg-white py-3 text-center shadow-sm"
          >
            同步
          </Link>
        </div>
      </nav>
    </main>
  );
}