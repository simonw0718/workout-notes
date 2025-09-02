// lib/db/index.ts
import { openDB, IDBPDatabase } from "idb";
import type { Session, Exercise, SetRecord, Unit } from "@/lib/models/types";
import { uuid } from "@/lib/utils/uuid";

let _db: IDBPDatabase | null = null;

/** 取得（或初始化）IndexedDB */
export async function getDB() {
  if (_db) return _db;

  _db = await openDB("workout-notes", 2, {
    // 版本升級：建 store / 建 index 都在這裡完成
    upgrade(db, oldVersion, _newVersion, tx) {
      // v1：首次建立
      if (oldVersion < 1) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("by_startedAt", "startedAt");

        const e = db.createObjectStore("exercises", { keyPath: "id" });
        e.createIndex("by_name", "name");

        const st = db.createObjectStore("sets", { keyPath: "id" });
        st.createIndex("by_session", "sessionId");
        st.createIndex("by_exercise", "exerciseId");
      }

      // v2：exercises 新增 sortOrder 索引
      if (oldVersion < 2) {
        const store = tx.objectStore("exercises");
        const hasIndex = Array.from(store.indexNames).includes("by_sortOrder");
        if (!hasIndex) {
          store.createIndex("by_sortOrder", "sortOrder");
        }
      }
    },
  });

  // 首次啟動時塞預設常用動作
  const exCount = await _db.count("exercises");
  if (exCount === 0) {
    const presets: Exercise[] = [
      { id: uuid(), name: "Bench Press", isFavorite: true, sortOrder: 0 },
      { id: uuid(), name: "Squat", isFavorite: true, sortOrder: 1 },
      { id: uuid(), name: "Deadlift", isFavorite: true, sortOrder: 2 },
      { id: uuid(), name: "Overhead Press" },
      { id: uuid(), name: "Barbell Row" },
    ];
    const tx = _db.transaction("exercises", "readwrite");
    for (const ex of presets) await tx.store.put(ex);
    await tx.done;
  }

  return _db;
}

/* ----------------------------- Sessions ------------------------------ */

// lib/db/index.ts（或你放 startSession 的地方）
export async function startSession(): Promise<Session> {
  const db = await getDB();

  // 1) 先找出最近一場
  const latest = await getLatestSession();
  if (latest && !latest.endedAt) {
    // 2) 若未結束 → 自動補結束
    latest.endedAt = Date.now();
    await db.put("sessions", latest);
  }

  // 3) 建立新的 session
  const s: Session = { id: crypto.randomUUID(), startedAt: Date.now() };
  await db.put("sessions", s);
  return s;
}

export async function endSession(id: string): Promise<void> {
  const db = await getDB();
  const cur = (await db.get("sessions", id)) as Session | undefined;
  if (!cur) return;
  cur.endedAt = Date.now();
  await db.put("sessions", cur);
}

export async function getLatestSession(): Promise<Session | undefined> {
  const db = await getDB();
  const all = (await db.getAllFromIndex(
    "sessions",
    "by_startedAt",
  )) as Session[];
  return all.length ? all[all.length - 1] : undefined;
}

/* ---------------------------- Exercises ------------------------------ */

