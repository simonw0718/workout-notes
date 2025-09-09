import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { Exercise, Session, SetRecord, Meta, Unit } from "@/lib/models/types";
import { safeUUID } from "@/lib/utils/uuid";

// Row Types：資料含 updatedAt / dirty（與你的資料列一致）
export type SessionRow   = Session   & { updatedAt: number; dirty: boolean };
export type ExerciseRow  = Exercise  & { updatedAt: number; dirty: boolean };
export type SetRecordRow = SetRecord & { updatedAt: number; dirty: boolean };

// IndexedDB Schema
export interface WorkoutDB extends DBSchema {
  meta: {
    key: string;
    value: Meta;
  };

  sessions: {
    key: string;
    value: SessionRow;
    indexes: {
      updatedAt: number;
      dirtyIdx: number;
    };
  };

  exercises: {
    key: string;
    value: ExerciseRow;
    indexes: {
      updatedAt: number;
      dirtyIdx: number;
    };
  };

  sets: {
    key: string;
    value: SetRecordRow;
    indexes: {
      updatedAt: number;
      dirtyIdx: number;
      by_session: string;
    };
  };

  transferLogs: {
    key: string; // id
    value: {
      id: string;
      type: "export" | "import";
      at: string; // ISO
      count: number;
      filename?: string;
      source?: "share" | "download" | "paste";
      deviceUA?: string;
      notes?: string;
    };
    indexes: { at: string };
  };
}

type StoreName = "sessions" | "exercises" | "sets";

// 用 Promise 緩存 DB 連線
let _db: Promise<IDBPDatabase<WorkoutDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<WorkoutDB>> {
  if (!_db) {
    _db = openDB<WorkoutDB>("workout-notes", 6, {
      async upgrade(db, _oldVersion, _newVersion, tx) {
        // ---- meta ----
        if (db.objectStoreNames.contains("meta")) {
          const store = tx.objectStore("meta") as any;
          const keyPath = store.keyPath;
          if (keyPath !== "id") {
            const oldAll = await store.getAll();
            db.deleteObjectStore("meta");
            const newMeta = db.createObjectStore("meta", { keyPath: "id" });
            for (const it of oldAll ?? []) {
              const migrated = { ...it } as any;
              if (!migrated.id && migrated.key) {
                migrated.id = migrated.key;
                delete migrated.key;
              }
              if (!migrated.id) migrated.id = "app";
              await (newMeta as any).put(migrated);
            }
          }
        } else {
          db.createObjectStore("meta", { keyPath: "id" });
        }

        // ---- sessions / exercises / sets ----
        const ensure = (name: StoreName) => {
          if (!db.objectStoreNames.contains(name)) {
            const s = db.createObjectStore(name, { keyPath: "id" });
            (s as any).createIndex("updatedAt", "updatedAt");
            (s as any).createIndex("dirtyIdx", "dirty");
            if (name === "sets") (s as any).createIndex("by_session", "sessionId");
            return;
          }
          const s = tx.objectStore(name) as any;
          const idx: DOMStringList = s.indexNames;
          if (!idx.contains("updatedAt")) s.createIndex("updatedAt", "updatedAt");
          if (!idx.contains("dirtyIdx"))  s.createIndex("dirtyIdx",  "dirty");
          if (name === "sets" && !idx.contains("by_session")) {
            (s as any).createIndex("by_session", "sessionId");
          }
        };

        ensure("sessions");
        ensure("exercises");
        ensure("sets");

        // ---- transferLogs ----
        if (!db.objectStoreNames.contains("transferLogs")) {
          const s = db.createObjectStore("transferLogs", { keyPath: "id" });
          (s as any).createIndex("at", "at");
        } else {
          const s = tx.objectStore("transferLogs") as any;
          if (!s.indexNames.contains("at")) s.createIndex("at", "at");
        }
      },
    });

    // 確保 meta 有 deviceId
    const dbi = await _db;
    let meta = await dbi.get("meta", "app");
    if (!meta) {
      meta = { id: "app", deviceId: safeUUID() } as Meta;
      await dbi.put("meta", meta);
    } else if (!meta.deviceId) {
      meta.deviceId = safeUUID();
      await dbi.put("meta", meta);
    }
  }
  return _db!;
}

/* ---------------------- 小工具：取得 deviceId ---------------------- */
async function getDeviceId(): Promise<string> {
  const db = await getDB();
  const meta = await db.get("meta", "app");
  if (meta?.deviceId) return meta.deviceId;
  const deviceId = safeUUID();
  await db.put("meta", { id: "app", deviceId } as Meta);
  return deviceId;
}

