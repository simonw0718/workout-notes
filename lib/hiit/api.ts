// lib/hiit/api.ts
'use client';

import { openDB, IDBPDatabase } from 'idb';
import { safeUUID } from '@/lib/utils/uuid';

/* ============================= Types ============================= */

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

export type HiitHistoryDto = {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: number;
  endedAt: number | null;
  status: 'completed' | 'interrupted';
  totalWorkSec: number;
  totalRestSec: number;
  roundsDone?: number | null;
  setsDone?: number | null;
  skippedSteps?: string[] | null;
  notes?: string | null;
  snapshot: {
    name: string;
    description?: string;
    warmup_sec: number;
    cooldown_sec: number;
    steps: HiitWorkoutDto['steps'];
  };
  deletedAt?: string | null;
  updatedAt: number;
};

/** 方案匯出檔 */
export type WorkoutsExportFile = {
  type: 'hiit_workouts';
  version: 1;
  exportedAt: string;
  items: Array<Omit<HiitWorkoutDto, 'deletedAt' | 'updatedAt'>>;
};

/** 歷史匯出檔 */
export type HistoryExportFile = {
  type: 'hiit_history';
  version: 1;
  exportedAt: string;
  items: HiitHistoryDto[];
};

/* ============================= DB ============================= */

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
  hiit_history: {
    key: string;
    value: HiitHistoryDto;
    indexes: { by_deleted: string; by_ended: number; by_workout: string; by_updated: number };
  };
  hiit_meta: {
    key: string;
    value: { id: string; seeded_v: number };
  };
}>;

const DB_NAME = 'workout-notes-hiit';
const DB_VER = 2;

let _dbp: Promise<DB> | null = null;
function getDB() {
  if (!_dbp) {
    _dbp = openDB(DB_NAME, DB_VER, {
      upgrade(db, oldVersion) {
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
        if (oldVersion < 2 && !db.objectStoreNames.contains('hiit_history')) {
          const s = db.createObjectStore('hiit_history', { keyPath: 'id' });
          s.createIndex('by_deleted', 'deletedAt');
          s.createIndex('by_ended', 'endedAt');
          s.createIndex('by_workout', 'workoutId');
          s.createIndex('by_updated', 'updatedAt');
        }
      },
    }) as any;
  }
  return _dbp!;
}

/* ---------------------------- Seed（略保留） ---------------------------- */

const SEED_VERSION = 1;
async function sleep(ms:number){ return new Promise(r=>setTimeout(r, ms)); }
function normName(s: string) {
  const head = String(s || '').split('\n')[0] || '';
  return head.toLowerCase().replace(/\s+/g, ' ').trim();
}
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
export async function reloadSeedExercises(opts?: { clearExisting?: boolean }): Promise<{ added: number; total: number }> {
  const { clearExisting = false } = opts ?? {};
  const db = await getDB();
  const before = await db.count('hiit_exercises');
  const tx = db.transaction(['hiit_meta', 'hiit_exercises'], 'readwrite');
  if (clearExisting) await tx.objectStore('hiit_exercises').clear();
  await tx.objectStore('hiit_meta').put({ id: 'app', seeded_v: 0 });
  await tx.done;
  await ensureSeeded();
  const after = await db.count('hiit_exercises');
  const added = after - (clearExisting ? 0 : before);
  return { added, total: after };
}
async function ensureSeeded() {
  const db = await getDB();
  let meta = (await db.get('hiit_meta', 'app')) as { id:'app'; seeded_v:number } | undefined;
  if (!meta) { meta = { id: 'app', seeded_v: 0 }; await db.put('hiit_meta', meta); }
  if ((meta.seeded_v ?? 0) >= SEED_VERSION) return;
  if (meta.seeded_v === -1) {
    for (let i = 0; i < 40; i++) { await sleep(100); const m2 = await db.get('hiit_meta', 'app'); if (m2 && (m2 as any).seeded_v !== -1) return; }
  } else {
    await db.put('hiit_meta', { id: 'app', seeded_v: -1 });
  }
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
    await db.put('hiit_meta', { id: 'app', seeded_v: SEED_VERSION });
    await dedupeByName();
  }
}

/* ============================= Exercises ============================= */

