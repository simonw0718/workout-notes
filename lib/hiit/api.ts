// File: lib/hiit/api.ts
// 純前端 IndexedDB 版：提供與原本相同的函式簽名，頁面不用改 import
'use client';

import { openDB, IDBPDatabase } from 'idb';
import { safeUUID } from '@/lib/utils/uuid';

export type HiitExerciseDto = {
  id?: string;
  name: string;
  primaryCategory: 'cardio' | 'lower' | 'upper' | 'core' | 'full';
  defaultMode: 'time' | 'reps';
  defaultValue: number;
  movementType: string[];
  trainingGoal: string[];
  equipment: string;
  bodyPart: string[];
  cue?: string;
  coachNote?: string;
  isBilateral?: boolean;
  deletedAt?: string | null;
  updatedAt?: number;
};

export type HiitWorkoutDto = {
  id: string;
  name: string;
  description?: string;
  warmup_sec: number;
  cooldown_sec: number;
  steps: Array<{
    order: number;
    title: string;
    work_sec: number;
    rest_sec: number;
    rounds: number;
    sets: number;
    inter_set_rest_sec: number;
  }>;
  deletedAt?: string | null;
  updatedAt?: number;
};

type DB = IDBPDatabase<{
  hiit_exercises: {
    key: string;
    value: HiitExerciseDto & { id: string; updatedAt: number };
    indexes: { by_deleted: string; by_name: string; by_cat: string; by_updated: number };
  };
  hiit_workouts: {
    key: string;
    value: HiitWorkoutDto & { id: string; updatedAt: number };
    indexes: { by_deleted: string; by_updated: number; by_name: string };
  };
  hiit_meta: {
    key: string;
    value: { id: string; seeded_v: number };
  };
}>;

const DB_NAME = 'workout-notes-hiit';
const DB_VER = 1;

let _dbp: Promise<DB> | null = null;
function getDB() {
  if (!_dbp) {
    _dbp = openDB(DB_NAME, DB_VER, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('hiit_exercises')) {
          const s = db.createObjectStore('hiit_exercises', { keyPath: 'id' });
          s.createIndex('by_deleted', 'deletedAt');
          s.createIndex('by_name', 'name');
          s.createIndex('by_cat', 'primaryCategory');
          s.createIndex('by_updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('hiit_workouts')) {
          const s = db.createObjectStore('hiit_workouts', { keyPath: 'id' });
          s.createIndex('by_deleted', 'deletedAt');
          s.createIndex('by_updated', 'updatedAt');
          s.createIndex('by_name', 'name');
        }
        if (!db.objectStoreNames.contains('hiit_meta')) {
          db.createObjectStore('hiit_meta', { keyPath: 'id' });
        }
      },
    }) as any;
  }
  return _dbp!;
}

/* ---------------------------- 首次載入 seed ---------------------------- */
const SEED_VERSION = 1;

async function sleep(ms:number){ return new Promise(r=>setTimeout(r, ms)); }

