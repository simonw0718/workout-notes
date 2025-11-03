'use client';
/**
 * 路徑：/components/hiit/ExercisePicker.tsx
 */
import { useEffect, useState } from 'react';
import { listHiitExercises } from '@/lib/hiit/api';

type PickerProps = {
  open: boolean;
  onClose: () => void;
  onPick: (ex: any) => void; // 回傳後端的 exercise 物件（單筆）
};

const CATS = [
  { key: '',       label: '全部分類' },
  { key: 'cardio', label: '心肺' },
  { key: 'lower',  label: '下肢' },
  { key: 'upper',  label: '上肢' },
  { key: 'core',   label: '核心' },
  { key: 'full',   label: '全身' },
];

export default function ExercisePicker({ open, onClose, onPick }: PickerProps) {
  const [q, setQ] = useState('');
  const [category, setCategory]   = useState<string>('');
  const [equipment, setEquipment] = useState<string>('');
  const [bodyPart, setBodyPart]   = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 開啟/條件變更 → 拉清單
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await listHiitExercises({
          q: q.trim() || undefined,
          category: category || undefined,
          equipment: equipment || undefined,
          bodyPart: bodyPart || undefined,
          sort: 'category',
          limit: 200,
        });
        if (alive) setItems(Array.isArray(res) ? res : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, q, category, equipment, bodyPart]);

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景 */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* 抽屜 */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-neutral-950 border-l border-white/10 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-lg font-semibold">從動作庫選擇</h2>
          <button className="text-white/70 hover:text-white" onClick={onClose} aria-label="關閉">關閉</button>
        </div>

        {/* 搜尋與篩選 */}
        <div className="space-y-2 mb-3">
          <input
            placeholder="搜尋名稱 / 提示 / 目標…"
            value={q}
            onChange={e=>setQ(e.target.value)}
            className="w-full bg-black text-white border border-white/20 rounded-xl px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={e=>setCategory(e.target.value)}
              className="bg-black text-white border border-white/20 rounded-xl px-3 py-2"
            >
              {CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input
              value={equipment}
              onChange={e=>setEquipment(e.target.value)}
              placeholder="器材（例：壺鈴/椅子/無）"
              className="bg-black text-white border border-white/20 rounded-xl px-3 py-2"
            />
            <input
              value={bodyPart}
              onChange={e=>setBodyPart(e.target.value)}
              placeholder="部位（例：腿/核心/臀…）"
              className="bg-black text-white border border-white/20 rounded-xl px-3 py-2 col-span-2"
            />
          </div>
        </div>

        <div className="text-sm text-white/60 mb-2">
          {loading ? '載入中…' : `共 ${items.length} 個結果`}
        </div>

        {/* 清單 */}
        <ul className="space-y-2">
          {items.map(it => (
            <li
              key={it.id}
              className="p-3 rounded-xl border border-white/15 bg-black/40 hover:bg-white/5 text-white cursor-pointer"
              onClick={() => { onPick(it); onClose(); }}
              role="button"
              aria-label={`選擇 ${it.name}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{it.name}</div>
                <div className="text-xs px-2 py-0.5 rounded-full bg-white/10">{catLabel(it.primaryCategory)}</div>
              </div>
              <div className="mt-1 text-xs text-white/70">
                {it.equipment !== '無' ? `器材：${it.equipment}・` : ''}
                秒數：{it.defaultValue}s
                {Array.isArray(it.bodyPart) && it.bodyPart.length ? `・部位：${it.bodyPart.join('/')}` : ''}
              </div>
              {it.cue && <div className="mt-1 text-xs text-white/60">提示：{it.cue}</div>}
            </li>
          ))}
          {!loading && items.length === 0 && (
            <li className="text-white/60 text-sm">沒有符合的動作。</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function catLabel(key: string) {
  switch (key) {
    case 'cardio': return '心肺';
    case 'lower': return '下肢';
    case 'upper': return '上肢';
    case 'core':  return '核心';
    case 'full':  return '全身';
    default: return key || '—';
  }
}