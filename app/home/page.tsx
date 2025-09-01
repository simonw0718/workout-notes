"use client";

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
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workout Notes</h1>
        <button
          onClick={handleStart}
          className="px-4 py-2 rounded-xl bg-black text-white"
        >
          {session ? "重新開始今天" : "開始新訓練"}
        </button>
      </header>

      <section>
        <h2 className="font-semibold mb-2">常用動作</h2>
        <div className="grid grid-cols-2 gap-3">
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

      <section>
        <h2 className="font-semibold mb-2">備選動作</h2>
        <div className="flex gap-3">
          <select
            className="border rounded-lg p-2 flex-1"
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
            className={`px-4 py-2 rounded-xl ${
              selected && session
                ? "bg-black text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            前往
          </Link>
        </div>
      </section>

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