/* ============================= Sessions ============================= */
export async function startSession(): Promise<Session> {
  const db = await getDB();
  const deviceId = await getDeviceId();
  const now = Date.now();

  const s: SessionRow = {
    id: safeUUID(),
    startedAt: now,
    endedAt: null,
    deletedAt: null,
    updatedAt: now,
    deviceId,
    dirty: true,
  };
  await db.put("sessions", s);
  return s;
}

export async function endSession(id: string): Promise<void> {
  const db = await getDB();
  const cur = await db.get("sessions", id);
  if (!cur) return;
  const now = Date.now();
  const next: SessionRow = { ...cur, endedAt: now, updatedAt: now, dirty: true };
  await db.put("sessions", next);
}

export async function getLatestSession(): Promise<Session | undefined> {
  const db = await getDB();
  const all = await db.getAll("sessions");
  if (!all || all.length === 0) return undefined;
  all.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  return all[all.length - 1];
}

export async function getSessionById(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return (await db.get("sessions", id)) ?? undefined;
}

/* ============================ Exercises ============================ */
export async function listAllExercises(): Promise<Exercise[]> {
  const db = await getDB();
  const all = await db.getAll("exercises");
  const sorted = (all ?? []).slice().sort((a, b) => {
    const fa = a.isFavorite ? 0 : 1;
    const fb = b.isFavorite ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

export async function listFavorites(limit = 12): Promise<Exercise[]> {
  const all = await listAllExercises();
  return all.filter((x) => !!x.isFavorite).slice(0, limit);
}

export async function getExerciseById(id: string): Promise<Exercise | undefined> {
  const db = await getDB();
  return (await db.get("exercises", id)) ?? undefined;
}

export async function createExercise(input: {
  name: string;
  defaultWeight?: number | null;
  defaultReps?: number | null;
  defaultUnit?: Unit | null;
  isFavorite?: boolean | null;
}): Promise<Exercise> {
  const db = await getDB();
  const deviceId = await getDeviceId();
  const now = Date.now();

  let sortOrder: number | null | undefined = undefined;
  if (input.isFavorite) {
    const favs = await listFavorites(999);
    sortOrder = favs.length > 0 ? Math.max(...favs.map((f) => f.sortOrder ?? 0)) + 1 : 0;
  }

  const ex: Exercise = {
    id: safeUUID(),
    name: input.name.trim(),
    defaultWeight: input.defaultWeight ?? null,
    defaultReps: input.defaultReps ?? null,
    defaultUnit: (input.defaultUnit as Unit | null) ?? "kg",
    isFavorite: !!input.isFavorite,
    sortOrder: sortOrder ?? null,
    deletedAt: null,
    updatedAt: now,
    deviceId,
  };

  const row: ExerciseRow = { ...ex, dirty: true };
  await db.put("exercises", row);
  return ex;
}

export async function updateExercise(patch: {
  id: string;
  name?: string;
  defaultWeight?: number | null;
  defaultReps?: number | null;
  defaultUnit?: Unit | null;
  isFavorite?: boolean | null;
  sortOrder?: number | null;
}): Promise<void> {
  const db = await getDB();
  const cur = await db.get("exercises", patch.id);
  if (!cur) return;
  const now = Date.now();

  const next: Exercise = {
    ...cur,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.defaultWeight !== undefined ? { defaultWeight: patch.defaultWeight } : {}),
    ...(patch.defaultReps !== undefined ? { defaultReps: patch.defaultReps } : {}),
    ...(patch.defaultUnit !== undefined ? { defaultUnit: patch.defaultUnit } : {}),
    ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite ?? null } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder ?? null } : {}),
    updatedAt: now,
  };

  const row: ExerciseRow = { ...next, dirty: true };
  await db.put("exercises", row);
}

export async function deleteExercise(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("exercises", id);
}

export async function reorderFavorites(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("exercises", "readwrite");
  const now = Date.now();

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const cur = (await tx.store.get(id)) as Exercise | undefined;
    if (!cur || !cur.isFavorite) continue;
    const next: ExerciseRow = { ...cur, sortOrder: i, updatedAt: now, dirty: true };
    await tx.store.put(next);
  }
  await tx.done;
}

/* =============================== Sets ============================== */
export async function addSet(r: {
  sessionId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  unit?: Unit | null;
  rpe?: number | null;
}): Promise<SetRecord> {
  const db = await getDB();
  const deviceId = await getDeviceId();
  const now = Date.now();

  const rec: SetRecordRow = {
    id: safeUUID(),
    sessionId: r.sessionId,
    exerciseId: r.exerciseId,
    weight: r.weight,
    reps: r.reps,
    unit: r.unit ?? "lb",
    rpe: r.rpe ?? null,
    createdAt: now,
    deletedAt: null,
    updatedAt: now,
    deviceId,
    dirty: true,
  };
  await db.put("sets", rec);
  return rec;
}

