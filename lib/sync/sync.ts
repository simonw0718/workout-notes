// lib/sync/sync.ts
import { getDB } from "@/lib/db";
import { getMeta, updateMeta } from "@/lib/db/meta";
import type { Exercise, Session, SetRecord } from "@/lib/models/types";
import { ensureRegistered } from "./auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "http://127.0.0.1:8000";

/* === 送 /sync 的 payload === */
type ChangesOut = {
  sessions: Session[];
  exercises: Exercise[];
  sets: SetRecord[];
};

export type SyncResponse = {
  serverVersion: number;
  changes: {
    sessions: Session[];
    exercises: Exercise[];
    sets: SetRecord[];
  };
};

/** 收集本機 dirty rows（以 store 全撈再過濾，簡單穩定） */
async function collectDirty(): Promise<ChangesOut> {
  const db = await getDB();
  const [s, e, z] = await Promise.all([
    db.getAll("sessions"),
    db.getAll("exercises"),
    db.getAll("sets"),
  ]);
  const onlyCleanType = <T extends { deletedAt?: number | null }>(xs: any[]): T[] =>
    xs as T[];

  return {
    sessions: onlyCleanType<Session>(s.filter((r) => r.dirty)),
    exercises: onlyCleanType<Exercise>(e.filter((r) => r.dirty)),
    sets: onlyCleanType<SetRecord>(z.filter((r) => r.dirty)),
  };
}

/** 把 server 回傳的變更套到本機，並把它們標記為非 dirty */
async function applyServerChanges(changes: ChangesOut): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "exercises", "sets"], "readwrite");

  const upsert = async <T extends { id: string }>(
    storeName: "sessions" | "exercises" | "sets",
    rows: T[],
  ) => {
    const s = tx.objectStore(storeName);
    for (const r of rows) {
      const cur = await s.get(r.id as any);
      // 以 server 為準 → 寫入並清 dirty
      await s.put({ ...(cur ?? {}), ...r, dirty: false, dirtyIdx: 0 } as any);
    }
  };

  await upsert("sessions", changes.sessions ?? []);
  await upsert("exercises", changes.exercises ?? []);
  await upsert("sets", changes.sets ?? []);

  await tx.done;
}

/** 把剛成功上傳的本機 rows 的 dirty 清掉（以 id 對應） */
async function clearUploadedDirty(payload: ChangesOut): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "exercises", "sets"], "readwrite");

  const clearByIds = async (
    storeName: "sessions" | "exercises" | "sets",
    ids: string[],
  ) => {
    const store = tx.objectStore(storeName);
    for (const id of ids) {
      const cur = await store.get(id as any);
      if (!cur) continue;
      await store.put({ ...cur, dirty: false, dirtyIdx: 0 } as any);
    }
  };

  await clearByIds(
    "sessions",
    (payload.sessions ?? []).map((x) => x.id),
  );
  await clearByIds(
    "exercises",
    (payload.exercises ?? []).map((x) => x.id),
  );
  await clearByIds(
    "sets",
    (payload.sets ?? []).map((x) => x.id),
  );

  await tx.done;
}

/** 主要同步流程：收集 → POST /sync → 寫回本地 → 更新版本 → 清 dirty */
export default async function syncNow(): Promise<SyncResponse> {
  const db = await getDB();
  const meta = await getMeta();
  // 確保已註冊（會把 userId/deviceId/token 寫進 meta）
  await ensureRegistered();

  const changes = await collectDirty();

  const resp = await fetch(`${API_BASE}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId: meta.deviceId,
      token: meta.token,
      lastVersion: meta.lastServerVersion ?? 0,
      changes,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`sync failed: ${resp.status} ${t}`);
  }

  const data = (await resp.json()) as SyncResponse;
  await applyServerChanges(data.changes);
  await updateMeta({ lastServerVersion: data.serverVersion });
  await clearUploadedDirty(changes);

  return data;
}