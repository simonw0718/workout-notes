// app/analytics/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  Tooltip,
  Legend,
} from "recharts";

import { getDB, listAllSets } from "@/lib/db";
import type { Exercise, SetRecord } from "@/lib/models/types";

/** 把 timestamp 轉成 YYYY-MM-DD */
function toDateKey(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AnalyticsPage() {
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [exMap, setExMap] = useState<Record<string, Exercise>>({});
  const [exerciseId, setExerciseId] = useState<string>(""); // Best Set 使用

  /** 載入資料（只做一次） */
  useEffect(() => {
    let alive = true;
    (async () => {
      const db = await getDB();
      const ss = await listAllSets();

      const allEx = (await db.getAll("exercises")) as Exercise[];
      const map: Record<string, Exercise> = {};
      for (const ex of allEx) map[ex.id] = ex;

      if (!alive) return;
      setSets(ss ?? []);
      setExMap(map);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** 當 exMap 準備好且尚未選擇 exerciseId 時，初始化預設選項 */
  useEffect(() => {
    if (!exerciseId) {
      const first = Object.values(exMap)[0];
      if (first) setExerciseId(first.id);
    }
  }, [exMap, exerciseId]);

  /** Volume 折線圖（每日總量） */
  const volumeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sets) {
      const key = toDateKey(s.createdAt);
      const vol = (s.weight ?? 0) * (s.reps ?? 0);
      map.set(key, (map.get(key) ?? 0) + vol);
    }
    const arr = Array.from(map.entries())
      .map(([date, vol]) => ({ date, vol }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
    return arr;
  }, [sets]);

  /** Best Set 折線圖（指定動作的最大重量） */
  const bestSetData = useMemo(() => {
    if (!exerciseId) return [];
    const map = new Map<string, number>(); // date -> maxWeight
    for (const s of sets) {
      if (s.exerciseId !== exerciseId) continue;
      const key = toDateKey(s.createdAt);
      const w = s.weight ?? 0;
      map.set(key, Math.max(map.get(key) ?? 0, w));
    }
    const arr = Array.from(map.entries())
      .map(([date, max]) => ({ date, max }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
    return arr;
  }, [sets, exerciseId]);

  const exerciseOptions = useMemo(
    () =>
      Object.values(exMap).map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.name}
        </option>
      )),
    [exMap],
  );

  return (
    <main className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">視覺化 Analytics</h1>
        <Link href="/" className="underline">
          回首頁
        </Link>
      </header>

      {/* Volume 折線圖 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">每日總量（Volume）</h2>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="vol"
                name="總量"
                dot={false}
                stroke="#2563eb"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Best Set 折線圖 */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Best Set（最大重量）</h2>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="rounded-lg border p-2 text-sm"
          >
            {exerciseOptions}
          </select>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bestSetData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="max"
                name="最大重量"
                dot={false}
                stroke="#10b981"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
