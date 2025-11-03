// 路徑：/lib/hiit/api.ts
/**
 * HIIT API client（前端）
 * - 會優先讀環境變數 NEXT_PUBLIC_HIIT_API_BASE
 * - 若沒設定，於瀏覽器環境下自動推斷為 `http(s)://<目前主機>:8000`
 * - 在非瀏覽器（SSR）則退回 `http://127.0.0.1:8000`
 */

const ENV_BASE = process.env.NEXT_PUBLIC_HIIT_API_BASE;

/** 推斷區網後端 BASE（手機/同網段測試用） */
function inferBase(): string {
  // 1) 明確指定 → 直接用
  if (ENV_BASE && ENV_BASE.trim()) return ENV_BASE.trim();

  // 2) 瀏覽器端 → 用當前 hostname 配 8000
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname; // 例：localhost、192.168.x.x、10.x.x.x
    // 後端大多跑 http；若你真的用 https，自己把 8000 換成你的 port
    const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${proto}//${hostname}:8000`;
  }

  // 3) 伺服端（SSR/Fallback）
  return 'http://127.0.0.1:8000';
}

export const BASE = inferBase();

/** 安全 JSON 解析（支援空 body、204 等）+ 帶逾時 */
async function j(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(input, { signal: controller.signal, ...init });
    const text = await r.text().catch(() => '');

    if (!r.ok) {
      throw new Error(`[HIIT API] ${r.status} ${r.statusText} ${text}`.trim());
    }
    if (r.status === 204 || text === '') return { ok: true };
    try {
      return JSON.parse(text);
    } catch {
      return { ok: true, text };
    }
  } finally {
    clearTimeout(t);
  }
}

/* =========================
 *         Exercises
 * ========================= */

export type HiitExerciseDto = {
  id?: string;
  name: string;
  primaryCategory: 'cardio' | 'lower' | 'upper' | 'core' | 'full';
  defaultValue: number;          // 預設秒數
  movementType: string[];
  trainingGoal: string[];
  equipment: string;             // 單選
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
  /** no(預設)=只回未刪、only=只回已刪、with=全部 */
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getExercise(id: string) {
  return j(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}`);
}

export async function updateExercise(id: string, payload: Partial<HiitExerciseDto>) {
  return j(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteExercise(id: string, hard = false) {
  const url = new URL(`/api/hiit/exercises/${encodeURIComponent(id)}`, BASE);
  if (hard) url.searchParams.set('hard', 'true');
  return j(url.toString(), { method: 'DELETE' }); // 空 body/204 也會回 { ok:true }
}

/** 還原軟刪的動作 */
export async function restoreExercise(id: string) {
  return j(`${BASE}/api/hiit/exercises/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });
}

/* =========================
 *          Workouts
 * ========================= */

export async function listWorkouts() {
  return j(`${BASE}/api/hiit/workouts`);
}

export async function getWorkout(id: string) {
  return j(`${BASE}/api/hiit/workouts/${encodeURIComponent(id)}`);
}

export async function createWorkout(payload: {
  name: string;
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
}) {
  return j(`${BASE}/api/hiit/workouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateWorkout(
  id: string,
  payload: {
    name?: string;
    warmup_sec?: number;
    cooldown_sec?: number;
    steps?: Array<{
      order: number;
      title: string;
      work_sec: number;
      rest_sec: number;
      rounds: number;
      sets: number;
      inter_set_rest_sec: number;
    }>;
  },
) {
  return j(`${BASE}/api/hiit/workouts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkout(id: string, hard = false) {
  const url = new URL(`/api/hiit/workouts/${encodeURIComponent(id)}`, BASE);
  if (hard) url.searchParams.set('hard', 'true');
  return j(url.toString(), { method: 'DELETE' }); // 安全處理 204/空 body
}