export async function listSetsBySession(sessionId: string): Promise<SetRecord[]> {
  if (!sessionId) return [];
  const db = await getDB();
  const list = (await db.getAllFromIndex("sets", "by_session", sessionId)) as SetRecord[];
  return (list ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function listSetsBySessionAndExercise(
  sessionId: string,
  exerciseId: string,
): Promise<SetRecord[]> {
  const list = await listSetsBySession(sessionId);
  return list.filter((s) => s.exerciseId === exerciseId);
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("sets", id);
}

export async function getLastSetsForExercise(
  exerciseId: string,
  currentSessionId: string,
  limit = 3,
): Promise<SetRecord[]> {
  const db = await getDB();
  const all = (await db.getAll("sets")) as SetRecord[];
  return (all ?? [])
    .filter((s) => s.exerciseId === exerciseId && s.sessionId !== currentSessionId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export async function getLatestSetInSession(
  exerciseId: string,
  sessionId: string,
): Promise<SetRecord | null> {
  const list = await listSetsBySession(sessionId);
  const filtered = list
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return filtered[0] ?? null;
}

export async function getLatestSetAcrossSessions(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<SetRecord | null> {
  const db = await getDB();
  const all = (await db.getAll("sets")) as SetRecord[];
  const list = (all ?? [])
    .filter((s) => s.exerciseId === exerciseId && (!excludeSessionId || s.sessionId !== excludeSessionId))
    .sort((a, b) => b.createdAt - a.createdAt);
  return list[0] ?? null;
}

export async function listAllSets(): Promise<SetRecord[]> {
  const db = await getDB();
  const all = (await db.getAll("sets")) as SetRecord[];
  return (all ?? []).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export async function listSetsBySessionSafe(sessionId: string): Promise<SetRecord[]> {
  const db = await getDB();
  try {
    const idx = (db.transaction("sets").store as any).index("by_session");
    const results = (await idx.getAll(sessionId)) as SetRecord[];
    return results ?? [];
  } catch {
    const all = (await db.getAll("sets")) as SetRecord[];
    return (all ?? []).filter((s) => s.sessionId === sessionId);
  }
}

export async function deleteSessionWithSets(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  const sessions = tx.objectStore("sessions");
  const sets = tx.objectStore("sets") as any;

  try {
    try {
      const idx = sets.index("by_session");
      let cursor = await idx.openCursor(sessionId);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    } catch {
      const all = (await sets.getAll()) as SetRecord[];
      for (const s of all ?? []) {
        if (s.sessionId === sessionId) {
          await sets.delete(s.id);
        }
      }
    }

    await sessions.delete(sessionId);
    await tx.done;
  } catch (e) {
    try { await tx.abort(); } catch {}
    throw e;
  }
}

export async function deleteAllHistory(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  await tx.objectStore("sets").clear();
  await tx.objectStore("sessions").clear();
  await tx.done;
}

/* ============================ Transfer Logs ============================ */
export async function addTransferLog(entry: {
  type: "export" | "import";
  count: number;
  filename?: string;
  source?: "share" | "download" | "paste";
  deviceUA?: string;
  notes?: string;
}) {
  const db = await getDB();
  const id = safeUUID();
  const at = new Date().toISOString();
  await db.put("transferLogs", { id, at, ...entry });
}

export async function listTransferLogs(limit = 20) {
  const db = await getDB();
  const all = await db.getAll("transferLogs");
  return (all ?? []).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function clearTransferLogs() {
  const db = await getDB();
  await db.clear("transferLogs");
}
// ① 列出全部 sessions（按 startedAt 升冪）
export async function listAllSessions(): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAll("sessions");
  return (all ?? []).slice().sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
}

// ② 批次 upsert 歷史（可選覆蓋）
export async function bulkUpsertHistory(
  data: { sessions: Session[]; sets: SetRecord[] },
  overwriteExisting = false,
): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  let applied = 0;

  // helper
  async function putIfNeeded(storeName: "sessions" | "sets", row: any) {
    const existed = await (tx.objectStore(storeName) as any).get(row.id);
    if (!existed || overwriteExisting) {
      await (tx.objectStore(storeName) as any).put({ ...row, dirty: true });
      applied++;
    }
  }

  for (const s of data.sessions ?? []) {
    await putIfNeeded("sessions", s);
  }
  for (const r of data.sets ?? []) {
    await putIfNeeded("sets", r);
  }

  await tx.done;
  return applied;
}

// （你已經有 listAllSets，如無則保留此備援）
// export async function listAllSets(): Promise<SetRecord[]> {
//   const db = await getDB();
//   const all = (await db.getAll("sets")) as SetRecord[];
//   return (all ?? []).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
// }