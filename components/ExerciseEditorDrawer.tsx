// components/ExerciseEditorDrawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Exercise, Unit, Category } from "@/lib/models/types";
import { updateExercise, deleteExercise } from "@/lib/db";

const EQUIPS = ["啞鈴", "槓鈴", "器械", "繩索", "徒手", "其他"] as const;
const MOVES  = ["胸推","肩推","划船","深蹲","腿推","卷腹","硬舉","飛鳥","側平舉","前平舉","抬腿","仰臥起坐"] as const;

const CATEGORY_OPTIONS: { key: Category; label: string }[] = [
  { key: "upper", label: "上肢" },
  { key: "lower", label: "下肢" },
  { key: "core",  label: "核心" },
  { key: "other", label: "其他" },
];

const UNIT_ORDER: Unit[] = ["kg","lb","sec","min"];
const nextUnit = (u: Unit) => UNIT_ORDER[(UNIT_ORDER.indexOf(u) + 1) % UNIT_ORDER.length];

function convertValue(val: number, from: Unit, to: Unit) {
  if (Number.isNaN(val) || val === null || val === undefined) return val;
  if (from === to) return val;
  // weight
  if ((from === "kg" && to === "lb")) return +(val * 2.20462).toFixed(1);
  if ((from === "lb" && to === "kg")) return +(val / 2.20462).toFixed(1);
  // time
  if ((from === "sec" && to === "min")) return +(val / 60).toFixed(1);
  if ((from === "min" && to === "sec")) return +(val * 60).toFixed(0);
  // cross family: 不轉值
  return val;
}

type Props = {
  open: boolean;
  exercise: Exercise | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export default function ExerciseEditorDrawer({ open, exercise, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState("");
  const [equip, setEquip] = useState<(typeof EQUIPS)[number]>("啞鈴");
  const [move, setMove]   = useState<(typeof MOVES)[number]>("胸推");
  const [category, setCategory] = useState<Category>("other");
  const [unit, setUnit] = useState<Unit>("kg");
  const [defaultWeight, setDefaultWeight] = useState<string>("");
  const [defaultReps, setDefaultReps] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (!exercise) return;
    setName(exercise.name ?? "");
    setCategory((exercise.category as Category) ?? "other");
    setUnit((exercise.defaultUnit as Unit) ?? "kg");
    setDefaultWeight(
      typeof exercise.defaultWeight === "number" ? String(exercise.defaultWeight) : ""
    );
    setDefaultReps(
      typeof exercise.defaultReps === "number" ? String(exercise.defaultReps) : ""
    );
  }, [exercise]);

  // 用雙選單快速覆蓋名稱
  const comboName = useMemo(() => `${equip}${move}`, [equip, move]);

  if (!open || !exercise) return null;

  const changeUnitWithConfirm = () => {
    const next = nextUnit(unit);
    // 當前有重量/時間才提示換算；跨族群不換
    const hasVal = defaultWeight.trim() !== "";
    let newVal = defaultWeight;
    if (hasVal) {
      const v = Number(defaultWeight);
      if (!Number.isNaN(v)) {
        const from = unit, to = next;
        const sameFamily = (["kg","lb"].includes(from) && ["kg","lb"].includes(to)) ||
                           (["sec","min"].includes(from) && ["sec","min"].includes(to));
        if (sameFamily) {
          const ok = window.confirm(`要把數值從 ${from} 轉換成 ${to} 嗎？（目前：${v}）`);
          if (ok) newVal = String(convertValue(v, from, to));
        }
      }
    }
    setUnit(next);
    setDefaultWeight(newVal);
  };

  const onSave = async () => {
    if (!exercise) return;
    const nm = name.trim();
    if (!nm) { setErr("名稱不可為空"); return; }
    setErr("");
    setSaving(true);
    try {
      await updateExercise({
        id: exercise.id,
        name: nm,
        defaultUnit: unit,
        defaultWeight: defaultWeight.trim() === "" ? null : Number(defaultWeight),
        defaultReps: defaultReps.trim() === "" ? null : Number(defaultReps),
        category,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!exercise) return;
    const ok = window.confirm(`確定刪除「${exercise.name}」嗎？\n（不影響已存在的歷史紀錄）`);
    if (!ok) return;
    try {
      await deleteExercise(exercise.id);
      onDeleted();
      onClose();
    } catch (e) {
      setErr("刪除失敗");
    }
  };

  return (
    <div className="fixed inset-0 z-40">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* 右側抽屜 */}
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[440px] bg-black text-white border-l border-white/20 p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">編輯動作</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1 rounded-xl border">關閉</button>
            <button onClick={onSave} disabled={saving} className="px-3 py-1 rounded-xl bg-white text-black disabled:opacity-50">儲存</button>
          </div>
        </div>

        {err && <div className="mb-2 text-sm text-red-400">{err}</div>}

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* 名稱 */}
          <section className="space-y-2">
            <label className="text-sm text-white/70">名稱</label>
            <input
              className="w-full rounded-xl border px-3 py-3 bg-transparent"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              placeholder="例如：啞鈴肩推"
            />
            {/* 雙選單快速組名 */}
            <div className="grid grid-cols-2 gap-2">
              <select className="rounded-xl border px-3 py-3 bg-transparent" value={equip} onChange={(e)=>setEquip(e.target.value as any)}>
                {EQUIPS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <select className="rounded-xl border px-3 py-3 bg-transparent" value={move} onChange={(e)=>setMove(e.target.value as any)}>
                {MOVES.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <button
                type="button"
                onClick={()=>setName(comboName)}
                className="col-span-2 rounded-xl border px-3 py-2"
                title="用左/右選單組合覆蓋名稱"
              >
                使用組合名稱：{comboName}
              </button>
            </div>
          </section>

          {/* 基本屬性 */}
          <section className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-white/70">分類</label>
              <select
                className="w-full rounded-xl border px-3 py-3 bg-transparent"
                value={category}
                onChange={(e)=>setCategory(e.target.value as Category)}
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">預設單位（點擊切換）</label>
              <button
                type="button"
                onClick={changeUnitWithConfirm}
                className="w-full rounded-xl border px-3 py-3 text-left"
              >
                {unit}
              </button>
            </div>
          </section>

          {/* 預設值 */}
          <section className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm text-white/70">
                {["kg","lb"].includes(unit) ? "預設重量" : "預設時間"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-xl border px-3 py-3 bg-transparent"
                  value={defaultWeight}
                  inputMode="decimal"
                  onChange={(e)=>setDefaultWeight(e.target.value)}
                  placeholder={["kg","lb"].includes(unit) ? "例如：20" : (unit === "sec" ? "例如：30" : "例如：1.5")}
                />
                <span className="rounded-xl border px-3 py-2 whitespace-nowrap">單位：{unit}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">預設次數（可空）</label>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-xl border px-3 py-3 bg-transparent"
                  value={defaultReps}
                  inputMode="numeric"
                  onChange={(e)=>setDefaultReps(e.target.value)}
                  placeholder="例如：10"
                />
                <span className="rounded-xl border px-3 py-2 whitespace-nowrap">單位：次</span>
              </div>
            </div>
          </section>

          {/* 危險區域 */}
          <section className="pt-2">
            <button onClick={onDelete} className="rounded-xl border border-red-400 text-red-300 px-3 py-2">
              刪除此動作
            </button>
            <p className="mt-1 text-xs text-white/60">刪除不影響既有歷史紀錄。</p>
          </section>
        </div>
      </aside>
    </div>
  );
}