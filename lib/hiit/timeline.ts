// /lib/hiit/timeline.ts
export type TimelineItem = {
  kind: 'warmup' | 'work' | 'rest' | 'interset' | 'cooldown';
  label: string;
  ms: number;
  stepIndex?: number;
  round?: number;
  set?: number;
};

type Step = {
  order: number;
  title?: string;
  work_sec: number;
  rest_sec: number;           // 這個用於「回合間」以及「步驟之間」的休息
  rounds: number;
  sets: number;
  inter_set_rest_sec: number; // 這個用於「組與組之間」的休息
};

type Workout = {
  id: string;
  name: string;
  warmup_sec: number;
  cooldown_sec: number;
  steps: Step[];
};

export function buildTimeline(w: Workout): TimelineItem[] {
  const L: TimelineItem[] = [];
  const push = (it: TimelineItem) => { if (it.ms > 0) L.push(it); };

  // Warmup
  push({ kind: 'warmup', label: 'WARMUP', ms: (w.warmup_sec || 0) * 1000 });

  const steps = [...(w.steps || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  steps.forEach((s, si) => {
    const sets = Math.max(1, s.sets ?? 1);
    const rounds = Math.max(1, s.rounds ?? 1);

    for (let set = 1; set <= sets; set++) {
      for (let r = 1; r <= rounds; r++) {
        // Work
        push({
          kind: 'work',
          label: s.title?.trim() || `Step ${si + 1}`,
          ms: Math.max(0, (s.work_sec ?? 0) * 1000),
          stepIndex: si,
          round: r,
          set,
        });

        // Rest 規則：
        // 1) 回合之間：r < rounds → 用 rest_sec
        // 2) 每組最後一回合之後：
        //    - 若還有下一組：優先用 inter_set_rest_sec（若有）
        //    - 若沒有下一組但還有下一個步驟：用 rest_sec
        if (r < rounds) {
          // 回合間休息
          push({
            kind: 'rest',
            label: 'REST',
            ms: Math.max(0, (s.rest_sec || 0) * 1000),
            stepIndex: si,
            round: r,
            set,
          });
        } else {
          // 這是該組的最後一回合
          const hasNextSet = set < sets;
          const hasNextStep = !hasNextSet && si < steps.length - 1;

          if (hasNextSet) {
            // 組間休息（優先用 inter_set_rest_sec；若 0 就不休）
            push({
              kind: 'interset',
              label: 'REST',
              ms: Math.max(0, (s.inter_set_rest_sec || 0) * 1000),
              stepIndex: si,
              set,
            });
          } else if (hasNextStep) {
            // 步驟之間休息（使用本步驟 rest_sec）
            push({
              kind: 'rest',
              label: 'REST',
              ms: Math.max(0, (s.rest_sec || 0) * 1000),
              stepIndex: si,
              round: r,
              set,
            });
          }
        }
      }
    }
  });

  // Cooldown
  push({ kind: 'cooldown', label: 'COOLDOWN', ms: (w.cooldown_sec || 0) * 1000 });

  return L;
}