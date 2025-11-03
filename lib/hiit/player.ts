// /lib/hiit/player.ts
export type Phase = 'prepare'|'work'|'rest'|'done';

export type TimelineItem = {
  phase: Phase;
  ms: number;
  label: string;
  stepIndex: number;  // 對應 steps 的 idx（-1 表示非 step，如 warmup/cooldown）
  round: number;
};

export function buildTimeline(steps: any[], warmupSec=0, cooldownSec=0): TimelineItem[] {
  const tl: TimelineItem[] = [];
  if (warmupSec>0) tl.push({phase:'prepare', ms:warmupSec*1000, label:'Warmup', stepIndex:-1, round:0});
  steps.forEach((s:any, i:number) => {
    const rounds = s.rounds ?? 1;
    const title  = s.title || `Step ${i+1}`;
    for (let r=1; r<=rounds; r++) {
      if (s.mode==='time') tl.push({phase:'work', ms:(s.work_sec||0)*1000, label:title, stepIndex:i, round:r});
      if ((s.rest_sec||0)>0) tl.push({phase:'rest', ms:s.rest_sec*1000, label:'Rest', stepIndex:i, round:r});
    }
  });
  if (cooldownSec>0) tl.push({phase:'rest', ms:cooldownSec*1000, label:'Cooldown', stepIndex:-1, round:0});
  return tl;
}