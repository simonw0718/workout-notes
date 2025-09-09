"use client";

import { useEffect, useMemo, useState } from "react";
import { getLatestSession, listSetsBySession, listAllExercises } from "@/lib/db";
import type { Session, SetRecord, Exercise } from "@/lib/models/types";

type Row = { name: string; count: number };

export default function CurrentProgressCard() {
  const [session, setSession] = useState<Session | null>(null);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [exMap, setExMap] = useState<Map<string, Exercise>>(new Map());

  const rows: Row[] = useMemo(() => {
    if (!session || sets.length === 0 || exMap.size === 0) return [];
    const byEx = new Map<string, number>();
    for (const s of sets) {
      byEx.set(s.exerciseId, (byEx.get(s.exerciseId) ?? 0) + 1);
    }
    const out: Row[] = [];
    for (const [exerciseId, count] of byEx.entries()) {
      const ex = exMap.get(exerciseId);
      if (!ex) continue;
      out.push({ name: ex.name, count });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [session, sets, exMap]);

  const hasData = rows.length > 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getLatestSession();
      if (!alive) return;
      setSession(s ?? null);
      if (s?.id) {
        const list = await listSetsBySession(s.id);
        if (!alive) return;
        setSets(list);
      } else {
        setSets([]);
      }
      const all = await listAllExercises();
      if (!alive) return;
      setExMap(new Map((all ?? []).map((e) => [e.id, e])));
    })();
    return () => { alive = false; };
  }, []);

  if (!session) return null;

  return (
    <section className="mt-4 rounded-2xl p-4 bg-black text-white">
      <h3 className="font-semibold mb-2">本次進度</h3>
      {!hasData ? (
        <div className="text-white/70 text-sm">尚未紀錄組數</div>
      ) : (
        <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between">
              <span>{r.name}</span>
              <span className="font-mono tabular-nums">{r.count} 組</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}