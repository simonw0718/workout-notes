// app/settings/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createExercise,
  listAllExercises,
  deleteExercise,
} from "@/lib/db";
import type { Exercise, Unit, Category, RepsUnit } from "@/lib/models/types";
import ExerciseEditorDrawer from "@/components/ExerciseEditorDrawer";

// 滾輪（IndexedDB）
import { loadWheels, saveWheels } from "@/lib/db/wheels";
import WheelOptionsDrawer from "@/components/WheelOptionsDrawer";

/** 失敗／尚未初始化時的後援清單 */
const EQUIP_FALLBACK = ["啞鈴", "槓鈴", "器械", "繩索", "徒手", "其他"] as const;
const MOVE_FALLBACK = [
  "胸推", "肩推", "划船", "深蹲", "腿推", "硬舉",
  "側平舉", "前平舉", "飛鳥", "二頭彎舉", "三頭下壓",
  "卷腹", "抬腿",
] as const;

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "upper", label: "上肢" },
  { key: "lower", label: "下肢" },
  { key: "core",  label: "核心" },
  { key: "other", label: "其他" },
];

const UNITS: Unit[] = ["kg", "lb", "sec", "min"];
const nextUnit = (u: Unit) => UNITS[(UNITS.indexOf(u) + 1) % UNITS.length];

