// /lib/hiit/api.ts
/**
 * 路徑：/lib/hiit/api.ts
 */
const BASE = process.env.NEXT_PUBLIC_HIIT_API_BASE || 'http://127.0.0.1:8000';

async function j(r: Response) {
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`[HIIT API] ${r.status} ${r.statusText} ${text}`.trim());
  }
  if (r.status === 204) return { ok: true };
  const text = await r.text().catch(() => '');
  if (!text) return { ok: true };
  try { return JSON.parse(text); } catch { return { ok: true, text }; }
}

// ---- Exercises ----
export async function listHiitExercises(params?: {
  q?: string; category?: string; equipment?: string; bodyPart?: string; goal?: string;
  status?: 'no'|'only'|'with';              // 新增：no=未刪 (default)；only=只看已刪；with=全部
  limit?: number; offset?: number; sort?: 'name'|'category';
}) {
  const url = new URL('/api/hiit/exercises', BASE);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  return j(await fetch(url.toString()));
}

export async function restoreExercise(id: string) {
  return j(await fetch(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}/restore`, {
    method: 'POST'
  }));
}

// ---- Workouts ----
export async function listWorkouts() { return j(await fetch(`${BASE}/api/hiit/workouts`)); }
export async function getWorkout(id: string) { return j(await fetch(`${BASE}/api/hiit/workouts/${encodeURIComponent(id)}`)); }

export async function createWorkout(payload: {
  name: string; warmup_sec: number; cooldown_sec: number;
  steps: Array<{ order: number; title: string; work_sec: number; rest_sec: number; rounds: number; sets: number; inter_set_rest_sec: number; }>;
}) {
  return j(await fetch(`${BASE}/api/hiit/workouts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
}

export async function updateWorkout(id: string, payload: Partial<{
  name: string; warmup_sec: number; cooldown_sec: number;
  steps: Array<{ order: number; title: string; work_sec: number; rest_sec: number; rounds: number; sets: number; inter_set_rest_sec: number; }>;
}>) {
  return j(await fetch(`${BASE}/api/hiit/workouts/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
}

export async function deleteWorkout(id: string, hard = false) {
  const url = new URL(`/api/hiit/workouts/${encodeURIComponent(id)}`, BASE);
  if (hard) url.searchParams.set('hard', 'true');
  return j(await fetch(url.toString(), { method: 'DELETE' }));
}

// ---- Exercises CRUD ----
export type HiitExerciseDto = {
  id?: string;
  name: string;
  primaryCategory: 'cardio'|'lower'|'upper'|'core'|'full';
  defaultValue: number;
  movementType: string[];
  trainingGoal: string[];
  equipment: string;
  bodyPart: string[];
  cue?: string|null;
  coachNote?: string|null;
  isBilateral?: boolean;
  deletedAt?: string|null;
};

export async function createExercise(payload: Omit<HiitExerciseDto,'id'|'deletedAt'>) {
  return j(await fetch(`${BASE}/api/hiit/exercises`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }));
}
export async function getExercise(id: string) { return j(await fetch(`${BASE}/api/hiit/exercises/${id}`)); }
export async function updateExercise(id: string, payload: Partial<HiitExerciseDto>) {
  return j(await fetch(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }));
}
export async function deleteExercise(id: string, hard = false) {
  const url = new URL(`/api/hiit/exercises/${encodeURIComponent(id)}`, BASE);
  if (hard) url.searchParams.set('hard','true');
  return j(await fetch(url.toString(), { method:'DELETE' }));
}