// /components/hiit/ExerciseForm.tsx
'use client';
import { useState } from 'react';
import type { HiitExerciseDto } from '@/lib/hiit/api';

type Props = {
  value?: Partial<HiitExerciseDto>;
  onSubmit: (v: Omit<HiitExerciseDto,'id'|'deletedAt'>) => Promise<void>|void;
  busy?: boolean;
};

const CATEGORIES = [
  { v:'cardio', label:'心肺' },
  { v:'lower',  label:'下肢' },
  { v:'upper',  label:'上肢' },
  { v:'core',   label:'核心' },
  { v:'full',   label:'全身' },
];

const EQUIP = ['無','椅子','壺鈴','彈力帶','箱子或階梯','墊子'];

export default function ExerciseForm({ value = {}, busy, onSubmit }: Props) {
  const [form, setForm] = useState<Omit<HiitExerciseDto,'id'|'deletedAt'>>({
    name: value.name ?? '',
    primaryCategory: (value.primaryCategory as any) ?? 'full',
    defaultValue: value.defaultValue ?? 30,
    movementType: value.movementType ?? [],
    trainingGoal: value.trainingGoal ?? [],
    equipment: value.equipment ?? '無',
    bodyPart: value.bodyPart ?? [],
    cue: value.cue ?? '',
    coachNote: value.coachNote ?? '',
    isBilateral: value.isBilateral ?? true,
  });

  const patch = (p: Partial<typeof form>) => setForm(prev => ({...prev, ...p}));

  const toggleArray = (key: 'movementType'|'trainingGoal'|'bodyPart', v: string) => {
    setForm(prev => {
      const cur = new Set(prev[key]);
      cur.has(v) ? cur.delete(v) : cur.add(v);
      return { ...prev, [key]: Array.from(cur) as string[] };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert('名稱必填'); return; }
    await onSubmit({ ...form, name: form.name.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-white">
      <div>
        <label className="text-sm opacity-80">名稱（英文）</label>
        <input className="w-full bg-black border border-white/20 rounded-lg px-3 py-2"
               value={form.name} onChange={e=>patch({name:e.target.value})}/>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm opacity-80 mb-1">主分類</div>
          <select className="w-full bg-black border border-white/20 rounded-lg px-3 py-2"
                  value={form.primaryCategory}
                  onChange={e=>patch({primaryCategory: e.target.value as any})}>
            {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <div className="text-sm opacity-80 mb-1">預設秒數</div>
          <input type="number" className="w-full bg-black border border-white/20 rounded-lg px-3 py-2"
                 value={form.defaultValue} onChange={e=>patch({defaultValue:+e.target.value})}/>
        </div>
      </div>

      <div>
        <div className="text-sm opacity-80 mb-1">器材（單選）</div>
        <select className="w-full bg-black border border-white/20 rounded-lg px-3 py-2"
                value={form.equipment} onChange={e=>patch({equipment:e.target.value})}>
          {EQUIP.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TagBox title="動作型態" values={form.movementType} onToggle={v=>toggleArray('movementType', v)}
                options={['跳躍','推','拉','蹲','髖伸','旋轉','攀爬']}/>
        <TagBox title="訓練目標" values={form.trainingGoal} onToggle={v=>toggleArray('trainingGoal', v)}
                options={['耐力','爆發力','穩定度','敏捷','平衡']}/>
        <TagBox title="運動部位" values={form.bodyPart} onToggle={v=>toggleArray('bodyPart', v)}
                options={['腿','臀','背','胸','肩','手臂','核心','全身']}/>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm opacity-80 mb-1">常見提示（cue）</div>
          <input className="w-full bg-black border border-white/20 rounded-lg px-3 py-2"
                 value={form.cue ?? ''} onChange={e=>patch({cue:e.target.value})}/>
        </div>
        <div>
          <div className="text-sm opacity-80 mb-1">教練語</div>
          <input className="w-full bg-black border border-white/20 rounded-lg px-3 py-2"
                 value={form.coachNote ?? ''} onChange={e=>patch({coachNote:e.target.value})}/>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm opacity-80">
        <input type="checkbox" className="accent-white"
               checked={!!form.isBilateral} onChange={e=>patch({isBilateral:e.target.checked})}/>
        是否雙邊動作（左右交替）
      </label>

      <div className="pt-2">
        <button disabled={busy} className="px-4 py-2 rounded-xl border border-white">
          {busy ? '儲存中…' : '儲存'}
        </button>
      </div>
    </form>
  );
}

function TagBox({ title, values, onToggle, options }:{
  title:string; values:string[]; onToggle:(v:string)=>void; options:string[];
}) {
  return (
    <div>
      <div className="text-sm opacity-80 mb-1">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = values?.includes(o);
          return (
            <button key={o} type="button"
              onClick={()=>onToggle(o)}
              className={`px-2 py-1 rounded-lg border text-sm ${
                on ? 'border-white text-white' : 'border-white/40 text-white/70'
              }`}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}