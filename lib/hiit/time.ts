// /lib/hiit/time.ts
export function computeStepMs(s: {
  work_sec?: number; rest_sec?: number;
  rounds?: number; sets?: number; inter_set_rest_sec?: number;
}) {
  const work = s.work_sec ?? 0;
  const rest = s.rest_sec ?? 0;
  const rounds = s.rounds ?? 1;
  const sets = s.sets ?? 1;
  const interSet = s.inter_set_rest_sec ?? 0;
  const perRound = (work + rest) * 1000;
  const perSet = perRound * rounds;
  const interSetTotal = Math.max(0, sets - 1) * interSet * 1000;
  return perSet * sets + interSetTotal;
}

export function computeWorkoutMs(w: {
  warmup_sec?: number; cooldown_sec?: number;
  steps?: Array<{
    work_sec: number; rest_sec: number;
    rounds: number; sets: number; inter_set_rest_sec: number;
  }>;
}) {
  let total = 0;
  total += (w.warmup_sec ?? 0) * 1000;
  for (const s of (w.steps ?? [])) total += computeStepMs(s);
  total += (w.cooldown_sec ?? 0) * 1000;
  return total;
}

export function formatHMS(ms: number) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}