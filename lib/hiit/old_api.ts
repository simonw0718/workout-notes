// /lib/hiit/api.ts
/**
 * HIIT API client（前端）
 * - 讀環境變數 NEXT_PUBLIC_HIIT_API_BASE
 * - dev 沒設時才推斷 http(s)://<目前主機>:8000
 * - prod 若沒設，不在建置期丟錯；只在「瀏覽器 runtime 呼叫 API」時提醒
 */

const ENV_BASE = process.env.NEXT_PUBLIC_HIIT_API_BASE;
const IS_PROD = process.env.NODE_ENV === 'production';

/** 僅在「真正要發請求」的時候才取用 BASE */
function apiBase(): string {
  // 1) 有明確設定 → 直接用
  if (ENV_BASE && ENV_BASE.trim()) return ENV_BASE.trim();

  // 2) 瀏覽器環境（dev）→ 用當前主機配 8000
  if (typeof window !== 'undefined' && !IS_PROD) {
    const hostname = window.location.hostname;
    const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${proto}//${hostname}:8000`;
  }

  // 3) 生產 + 沒設 → 回傳空字串；由呼叫端在 runtime 給出可讀訊息
  return '';
}

/** 檢查 base，若缺失在「瀏覽器端」給清楚錯誤 */
function ensureBaseOrThrow(): string {
  const base = apiBase();
  if (base) return base;

  // 僅瀏覽器提示；建置期（沒有 window）不丟錯，避免中斷 export
  if (typeof window !== 'undefined') {
    throw new Error(
      'HIIT API 未設定。請在 Cloudflare Pages 設定「NEXT_PUBLIC_HIIT_API_BASE」為你的後端，例如：https://your-api.example.com'
    );
  }
  // SSR / build 階段回傳假的 BASE（不會真的被用到，因為我們的頁面都是 client-side 取數據）
  return 'http://127.0.0.1:8000';
}

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
  const base = ensureBaseOrThrow();
  const url = new URL('/api/hiit/exercises', base);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  return j(url.toString());
}

export async function createExercise(payload: Omit<HiitExerciseDto, 'id' | 'deletedAt'>) {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/exercises`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function getExercise(id: string) {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/exercises/${encodeURIComponent(id)}`);
}
export async function updateExercise(id: string, payload: Partial<HiitExerciseDto>) {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/exercises/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function deleteExercise(id: string, hard = false) {
  const base = ensureBaseOrThrow();
  const url = new URL(`/api/hiit/exercises/${encodeURIComponent(id)}`, base);
  if (hard) url.searchParams.set('hard', 'true');
  return j(url.toString(), { method: 'DELETE' });
}
export async function restoreExercise(id: string) {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/exercises/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

/* =========================
 *          Workouts
 * ========================= */

export async function listWorkouts() {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/workouts`);
}
export async function getWorkout(id: string) {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/workouts/${encodeURIComponent(id)}`);
}
export async function createWorkout(payload: {
  name: string; warmup_sec: number; cooldown_sec: number; steps: Array<{
    order: number; title: string; work_sec: number; rest_sec: number; rounds: number; sets: number; inter_set_rest_sec: number;
  }>;
}) {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/workouts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function updateWorkout(id: string, payload: {
  name?: string; warmup_sec?: number; cooldown_sec?: number; steps?: Array<{
    order: number; title: string; work_sec: number; rest_sec: number; rounds: number; sets: number; inter_set_rest_sec: number;
  }>;
}) {
  const base = ensureBaseOrThrow();
  return j(`${base}/api/hiit/workouts/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function deleteWorkout(id: string, hard = false) {
  const base = ensureBaseOrThrow();
  const url = new URL(`/api/hiit/workouts/${encodeURIComponent(id)}`, base);
  if (hard) url.searchParams.set('hard', 'true');
  return j(url.toString(), { method: 'DELETE' });
}