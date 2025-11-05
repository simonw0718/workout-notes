// /lib/hiit/api.ts
/**
 * HIIT API client（前端）
 * - 讀環境變數 NEXT_PUBLIC_HIIT_API_BASE
 * - dev 沒設時才推斷 http(s)://<目前主機>:8000
 * - prod 若沒設，不再猜，直接丟錯以免卡在載入中
 */

const ENV_BASE = process.env.NEXT_PUBLIC_HIIT_API_BASE;
const IS_PROD = process.env.NODE_ENV === 'production';

/** 推斷 BASE */
function inferBase(): string {
  // 1) 明確指定
  if (ENV_BASE && ENV_BASE.trim()) return ENV_BASE.trim();

  // 2) 生產環境沒設 → 明確報錯
  if (IS_PROD) {
    throw new Error(
      'HIIT API 未設定。請在 Cloudflare Pages 環境變數加入 NEXT_PUBLIC_HIIT_API_BASE（例：https://your-backend.example.com）'
    );
  }

  // 3) 開發環境推斷
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${proto}//${hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
}

export const BASE = inferBase();

/** 安全 JSON 解析 + 逾時 */
async function j(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(input, { signal: controller.signal, ...init });
    const text = await r.text().catch(() => '');
    if (!r.ok) throw new Error(`[HIIT API] ${r.status} ${r.statusText} ${text}`.trim());
    if (r.status === 204 || text === '') return { ok: true };
    try { return JSON.parse(text); } catch { return { ok: true, text }; }
  } finally { clearTimeout(t); }
}

/* =========================
 *         Exercises
 * ========================= */

export type HiitExerciseDto = {
  id?: string;
  name: string;
  primaryCategory: 'cardio' | 'lower' | 'upper' | 'core' | 'full';
  defaultValue: number;
  movementType: string[];
  trainingGoal: string[];
  equipment: string;
  bodyPart: string[];
  cue?: string | null;
  coachNote?: string | null;
  isBilateral?: boolean;
  deletedAt?: string | null;
};

type ListExerciseParams = {
  q?: string;
  category?: string;
  equipment?: string;
  bodyPart?: string;
  goal?: string;
  status?: 'no' | 'only' | 'with';
  limit?: number;
  offset?: number;
  sort?: 'name' | 'category';
};

export async function listHiitExercises(params?: ListExerciseParams) {
  const url = new URL('/api/hiit/exercises', BASE);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  return j(url.toString());
}

export async function createExercise(payload: Omit<HiitExerciseDto, 'id' | 'deletedAt'>) {
  return j(`${BASE}/api/hiit/exercises`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function getExercise(id: string) {
  return j(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}`);
}
export async function updateExercise(id: string, payload: Partial<HiitExerciseDto>) {
  return j(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function deleteExercise(id: string, hard = false) {
  const url = new URL(`/api/hiit/exercises/${encodeURIComponent(id)}`, BASE);
  if (hard) url.searchParams.set('hard', 'true');
  return j(url.toString(), { method: 'DELETE' });
}
export async function restoreExercise(id: string) {
  return j(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

/* =========================
 *          Workouts
 * ========================= */

export async function listWorkouts() { return j(`${BASE}/api/hiit/workouts`); }
export async function getWorkout(id: string) { return j(`${BASE}/api/hiit/workouts/${encodeURIComponent(id)}`); }
export async function createWorkout(payload: {
  name: string; warmup_sec: number; cooldown_sec: number; steps: Array<{
    order: number; title: string; work_sec: number; rest_sec: number; rounds: number; sets: number; inter_set_rest_sec: number;
  }>;
}) {
  return j(`${BASE}/api/hiit/workouts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function updateWorkout(id: string, payload: {
  name?: string; warmup_sec?: number; cooldown_sec?: number; steps?: Array<{
    order: number; title: string; work_sec: number; rest_sec: number; rounds: number; sets: number; inter_set_rest_sec: number;
  }>;
}) {
  return j(`${BASE}/api/hiit/workouts/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function deleteWorkout(id: string, hard = false) {
  const url = new URL(`/api/hiit/workouts/${encodeURIComponent(id)}`, BASE);
  if (hard) url.searchParams.set('hard', 'true');
  return j(url.toString(), { method: 'DELETE' });
}