// /lib/hiit/duration.ts
// 計算 HIIT 總時長（秒）。規則：每回合「最後一回合不加 rest」，每組之間加 inter_set_rest（最後一組不加）。
import type { HiitStep } from '@/lib/hiit/types';

export function calcStepSeconds(s: HiitStep): number {
  const work = Math.max(0, s.work_sec ?? 0);
  const rest = Math.max(0, s.rest_sec ?? 0);
  const rounds = Math.max(1, s.rounds ?? 1);
  const sets = Math.max(1, s.sets ?? 1);
  const inter = Math.max(0, s.inter_set_rest_sec ?? 0);

  const perRound = work;
  const perRoundRest = rest;
  const oneSet =
    rounds * perRound +
    Math.max(0, rounds - 1) * perRoundRest; // 最後一回合不休息

  return sets * oneSet + Math.max(0, sets - 1) * inter; // 最後一組不加組間休息
}

export function calcWorkoutSeconds(w: {
  warmup_sec?: number;
  cooldown_sec?: number;
  steps?: HiitStep[];
}): number {
  const warm = Math.max(0, w.warmup_sec ?? 0);
  const cool = Math.max(0, w.cooldown_sec ?? 0);
  const steps = Array.isArray(w.steps) ? w.steps : [];
  const core = steps.reduce((sum, s) => sum + calcStepSeconds(s), 0);
  return warm + core + cool;
}

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}分${r}秒` : `${r}秒`;
}