export async function listAllExercises(): Promise<Exercise[]> {
  const db = await getDB();
  const all = (await db.getAll("exercises")) as Exercise[];
  // 常用優先 → sortOrder → 名稱
  return all.sort((a, b) => {
    const fa = a.isFavorite ? 0 : 1;
    const fb = b.isFavorite ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

export async function listFavorites(limit = 12): Promise<Exercise[]> {
  const all = await listAllExercises();
  return all.filter((x) => x.isFavorite).slice(0, limit);
}

export async function getExerciseById(
  id: string,
): Promise<Exercise | undefined> {
  const db = await getDB();
  return (await db.get("exercises", id)) as Exercise | undefined;
}

export async function createExercise(input: {
  name: string;
  defaultWeight?: number;
  defaultReps?: number;
  defaultUnit?: Unit;
  isFavorite?: boolean;
}): Promise<Exercise> {
  const db = await getDB();

  let sortOrder: number | undefined;
  if (input.isFavorite) {
    const favs = await listFavorites(999);
    sortOrder =
      favs.length > 0 ? Math.max(...favs.map((f) => f.sortOrder ?? 0)) + 1 : 0;
  }

  const ex: Exercise = {
    id: uuid(),
    name: input.name.trim(),
    defaultWeight: input.defaultWeight,
    defaultReps: input.defaultReps,
    defaultUnit: input.defaultUnit ?? "kg",
    isFavorite: !!input.isFavorite,
    sortOrder,
  };

  await db.put("exercises", ex);
  return ex;
}

export async function updateExercise(patch: {
  id: string;
  name?: string;
  defaultWeight?: number;
  defaultReps?: number;
  defaultUnit?: Unit;
  isFavorite?: boolean;
  sortOrder?: number | null;
}): Promise<void> {
  const db = await getDB();
  const cur = (await db.get("exercises", patch.id)) as Exercise | undefined;
  if (!cur) return;

  const next: Exercise = {
    ...cur,
    ...(patch.name != null ? { name: patch.name } : {}),
    ...(patch.defaultWeight != null
      ? { defaultWeight: patch.defaultWeight }
      : {}),
    ...(patch.defaultReps != null ? { defaultReps: patch.defaultReps } : {}),
    ...(patch.defaultUnit != null ? { defaultUnit: patch.defaultUnit } : {}),
    ...(patch.isFavorite != null ? { isFavorite: patch.isFavorite } : {}),
    ...(patch.sortOrder != null
      ? { sortOrder: patch.sortOrder ?? undefined }
      : {}),
  };

  await db.put("exercises", next);
}

export async function deleteExercise(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("exercises", id);
}

/** 依 favorites 的新順序（ids 排序）更新 sortOrder */
export async function reorderFavorites(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("exercises", "readwrite");
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const cur = (await tx.store.get(id)) as Exercise | undefined;
    if (!cur || !cur.isFavorite) continue;
    await tx.store.put({ ...cur, sortOrder: i });
  }
  await tx.done;
}

/* -------------------------------- Sets ------------------------------- */

export async function addSet(r: {
  sessionId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  unit?: Unit;
  rpe?: number | null;
}): Promise<SetRecord> {
  const db = await getDB();
  const rec: SetRecord = {
    id: uuid(),
    sessionId: r.sessionId,
    exerciseId: r.exerciseId,
    weight: r.weight,
    reps: r.reps,
    unit: r.unit ?? "lb",
    rpe: r.rpe ?? null,
    createdAt: Date.now(),
  };
  await db.put("sets", rec);
  return rec;
}

// lib/db/index.ts
export async function listSetsBySession(
  sessionId: string,
): Promise<SetRecord[]> {
  if (!sessionId) return []; // ← 防呆，避免 DataError

  const db = await getDB();
  const list = (await db.getAllFromIndex(
    "sets",
    "by_session",
    IDBKeyRange.only(sessionId),
  )) as SetRecord[];

  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listSetsBySessionAndExercise(
  sessionId: string,
  exerciseId: string,
): Promise<SetRecord[]> {
  const db = await getDB();
  const list = (await db.getAllFromIndex(
    "sets",
    "by_session",
    IDBKeyRange.only(sessionId),
  )) as SetRecord[];
  return list
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("sets", id);
}

/**
 * 取得「某動作」在 **其它 session** 的最近 N 組（預設 3）
 * - 用 by_exercise index 取出，再排除當前 session
 * - 依 createdAt DESC 排序
 */
export async function getLastSetsForExercise(
  exerciseId: string,
  currentSessionId: string,
  limit = 3,
): Promise<SetRecord[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex(
    "sets",
    "by_exercise",
    IDBKeyRange.only(exerciseId),
  )) as SetRecord[];
  return all
    .filter(
      (s) => s.exerciseId === exerciseId && s.sessionId !== currentSessionId,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
/** 取得同一個 Session、同一個動作的「最新一組」（若無則回傳 null） */
export async function getLatestSetInSession(
  exerciseId: string,
  sessionId: string,
): Promise<SetRecord | null> {
  const db = await getDB();
  // 先用 by_session 取出本次 session 的所有組，再過濾同動作
  const inSession = (await db.getAllFromIndex(
    "sets",
    "by_session",
    IDBKeyRange.only(sessionId),
  )) as SetRecord[];

  const list = inSession
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => b.createdAt - a.createdAt);

  return list[0] ?? null;
}
/** 取得跨 Session 的「最新一組」（同動作；可排除當前 session），若無則回傳 null */
export async function getLatestSetAcrossSessions(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<SetRecord | null> {
  const db = await getDB();
  // 直接用 by_exercise 取出該動作的所有組
  const allByExercise = (await db.getAllFromIndex(
    "sets",
    "by_exercise",
    IDBKeyRange.only(exerciseId),
  )) as SetRecord[];

  const list = allByExercise
    .filter((s) => (excludeSessionId ? s.sessionId !== excludeSessionId : true))
    .sort((a, b) => b.createdAt - a.createdAt);

  return list[0] ?? null;
}
// 取得指定 session
export async function getSessionById(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return (await db.get("sessions", id)) as Session | undefined;
}

export async function listAllSets(): Promise<SetRecord[]> {
  const db = await getDB();
  const all = (await db.getAll("sets")) as SetRecord[];
  return all.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export async function listSetsBySessionSafe(
  sessionId: string,
): Promise<SetRecord[]> {
  const db = await getDB();
  try {
    const idx = db.transaction("sets").store.index("by_session"); // 若有建立索引
    const results = (await idx.getAll(sessionId)) as SetRecord[];
    return results ?? [];
  } catch {
    // 沒索引就全掃
    const all = (await db.getAll("sets")) as SetRecord[];
    return (all ?? []).filter((s) => s.sessionId === sessionId);
  }
}

/** 刪除一個 session 以及其所有 sets（建議用在管理） */
export async function deleteSessionWithSets(sessionId: string): Promise<void> {
  const db = await getDB(); // 這裡直接呼叫，因為 getDB 已經定義在同一檔案
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  const sessions = tx.objectStore("sessions");
  const sets = tx.objectStore("sets");

  try {
    // 先刪 sets：優先走索引（若存在 by_session）
    try {
      const idx = sets.index("by_session"); // 若不存在會 throw
      let cursor = await idx.openCursor(IDBKeyRange.only(sessionId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    } catch {
      // 沒有索引就 fallback：撈出全部 sets 後過濾
      const all = (await sets.getAll()) as SetRecord[];
      for (const s of all) {
        if (s.sessionId === sessionId) {
          await sets.delete(s.id);
        }
      }
    }

    // 再刪 session
    await sessions.delete(sessionId);

    await tx.done;
  } catch (e) {
    console.error("[deleteSessionWithSets] failed:", e);
    try {
      await tx.abort();
    } catch {}
    throw e;
  }
}
// lib/db.ts（節錄／新增）
// 你已經有的：getDB, deleteSessionWithSets, listSetsBySession ...

/** 清空所有 sessions 與 sets（歷史資料） */
export async function deleteAllHistory(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  try {
    await tx.objectStore("sets").clear();
    await tx.objectStore("sessions").clear();
    await tx.done;
  } catch (e) {
    try {
      await tx.abort();
    } catch {}
    throw e;
  }
}
