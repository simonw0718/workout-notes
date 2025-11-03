// /lib/hiit/types.ts
export type HiitStep = {
  order: number;
  title?: string;             // ← 顯示在播放器與清單
  exercise_id?: string;
  mode: 'time'|'reps';
  work_sec?: number;
  reps?: number;
  rest_sec: number;
  rounds: number;
  sets: number;
  inter_set_rest_sec: number;
};

export type HiitWorkout = {
  id: string;
  name: string;
  description?: string;
  warmup_sec: number;
  cooldown_sec: number;
  steps: HiitStep[];
};