const numOrUndef = (v: string) => {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

export default function SettingsPage() {
  // === 滾輪資料（from IndexedDB；失敗時 fallback） ===
  const [equipList, setEquipList] = useState<string[]>([]);
  const [moveList, setMoveList] = useState<string[]>([]);
  const [wheelsOpen, setWheelsOpen] = useState(false);

  // 名稱（雙選單 + 自訂）
  const [equip, setEquip] = useState<string>("");
  const [move, setMove] = useState<string>("");
  const [custom, setCustom] = useState<string>("");

  // 其他欄位
  const [category, setCategory] = useState<Category>("other");
  const [unit, setUnit] = useState<Unit>("kg");
  const [defaultWeight, setDefaultWeight] = useState("");
  const [defaultReps, setDefaultReps] = useState("");
  /** 新增：預設次數單位（次/秒） */
  const [repsUnit, setRepsUnit] = useState<RepsUnit>("rep");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // 已儲存列表 + 檢索/排序/選取
  const [all, setAll] = useState<Exercise[]>([]);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"updated" | "name">("updated");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Set<string>>(new Set()); // 淡出動畫用

  // 抽屜編輯
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);

  // 載入滾輪清單（抽屜儲存後也會呼叫）
  const loadWheelOptions = async () => {
    try {
      const { equip, moves } = await loadWheels();
      const el = (equip?.length ? equip : Array.from(EQUIP_FALLBACK)) as string[];
      const ml = (moves?.length ? moves : Array.from(MOVE_FALLBACK)) as string[];
      setEquipList(el);
      setMoveList(ml);
      setEquip((prev) => prev || el[0] || "");
      setMove((prev)  => prev  || ml[0] || "");
    } catch {
      // 失敗 → fallback
      const el = Array.from(EQUIP_FALLBACK) as string[];
      const ml = Array.from(MOVE_FALLBACK) as string[];
      setEquipList(el);
      setMoveList(ml);
      setEquip((prev) => prev || el[0] || "");
      setMove((prev)  => prev  || ml[0] || "");
    }
  };

  // 載入動作清單
  const loadExercises = async () => {
    const exs = await listAllExercises();
    setAll(exs);
  };

  useEffect(() => { loadWheelOptions(); }, []);
  useEffect(() => { loadExercises(); }, []);

  // 最終名稱（自訂 > 組合）
  const finalName = useMemo(() => {
    const c = custom.trim();
    const left = (equip ?? "").trim();
    const right = (move ?? "").trim();
    return c || `${left}${right}`;
  }, [custom, equip, move]);
  const canCreate = finalName.trim().length > 0;

  // 檢索/排序
  const filtered = useMemo(() => {
    const kw = q.trim();
    let arr = all.filter(e => !e.deletedAt);
    if (kw) arr = arr.filter(e => e.name.includes(kw));
    if (sortKey === "name") arr = arr.slice().sort((a, b) => a.name.localeCompare(b.name));
    else arr = arr.slice().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return arr;
  }, [all, q, sortKey]);

  // 送出新增
  async function onCreate() {
    if (!canCreate || saving) return;
    try {
      setSaving(true);
      setMsg("");
      await createExercise({
        name: finalName,
        defaultWeight: numOrUndef(defaultWeight),
        defaultReps: numOrUndef(defaultReps),
        defaultUnit: unit,
        /** 新增：帶出預設「次數單位」 */
        defaultRepsUnit: repsUnit,
        isFavorite: false,
        category,
      });
      setMsg(`已新增：${finalName}`);
      // reset（保留使用者選的滾輪值，比較順手）
      setCustom("");
      setCategory("other");
      setUnit("kg");
      setDefaultWeight("");
      setDefaultReps("");
      setRepsUnit("rep");
      await loadExercises();
    } catch (e: any) {
      setMsg(`新增失敗：${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  // 單筆刪除（先淡出，再刪除）
  async function removeOne(id: string) {
    setRemoving(prev => new Set(prev).add(id));
    await new Promise(r => setTimeout(r, 220)); // 對應 transition duration
    await deleteExercise(id);
    setSelected(s => { const n=new Set(s); n.delete(id); return n; });
    await loadExercises();
    setRemoving(prev => { const n=new Set(prev); n.delete(id); return n; });
  }

  // 批次刪除
  async function removeBatch(ids: string[]) {
    const withFade = new Set(removing);
    ids.forEach(id => withFade.add(id));
    setRemoving(withFade);
    await new Promise(r => setTimeout(r, 220));
    await Promise.all(ids.map(id => deleteExercise(id)));
    setSelected(new Set());
    await loadExercises();
    setRemoving(new Set());
  }

  const weightLabel = unit === "sec" || unit === "min" ? "預設時間" : "預設重量";
  const weightUnitLabel = unit === "sec" ? "sec" : unit === "min" ? "min" : unit;
  const repsUnitLabel = repsUnit === "sec" ? "秒" : "次";

  return (
    <main className="max-w-screen-sm mx-auto p-4 sm:p-6 space-y-6">
      {/* Sticky header */}
      <div className="sticky top-0 -mx-4 sm:-mx-6 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-b">
          <Link href="/" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">
            回首頁
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWheelsOpen(true)}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
              title="編輯滾輪選項"
            >
              編輯滾輪選項
            </button>
            <Link href="/diagnostics" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">偵錯</Link>
            <Link href="/sync" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">資料搬運</Link>
          </div>
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold">設定</h1>

      {/* 新增動作 */}
      <section className="rounded-2xl border p-4 space-y-5">
        <h2 className="text-lg sm:text-xl font-semibold">新增動作</h2>

        {/* 名稱：雙選單 + 自訂名稱 */}
        <div className="space-y-3">
          <label className="text-sm text-gray-500">目前動作名稱（可留白用上方組合）</label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              className="w-full border rounded-xl p-3 bg-transparent"
              value={equip}
              onChange={(e) => setEquip(e.target.value)}
              aria-label="器材"
            >
              {equipList.map((x, i) => <option key={`${x}-${i}`} value={x}>{x}</option>)}
            </select>

            <select
              className="w-full border rounded-xl p-3 bg-transparent"
              value={move}
              onChange={(e) => setMove(e.target.value)}
              aria-label="動作"
            >
              {moveList.map((x, i) => <option key={`${x}-${i}`} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <input
              className="w-full border rounded-xl p-3 bg-transparent"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="自訂動作名稱（可留白使用上方組合）"
            />
            <div className="text-xs text-gray-500">
              將儲存為：<b>{finalName}</b>
            </div>
          </div>
        </div>

        {/* 分類 + 預設重量單位 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm text-gray-500">分類</label>
            <select
              className="w-full border rounded-xl p-3 bg-transparent"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-500">預設重量/時間單位（點擊切換）</label>
            <button
              type="button"
              onClick={() => setUnit(nextUnit(unit))}
              className="w-full h-12 rounded-xl border px-4 text-left"
              title="點擊切換單位"
            >
              {unit}
            </button>
          </div>
        </div>

        {/* 預設時間 / 重量 */}
        <div className="space-y-2">
          <label className="text-sm text-gray-500">{weightLabel}</label>
          <div className="flex items-center gap-2">
            <input
              value={defaultWeight}
              onChange={(e) => setDefaultWeight(e.target.value)}
              inputMode="decimal"
              placeholder={weightLabel}
              className="flex-1 rounded-xl border px-3 py-3 text-base bg-transparent"
            />
            <span className="rounded-xl border px-3 py-2 whitespace-nowrap">單位：{weightUnitLabel}</span>
          </div>
        </div>

        {/* 預設次數 + 次數單位切換（次 / 秒） */}
        <div className="space-y-2">
          <label className="text-sm text-gray-500">預設次數（可空）</label>
          <div className="flex items-center gap-2">
            <input
              value={defaultReps}
              onChange={(e) => setDefaultReps(e.target.value)}
              inputMode="numeric"
              placeholder={repsUnit === "sec" ? "例如：30（秒）" : "例如：10（次）"}
              className="flex-1 rounded-xl border px-3 py-3 text-base bg-transparent"
            />
            <button
              type="button"
              onClick={() => setRepsUnit(p => (p === "rep" ? "sec" : "rep"))}
              className="rounded-xl border px-3 py-2 whitespace-nowrap"
              title="點擊切換 次/秒"
            >
              單位：{repsUnitLabel}
            </button>
          </div>
        </div>

        {/* 送出 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreate || saving}
            className="h-11 rounded-xl bg-black text-white px-4 disabled:opacity-40"
          >
            新增
          </button>
          {msg && <p className="mt-2 text-sm text-gray-700">{msg}</p>}
        </div>
      </section>

      {/* 已儲存動作（含刪除按鈕、批次刪除、淡出動畫） */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">已儲存動作</h2>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋名稱…"
              className="rounded-xl border px-3 py-2 bg-transparent"
            />
            <select
              className="rounded-xl border px-3 py-2 bg-transparent"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              title="排序"
            >
              <option value="updated">最近更新</option>
              <option value="name">名稱</option>
            </select>
          </div>
        </div>

        {/* 批次控制列 */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border px-3 py-1 text-sm"
              onClick={() => {
                const allIds = filtered.map(x => x.id);
                const allChecked = allIds.every(id => selected.has(id));
                setSelected(allChecked ? new Set() : new Set(allIds));
              }}
            >
              全選 / 取消
            </button>
            <button
              className="rounded-xl border px-3 py-1 text-sm text-red-500 border-red-500 disabled:opacity-40"
              disabled={selected.size === 0}
              onClick={async () => {
                if (!confirm(`確定要刪除 ${selected.size} 筆動作嗎？`)) return;
                await removeBatch(Array.from(selected));
              }}
            >
              刪除勾選（{selected.size}）
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-white/60">尚無動作</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {filtered.map(ex => {
              const isRemoving = removing.has(ex.id);
              const ru: RepsUnit = (ex as any).defaultRepsUnit ?? "rep";
              return (
                <li
                  key={ex.id}
                  className={[
                    "py-3 flex items-center justify-between transition-all duration-200",
                    isRemoving ? "opacity-0 -translate-x-2" : "opacity-100 translate-x-0",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(ex.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(ex.id);
                        else next.delete(ex.id);
                        setSelected(next);
                      }}
                    />
                    <button
                      className="text-left"
                      onClick={() => { setEditing(ex); setDrawerOpen(true); }}
                      title="點擊編輯"
                    >
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-xs text-white/60">
                        分類：{CATEGORIES.find(c => c.key === (ex.category as Category))?.label ?? "—"}
                        ・ 重/時單位：{ex.defaultUnit ?? "kg"}
                        ・ 次數單位：{ru === "sec" ? "秒" : "次"}
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl border px-3 py-1"
                      onClick={() => { setEditing(ex); setDrawerOpen(true); }}
                    >
                      編輯
                    </button>
                    <button
                      className="rounded-xl border px-3 py-1 border-red-500 text-red-500"
                      onClick={async () => {
                        if (confirm(`確定要刪除「${ex.name}」嗎？`)) {
                          await removeOne(ex.id);
                        }
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 滾輪設定抽屜（關閉時不必再強制 reload，因為 onSave 已把最新值設回） */}
      <WheelOptionsDrawer
        open={wheelsOpen}
        onClose={() => setWheelsOpen(false)}
        leftOptions={equipList}     // 左滾輪：器材
        rightOptions={moveList}     // 右滾輪：常見動作
        onSave={async (left, right) => {
          // ✅ 寫入 IndexedDB 再更新畫面
          const doc = await saveWheels({ equip: left, moves: right });
          setEquipList(doc.equip);
          setMoveList(doc.moves);
          // 下拉的目前值也同步到新的第一項，避免空值
          setEquip(doc.equip[0] ?? "");
          setMove(doc.moves[0] ?? "");
        }}
      />

      {/* 抽屜（僅編輯，不放刪除） */}
      <ExerciseEditorDrawer
        open={drawerOpen}
        exercise={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={loadExercises}
        onDeleted={loadExercises}
      />
    </main>
  );
}