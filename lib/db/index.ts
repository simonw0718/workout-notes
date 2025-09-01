import { openDB, IDBPDatabase } from "idb";
import type { Session, Exercise, SetRecord, Unit } from "@/lib/models/types";

let _db: IDBPDatabase | null = null;

export async function getDB() {
  if (_db) return _db;
  _db = await openDB("workout-notes", 1, {
    upgrade(db) {
      const s = db.createObjectStore("sessions", { keyPath: "id" });
      s.createIndex("by_startedAt", "startedAt");

      const e = db.createObjectStore("exercises", { keyPath: "id" });
      e.createIndex("by_name", "name");

      const st = db.createObjectStore("sets", { keyPath: "id" });
      st.createIndex("by_session", "sessionId");
      st.createIndex("by_exercise", "exerciseId");
    },
  });
  // 預設常用動作（只建立一次）
  const count = await _db.count("exercises");
  if (count === 0) {
    const presets = [
      { id: crypto.randomUUID(), name: "Bench Press", isFavorite: true },
      { id: crypto.randomUUID(), name: "Squat", isFavorite: true },
      { id: crypto.randomUUID(), name: "Deadlift", isFavorite: true },
      { id: crypto.randomUUID(), name: "Overhead Press" },
      { id: crypto.randomUUID(), name: "Barbell Row" },
    ] as Exercise[];
    const tx = _db.transaction("exercises", "readwrite");
    for (const ex of presets) await tx.store.put(ex);
    await tx.done;
  }
  return _db;
}

// Sessions
export async function startSession(): Promise<Session> {
  const db = await getDB();
  const session: Session = { id: crypto.randomUUID(), startedAt: Date.now() };
  await db.put("sessions", session);
  return session;
}
export async function endSession(id: string) {
  const db = await getDB();
  const s = (await db.get("sessions", id)) as Session | undefined;
  if (!s) return;
  s.endedAt = Date.now();
  await db.put("sessions", s);
}
export async function getLatestSession(): Promise<Session | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex("sessions", "by_startedAt");
  return all.reverse()[0];
}

// Exercises
export async function listFavorites(): Promise<Exercise[]> {
  const db = await getDB();
  const all = await db.getAll("exercises");
  return all.filter((x) => x.isFavorite).slice(0, 12);
}
export async function listAllExercises(): Promise<Exercise[]> {
  const db = await getDB();
  const all = await db.getAll("exercises");
  return all.sort((a, b) => a.name.localeCompare(b.name));
}
export async function getExerciseById(id: string) {
  const db = await getDB();
  return (await db.get("exercises", id)) as Exercise | undefined;
}

// Sets
// lib/db/index.ts
// …
export async function addSet(r: {
  sessionId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  unit?: Unit;
}): Promise<SetRecord> {
  const db = await getDB();
  const rec: SetRecord = {
    id: crypto.randomUUID(),
    sessionId: r.sessionId,
    exerciseId: r.exerciseId,
    weight: r.weight,
    reps: r.reps,
    unit: r.unit ?? "lb",
    createdAt: Date.now(),
  };
  await db.put("sets", rec);
  return rec;
}

export async function listSetsBySession(sessionId: string) {
  const db = await getDB();
  return (await db.getAllFromIndex(
    "sets",
    "by_session",
    IDBKeyRange.only(sessionId),
  )) as SetRecord[];
}
export async function listSetsBySessionAndExercise(
  sessionId: string,
  exerciseId: string,
) {
  const db = await getDB();
  const all = (await db.getAllFromIndex(
    "sets",
    "by_session",
    IDBKeyRange.only(sessionId),
  )) as SetRecord[];
  return all
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => b.createdAt - a.createdAt); // 新的在上
}

export async function deleteSet(id: string) {
  const db = await getDB();
  await db.delete("sets", id);
}

export async function getLastSetsForExercise(
  exerciseId: string,
  currentSessionId?: string,
  limit = 3,
): Promise<SetRecord[]> {
  const db = await getDB();

  // 先抓此動作的所有組數（依建立時間由新到舊）
  const allForExercise = (await db.getAllFromIndex(
    "sets",
    "by_exercise",
    IDBKeyRange.only(exerciseId),
  )) as SetRecord[];
  if (allForExercise.length === 0) return [];

  const sorted = allForExercise.sort((a, b) => b.createdAt - a.createdAt);

  // 找到「最近一次、且不是目前 session」的那個 sessionId
  const lastOther = sorted.find(
    (s) => !currentSessionId || s.sessionId !== currentSessionId,
  );
  if (!lastOther) return [];

  const lastSessionId = lastOther.sessionId;

  // 取該 session 的最後 N 組（由新到舊）
  const lastSessionSets = sorted
    .filter((s) => s.sessionId === lastSessionId)
    .slice(0, limit);

  return lastSessionSets;
}