export async function listHiitExercises(opts?: {
  q?: string;
  category?: HiitExerciseDto['primaryCategory'];
  status?: 'no' | 'only' | 'all';
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

/** 匯出全部方案（未刪除） */
export async function exportWorkouts(): Promise<WorkoutsExportFile> {
  const db = await getDB();
  const all = await db.getAll('hiit_workouts');
  const items = (all ?? [])
    .filter(x => !x.deletedAt)
    .map(({ updatedAt, deletedAt, ...rest }) => rest);
  return {
    type: 'hiit_workouts',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
}

/**
 * 匯入方案
 * - overwrite=true：同名覆蓋（沿用既有 id，PUT）
 * - overwrite=false：同名跳過（回傳 conflicts）
 * - 若檔內 id 與庫內已存在但名稱不同 → 產生新 id 再新增，避免 Key already exists
 */
export async function importWorkouts(
  file: WorkoutsExportFile,
  opts?: { overwrite?: boolean }
): Promise<{ added: number; updated: number; skipped: number; conflicts: string[] }> {
  if (!file || file.type !== 'hiit_workouts') throw new Error('檔案格式不正確');
  const overwrite = !!opts?.overwrite;
  const db = await getDB();

  const tx = db.transaction('hiit_workouts', 'readwrite');
  const store = tx.store as any;
  const idxByName = store.index('by_name');

  let added = 0, updated = 0, skipped = 0;
  const conflicts: string[] = [];

  for (const raw of file.items ?? []) {
    const name = String(raw.name || '').trim();
    if (!name) { skipped++; continue; }

    const sameName = await idxByName.getAll(name) as (HiitWorkoutDto & { updatedAt:number })[];
    if (sameName && sameName.length > 0) {
      if (!overwrite) { skipped++; conflicts.push(name); continue; }
      const target = sameName[0];
      const next: HiitWorkoutDto & { updatedAt: number } = {
        ...target,
        ...raw,
        id: target.id,
        deletedAt: null,
        updatedAt: Date.now(),
      };
      await store.put(next);
      updated++;
      continue;
    }

    const existedById = raw.id ? await store.get(raw.id) : null;
    const id = existedById ? safeUUID() : (raw.id || safeUUID());

    const row: HiitWorkoutDto & { updatedAt: number } = {
      ...raw,
      id,
      deletedAt: null,
      updatedAt: Date.now(),
    };
    await store.add(row);
    added++;
  }

  await tx.done;
  return { added, updated, skipped, conflicts };
}

/* ============================== History ============================== */

export async function createHistory(input: Omit<HiitHistoryDto, 'id' | 'updatedAt'>) {
  const db = await getDB();
  const row: HiitHistoryDto = { ...input, id: safeUUID(), updatedAt: Date.now() };
  await db.add('hiit_history', row);
  return row;
}

export async function updateHistory(id: string, patch: Partial<Omit<HiitHistoryDto, 'id'>>) {
  const db = await getDB();
  const cur = await db.get('hiit_history', id);
  if (!cur) throw new Error('not found');
  const next: HiitHistoryDto = { ...cur, ...patch, id, updatedAt: Date.now() };
  await db.put('hiit_history', next);
  return next;
}

export async function getHistory(id: string) {
  const db = await getDB();
  const it = await db.get('hiit_history', id);
  if (!it || it.deletedAt) throw new Error('not found');
  return it;
}

export async function listHistory(opts?: {
  q?: string;
  workoutId?: string;
  status?: 'no' | 'only' | 'all';
  limit?: number;
  offset?: number;
  sort?: 'endedAt_desc' | 'endedAt_asc' | 'updated_desc';
}) {
  const db = await getDB();
  const { q, workoutId, status = 'no', limit = 50, offset = 0, sort = 'endedAt_desc' } = opts ?? {};
  let rows = await db.getAll('hiit_history');

  if (status === 'no')   rows = rows.filter(x => !x.deletedAt);
  if (status === 'only') rows = rows.filter(x => !!x.deletedAt);
  if (workoutId)         rows = rows.filter(x => x.workoutId === workoutId);
  if (q && q.trim()) {
    const k = q.trim().toLowerCase();
    rows = rows.filter(x =>
      x.workoutName.toLowerCase().includes(k) ||
      (x.notes ?? '').toLowerCase().includes(k)
    );
  }

  rows.sort((a,b) => {
    if (sort === 'endedAt_asc')  return (a.endedAt ?? 0) - (b.endedAt ?? 0);
    if (sort === 'updated_desc') return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    return (b.endedAt ?? 0) - (a.endedAt ?? 0);
  });

  return rows.slice(offset, offset + limit);
}

export async function deleteHistory(id: string, hard = false) {
  const db = await getDB();
  if (hard) {
    await db.delete('hiit_history', id);
    return;
  }
  const cur = await db.get('hiit_history', id);
  if (!cur) return;
  await db.put('hiit_history', { ...cur, deletedAt: new Date().toISOString(), updatedAt: Date.now() });
}

export async function restoreHistory(id: string) {
  const db = await getDB();
  const cur = await db.get('hiit_history', id);
  if (!cur) return;
  await db.put('hiit_history', { ...cur, deletedAt: null, updatedAt: Date.now() });
}

export async function clearAllHistory() {
  const db = await getDB();
  await db.clear('hiit_history');
}

/** 匯出所有歷史（未刪除） */
export async function exportHistory(): Promise<HistoryExportFile> {
  const db = await getDB();
  const rows = await db.getAll('hiit_history');
  const items = (rows ?? []).filter(r => !r.deletedAt);
  return {
    type: 'hiit_history',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
}

/**
 * 匯入歷史
 * - overwrite=true：同 id 覆蓋
 * - overwrite=false：同 id 產生新 id 後新增
 */
export async function importHistory(
  file: HistoryExportFile,
  opts?: { overwrite?: boolean }
): Promise<{ added: number; updated: number; skipped: number }> {
  if (!file || file.type !== 'hiit_history') throw new Error('檔案格式不正確');
  const overwrite = !!opts?.overwrite;
  const db = await getDB();

  let added = 0, updated = 0, skipped = 0;

  const tx = db.transaction('hiit_history', 'readwrite');
  const store = tx.store as any;

  for (const it of file.items ?? []) {
    if (!it || !it.workoutId) { skipped++; continue; }

    const existed = await store.get(it.id);
    if (existed) {
      if (overwrite) {
        await store.put({ ...it, updatedAt: Date.now() });
        updated++;
      } else {
        const newid = safeUUID();
        await store.add({ ...it, id: newid, updatedAt: Date.now() });
        added++;
      }
    } else {
      await store.add({ ...it, updatedAt: Date.now() });
      added++;
    }
  }

  await tx.done;
  return { added, updated, skipped };
}