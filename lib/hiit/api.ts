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
async function ensureSeeded() {
  const db = await getDB();
  const meta = (await db.get('hiit_meta', 'app')) || { id: 'app', seeded_v: 0 };
  if ((meta.seeded_v ?? 0) >= SEED_VERSION) return;

  // 先嘗試從 public 路徑讀；若路徑不存在，靜默略過
  try {
    const res = await fetch('/hiit/seed_exercises.json', { cache: 'no-cache' });
    if (res.ok) {
      const list = (await res.json()) as any[];
      const tx = db.transaction('hiit_exercises', 'readwrite');
      for (const raw of list ?? []) {
        const id = safeUUID();
        const row: HiitExerciseDto & { id: string; updatedAt: number } = {
          id,
          name: raw.name?.trim() ?? 'Exercise',
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
        };
        await tx.store.add(row);
      }
      await tx.done;
    }
  } catch {
    // 不擋 UI
  }

  await db.put('hiit_meta', { id: 'app', seeded_v: SEED_VERSION });
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