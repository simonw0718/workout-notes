// lib/db/history.ts
import { getDB } from "@/lib/db";
import type { Session, SetRecord, Exercise } from "@/lib/models/types";

/** 取回所有動作（exercises） */
export async function listAllExercises(): Promise<Exercise[]> {
  const db = await getDB();
  const all = await db.getAll("exercises");
  // 依名稱排序，或依 createdAt 排序都可
  all.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  return all as Exercise[];
}

/** 取回某 session 的所有 sets（依建立時間排序） */
export async function listSetsBySession(sessionId: string): Promise<SetRecord[]> {
  const db = await getDB();
  const sets = await db.getAllFromIndex(
    "sets",
    "by_session",
    IDBKeyRange.only(sessionId)
  );
  sets.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return sets as SetRecord[];
}

// 你原本已有的函式（例如 listAllSessions / getSessionDetail）可保留不動