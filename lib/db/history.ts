// lib/db/history.ts
import { getDB } from "@/lib/db"; // 你現有的 getDB
import type { Session, SetRecord, Exercise } from "@/lib/models/types";

/** 取得所有 session，依 startedAt DESC 排序 */
export async function listAllSessions(): Promise<Session[]> {
  const db = await getDB();
  // 你在 getDB 裡已建立 sessions.by_startedAt index
  const all = (await db.getAllFromIndex(
    "sessions",
    "by_startedAt",
  )) as Session[];
  // index 可能是升冪，這裡保險再反轉成最新在前
  return all.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
}

/** 取得單一場次的完整細節（session、sets、exerciseMap） */
export async function getSessionDetail(sessionId: string): Promise<{
  session: Session | undefined;
  sets: SetRecord[];
  exerciseMap: Record<string, Exercise>;
}> {
  const db = await getDB();

  const session = (await db.get("sessions", sessionId)) as Session | undefined;
  // 你已建立 sets.by_session index
  const sets = (await db.getAllFromIndex(
    "sets",
    "by_session",
    IDBKeyRange.only(sessionId),
  )) as SetRecord[];
  sets.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)); // 單場內時間先後

  // 取出本場用到的所有 exercise，組成查詢 map
  const exIds = Array.from(new Set(sets.map((s) => s.exerciseId)));
  const exerciseMap: Record<string, Exercise> = {};
  for (const id of exIds) {
    const ex = (await db.get("exercises", id)) as Exercise | undefined;
    if (ex) exerciseMap[id] = ex;
  }

  return { session, sets, exerciseMap };
}

/** 計算總量（Volume = Σ weight * reps），忽略缺值 */
export function computeVolume(sets: SetRecord[]): number {
  return sets.reduce((sum, s) => {
    const w = Number(s.weight ?? 0);
    const r = Number(s.reps ?? 0);
    return sum + (isFinite(w) && isFinite(r) ? w * r : 0);
  }, 0);
}

/** （可選）依動作分組，回傳 { exerciseId: SetRecord[] } */
export function groupSetsByExercise(
  sets: SetRecord[],
): Record<string, SetRecord[]> {
  return sets.reduce(
    (acc, s) => {
      (acc[s.exerciseId] ||= []).push(s);
      return acc;
    },
    {} as Record<string, SetRecord[]>,
  );
}