/** 依「英文主標」做 normalize，避免大小寫/空白差異 */
function normName(s: string) {
  const head = String(s || '').split('\n')[0] || '';
  return head.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 去重：同名（normalize 後）只保留最新一筆 */
async function dedupeByName() {
  const db = await getDB();
  const all = await db.getAll('hiit_exercises');
  if (!all?.length) return;
  const byKey = new Map<string, { keep: any; dups: any[] }>();

  for (const row of all) {
    const key = normName(row.name);
    const bucket = byKey.get(key) ?? { keep: null as any, dups: [] as any[] };
    if (!bucket.keep || row.updatedAt > bucket.keep.updatedAt) {
      if (bucket.keep) bucket.dups.push(bucket.keep);
      bucket.keep = row;
    } else {
      bucket.dups.push(row);
    }
    byKey.set(key, bucket);
  }

  const dels = Array.from(byKey.values()).flatMap(b => b.dups);
  if (!dels.length) return;

  const tx = db.transaction('hiit_exercises', 'readwrite');
  for (const d of dels) await tx.store.delete(d.id);
  await tx.done;
}

/** 首次載入 seed（含鎖機制防止競態），並在最後做一次去重 */
async function ensureSeeded() {
  const db = await getDB();

  // 1) 嘗試取得/建立 meta
  let meta = (await db.get('hiit_meta', 'app')) as { id:'app'; seeded_v:number } | undefined;
  if (!meta) {
    meta = { id: 'app', seeded_v: 0 };
    await db.put('hiit_meta', meta);
  }

  // 2) 已是最新就直接退出
  if ((meta.seeded_v ?? 0) >= SEED_VERSION) {
    return;
  }

  // 3) 若看到「別人正在 seed」（-1），就等待它完成
  if (meta.seeded_v === -1) {
    for (let i = 0; i < 40; i++) { // 最多等 4 秒
      await sleep(100);
      const m2 = await db.get('hiit_meta', 'app');
      if (m2 && (m2 as any).seeded_v !== -1) return;
    }
    // 超時就繼續由自己處理（降級）
  } else {
    // 4) 嘗試「佔鎖」
    await db.put('hiit_meta', { id: 'app', seeded_v: -1 });
  }

  // 5) 真正執行 seeding
  try {
    const res = await fetch('/hiit/seed_exercises.json', { cache: 'no-cache' });
    if (res.ok) {
      const list = (await res.json()) as any[];
      const tx = db.transaction('hiit_exercises', 'readwrite');
      const idxByName = tx.store.index('by_name');

      for (const raw of list ?? []) {
        const name = String(raw.name ?? '').trim();
        if (!name) continue;
        const existed = await idxByName.getAll(name);
        if (Array.isArray(existed) && existed.length > 0) continue;

        await tx.store.add({
          id: safeUUID(),
          name,
          primaryCategory: raw.primaryCategory ?? 'full',
          defaultMode: raw.defaultMode ?? 'time',
          defaultValue: Number(raw.defaultValue ?? 30),
          movementType: raw.movementType ?? [],
          trainingGoal: raw.trainingGoal ?? [],
          equipment: raw.equipment ?? '無',
          bodyPart: raw.bodyPart ?? [],
          cue: raw.cue ?? '',
          coachNote: raw.coachNote ?? '',
          isBilateral: !!raw.isBilateral,
          deletedAt: null,
          updatedAt: Date.now(),
        });
      }
      await tx.done;
    }
  } finally {
    // 6) 解除鎖並升級版本
    await db.put('hiit_meta', { id: 'app', seeded_v: SEED_VERSION });
    // 7) 去重
    await dedupeByName();
  }
}

/**
 * 手動重新載入 seed：
 * - clearExisting=false（預設）→ 合併匯入，不清空現有自訂，避免重複。
 * - clearExisting=true → 先清空 hiit_exercises 再匯入預設。
 * 備註：會把 seeded_v 重設為 0，確保 ensureSeeded 會執行。
 */
export async function reloadSeedExercises(opts?: { clearExisting?: boolean }): Promise<{ added: number; total: number }> {
  const { clearExisting = false } = opts ?? {};
  const db = await getDB();

  const before = await db.count('hiit_exercises');

  const tx = db.transaction(['hiit_meta', 'hiit_exercises'], 'readwrite');
  if (clearExisting) {
    await tx.objectStore('hiit_exercises').clear();
  }
  await tx.objectStore('hiit_meta').put({ id: 'app', seeded_v: 0 });
  await tx.done;

  await ensureSeeded();

  const after = await db.count('hiit_exercises');
  const added = after - (clearExisting ? 0 : before);
  return { added, total: after };
}

/* ============================= Exercises ============================= */

export async function listHiitExercises(opts?: {
  q?: string;
  category?: HiitExerciseDto['primaryCategory'];
  status?: 'no' | 'only' | 'all';   // 'no'=未刪, 'only'=僅已刪, 'all'=全部
  sort?: 'category' | 'name';
  limit?: number;
}): Promise<HiitExerciseDto[]> {
  await ensureSeeded();
  const db = await getDB();
  const all = await db.getAll('hiit_exercises');
  let arr = (all ?? []).map(({ updatedAt, ...x }) => x);

  const { q, category, status = 'no', sort = 'category', limit = 500 } = opts ?? {};
  if (status === 'no')   arr = arr.filter(x => !x.deletedAt);
  if (status === 'only') arr = arr.filter(x => !!x.deletedAt);
  if (category)          arr = arr.filter(x => x.primaryCategory === category);
  if (q && q.trim()) {
    const k = q.trim().toLowerCase();
    arr = arr.filter(x =>
      (x.name ?? '').toLowerCase().includes(k) ||
      (x.cue ?? '').toLowerCase().includes(k) ||
      (x.coachNote ?? '').toLowerCase().includes(k) ||
      (x.bodyPart ?? []).some(b => String(b).toLowerCase().includes(k))
    );
  }
  if (sort === 'category') {
    arr.sort((a,b) =>
      (a.primaryCategory || '').localeCompare(b.primaryCategory || '') ||
      (a.name || '').localeCompare(b.name || '')
    );
  } else {
    arr.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }
  return arr.slice(0, limit);
}

export async function getExercise(id: string): Promise<HiitExerciseDto> {
  const db = await getDB();
  const row = await db.get('hiit_exercises', id);
  if (!row) throw new Error('not found');
  const { updatedAt, ...x } = row;
  return x;
}

export async function createExercise(input: Omit<HiitExerciseDto, 'id' | 'deletedAt' | 'updatedAt'>) {
  const db = await getDB();
  const now = Date.now();
  const row = { ...input, id: safeUUID(), deletedAt: null, updatedAt: now };
  await db.add('hiit_exercises', row);
  const { updatedAt, ...x } = row;
  return x;
}

export async function updateExercise(id: string, patch: Omit<HiitExerciseDto, 'id' | 'deletedAt' | 'updatedAt'>) {
  const db = await getDB();
  const cur = await db.get('hiit_exercises', id);
  if (!cur) throw new Error('not found');
  const next = { ...cur, ...patch, id, updatedAt: Date.now() };
  await db.put('hiit_exercises', next);
}

export async function deleteExercise(id: string, hard = false) {
  const db = await getDB();
  if (hard) {
    await db.delete('hiit_exercises', id);
  } else {
    const cur = await db.get('hiit_exercises', id);
    if (!cur) return;
    await db.put('hiit_exercises', { ...cur, deletedAt: new Date().toISOString(), updatedAt: Date.now() });
  }
}

export async function restoreExercise(id: string) {
  const db = await getDB();
  const cur = await db.get('hiit_exercises', id);
  if (!cur) return;
  await db.put('hiit_exercises', { ...cur, deletedAt: null, updatedAt: Date.now() });
}

/* ============================== Workouts ============================= */

export async function listWorkouts(): Promise<HiitWorkoutDto[]> {
  const db = await getDB();
  const all = await db.getAll('hiit_workouts');
  const arr = (all ?? []).filter(x => !x.deletedAt);
  arr.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  return arr;
}

export async function getWorkout(id: string): Promise<HiitWorkoutDto> {
  const db = await getDB();
  const row = await db.get('hiit_workouts', id);
  if (!row) throw new Error('not found');
  const { updatedAt, ...x } = row;
  return x;
}

export async function createWorkout(payload: Omit<HiitWorkoutDto, 'id' | 'deletedAt' | 'updatedAt'>) {
  const db = await getDB();
  const now = Date.now();
  const row: HiitWorkoutDto & { updatedAt: number } = {
    ...payload,
    id: safeUUID(),
    deletedAt: null,
    updatedAt: now,
  };
  await db.add('hiit_workouts', row);
  const { updatedAt, ...x } = row;
  return x;
}

export async function updateWorkout(id: string, patch: Partial<Omit<HiitWorkoutDto, 'id'>>) {
  const db = await getDB();
  const cur = await db.get('hiit_workouts', id);
  if (!cur) throw new Error('not found');
  const next: HiitWorkoutDto & { updatedAt: number } = {
    ...cur,
    ...patch,
    id,
    updatedAt: Date.now(),
  };
  await db.put('hiit_workouts', next);
}

export async function deleteWorkout(id: string, hard = false) {
  const db = await getDB();
  if (hard) {
    await db.delete('hiit_workouts', id);
  } else {
    const cur = await db.get('hiit_workouts', id);
    if (!cur) return;
    await db.put('hiit_workouts', { ...cur, deletedAt: new Date().toISOString(), updatedAt: Date.now() });
  }
}