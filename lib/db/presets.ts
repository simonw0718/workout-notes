// lib/db/presets.ts
// 獨立 DB，避免動到既有 DB schema
import { openDB, IDBPDatabase } from "idb";
import type { Preset } from "../models/presets";

const DB_NAME = "workout-notes-presets";
const DB_VER = 1;
const STORE = "presets";

let _dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VER, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "uuid" });
          s.createIndex("updatedAt", "updatedAt");
          s.createIndex("name", "name");
        }
      },
    });
  }
  return _dbPromise!;
}

export async function getAllPresets(): Promise<Preset[]> {
  const db = await getDB();
  return await db.getAll(STORE);
}

export async function upsertPresets(items: Preset[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const p of items) {
    await store.put(p);
  }
  await tx.done;
}

export async function bulkUpsertPresets(
  plan: { add: Preset[]; update: Preset[] }
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const p of plan.add) await store.put(p);
  for (const p of plan.update) await store.put(p);
  await tx.done;
}

export async function findByUUID(uuid: string): Promise<Preset | undefined> {
  const db = await getDB();
  return await db.get(STORE, uuid);
}

export async function countPresets(): Promise<number> {
  const db = await getDB();
  return await db.count(STORE);
}