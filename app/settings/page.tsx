"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  listAllExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  reorderFavorites,
} from "@/lib/db";
import type { Exercise, Unit } from "@/lib/models/types";
import { emitFavoritesChanged } from "@/lib/bus";

// 匯出 presets
import { exportPresetsAsBlob, tryShareFile, triggerDownload } from "@/lib/export/presets";

/* =========================
 *  可調整樣式集中管理
 * ========================= */
const INPUT_W = "w-24"; // 可改 w-20 / w-28 做微調
const UNIT_BOX = "rounded-lg border px-3 py-2 whitespace-nowrap";
const ROW = "flex flex-wrap items-center gap-3";
const NUM_INPUT = `rounded-lg border px-2 py-2 ${INPUT_W}`;
const CREATE_INPUT = `rounded-xl border px-3 py-3 text-base ${INPUT_W}`;

const numOrUndef = (v: string) => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export default function SettingsPage() {
  // 新增區
  const [name, setName] = useState("");
  const [defaultWeight, setDefaultWeight] = useState<string>("");
  const [defaultReps, setDefaultReps] = useState<string>("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [asFavorite, setAsFavorite] = useState(true);

  // 清單
  const [favorites, setFavorites] = useState<Exercise[]>([]);
  const [others, setOthers] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // 匯出
  const [exportMsg, setExportMsg] = useState<string>("");
  const [exportBusy, setExportBusy] = useState(false);

  const canCreate = useMemo(() => name.trim().length > 0, [name]);

  const load = async () => {
    setLoading(true);
    const all = await listAllExercises();
    const favs = all
      .filter((x) => x.isFavorite)
      .sort((a, b) => (a.sortOrder ?? 9e9) - (b.sortOrder ?? 9e9));
    const nonFavs = all
      .filter((x) => !x.isFavorite)
      .sort((a, b) => a.name.localeCompare(b.name));
    setFavorites(favs);
    setOthers(nonFavs);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 匯出 presets
  const handleExportPresets = async () => {
    try {
      setExportBusy(true);
      setExportMsg("");
      const { blob, filename } = await exportPresetsAsBlob();
      const shared = await tryShareFile(blob, filename);
      if (shared) setExportMsg("已透過分享送出。");
      else {
        await triggerDownload(blob, filename);
        setExportMsg("已下載檔案（此裝置不支援分享）。");
      }
    } catch (e: any) {
      setExportMsg(`匯出失敗：${e?.message ?? e}`);
    } finally {
      setExportBusy(false);
    }
  };

  // 建立
  const handleCreate = async () => {
    if (!canCreate) return;
    await createExercise({
      name: name.trim(),
      defaultWeight: numOrUndef(defaultWeight),
      defaultReps: numOrUndef(defaultReps),
      defaultUnit: unit,
      isFavorite: asFavorite,
    });
    setName("");
    setDefaultWeight("");
    setDefaultReps("");
    setUnit("kg");
    setAsFavorite(true);
    await load();
    emitFavoritesChanged();
  };

  // 共用小動作
  const patchExercise = async (id: string, patch: Partial<Exercise>) => {
    await updateExercise({ id, ...patch });
    await load();
    emitFavoritesChanged();
  };
  const toggleUnit = async (ex: Exercise) => {
    const next: Unit = ex.defaultUnit === "kg" ? "lb" : "kg";
    await patchExercise(ex.id, { defaultUnit: next });
  };
  const toggleFavorite = async (ex: Exercise) => {
    await patchExercise(ex.id, { isFavorite: !ex.isFavorite });
  };
  const removeExercise = async (ex: Exercise) => {
    if (!confirm(`確定要刪除「${ex.name}」嗎？`)) return;
    await deleteExercise(ex.id);
    await load();
    emitFavoritesChanged();
  };
  const moveFavorite = async (index: number, dir: -1 | 1) => {
    const arr = [...favorites];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    setFavorites(arr);
    await reorderFavorites(arr.map((x) => x.id));
    await load();
    emitFavoritesChanged();
  };

  if (loading) {
    return (
      <main className="max-w-screen-sm mx-auto p-4 sm:p-6">
        <div className="sticky top-0 -mx-4 sm:-mx-6 mb-4 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-b">
            <Link href="/" className="text-sm">← 返回</Link>
            <div className="flex items-center gap-2">
              <Link href="/diagnostics" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">偵錯</Link>
              {/* 變更：連到 /sync，文案改「資料搬運」 */}
              <Link href="/sync" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">資料搬運</Link>
            </div>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">設定</h1>
        <p>載入中…</p>
      </main>
    );
  }

  return (
    <main className="max-w-screen-sm mx-auto p-4 sm:p-6 space-y-6">
      {/* Sticky header */}
      <div className="sticky top-0 -mx-4 sm:-mx-6 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-b">
          <Link href="/" className="text-sm">← 返回</Link>
          <div className="flex items-center gap-2">
            <Link href="/diagnostics" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">偵錯</Link>
            {/* 變更：連到 /sync，文案改「資料搬運」 */}
            <Link href="/sync" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">資料搬運</Link>
          </div>
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold">設定</h1>

      {/* 資料匯出 */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-lg sm:text-xl font-semibold">資料匯出</h2>
        <p className="text-sm text-gray-600">
          匯出「動作預設（presets）」為 <code>.wkn.json</code> 檔，可用 AirDrop/訊息分享或直接下載。
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportPresets}
            disabled={exportBusy}
            className="h-11 rounded-xl bg-black text-white px-4 disabled:opacity-40"
          >
            匯出 presets
          </button>
          <Link href="/settings/presets-transfer" className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
            進階：匯入／差異預覽
          </Link>
        </div>
        {exportMsg && <p className="text-sm text-gray-700">{exportMsg}</p>}
      </section>

      {/* 新增 */}
      <section className="rounded-2xl border p-4 space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold">新增動作</h2>

        <div className="grid gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="動作名稱（必填）"
            className="rounded-xl border px-3 py-3 text-base"
          />

          {/* 單位切換 */}
          <div className="flex items-center gap-3">
            <span>kg</span>
            <button
              type="button"
              onClick={() => setUnit(unit === "kg" ? "lb" : "kg")}
              className={`w-16 h-9 rounded-full transition-all ${unit === "kg" ? "bg-blue-600" : "bg-gray-300"}`}
              aria-label="切換預設單位"
            >
              <span className={`block w-9 h-9 bg-white rounded-full shadow transform transition-all ${unit === "kg" ? "translate-x-7" : ""}`} />
            </button>
            <span>lb</span>
          </div>

          {/* 數值欄位（固定寬輸入 + 不換行單位） */}
          <div className={ROW}>
            <input
              value={defaultWeight}
              onChange={(e) => setDefaultWeight(e.target.value)}
              inputMode="decimal"
              placeholder="預設重量（可空）"
              className={CREATE_INPUT}
            />
            <span className={`${UNIT_BOX} rounded-xl`}>單位：{unit}</span>
          </div>

          <div className={ROW}>
            <input
              value={defaultReps}
              onChange={(e) => setDefaultReps(e.target.value)}
              inputMode="numeric"
              placeholder="預設次數（可空）"
              className={CREATE_INPUT}
            />
            <span className={`${UNIT_BOX} rounded-xl`}>單位：次</span>
          </div>

          <label className="mt-1 inline-flex items-center gap-2 select-none">
            <input type="checkbox" checked={asFavorite} onChange={(e) => setAsFavorite(e.target.checked)} />
            設為常用（顯示在首頁）
          </label>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className="mt-1 h-11 rounded-xl bg-black text-white px-4 disabled:opacity-40"
          >
            新增
          </button>
        </div>
      </section>

      {/* 常用（可排序） */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">常用動作（可排序）</h2>

        {favorites.length === 0 ? (
          <p className="text-gray-500">尚未設定常用動作</p>
        ) : (
          <ul className="space-y-3">
            {favorites.map((ex, i) => (
              <li key={ex.id} className="rounded-xl border p-3 space-y-2">
                {/* 第1排：名稱靠左、上/下移靠右（直向排列） */}
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium truncate">{ex.name}</div>
                  <div className="flex flex-col gap-1">
                    <button className="rounded-lg border px-2 py-1" onClick={() => moveFavorite(i, -1)}>上移</button>
                    <button className="rounded-lg border px-2 py-1" onClick={() => moveFavorite(i, 1)}>下移</button>
                  </div>
                </div>

                {/* 第2排：重量 + 單位 + （取消）常用 */}
                <div className={ROW}>
                  <input
                    defaultValue={ex.defaultWeight ?? ""}
                    inputMode="decimal"
                    placeholder="重量"
                    className={NUM_INPUT}
                    onBlur={(e) => patchExercise(ex.id, { defaultWeight: numOrUndef(e.target.value) })}
                  />
                  <button
                    className={UNIT_BOX}
                    onClick={() => toggleUnit(ex)}
                    title="切換單位"
                  >
                    單位：{ex.defaultUnit ?? "kg"}
                  </button>

                  <button
                    className="rounded-lg border px-3 py-2"
                    onClick={() => toggleFavorite(ex)}
                  >
                    {ex.isFavorite ? "取消常用" : "設為常用"}
                  </button>
                </div>

                {/* 第3排：次數 + 單位：次 —— 刪除靠右 */}
                <div className={`${ROW} justify-between`}>
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={ex.defaultReps ?? ""}
                      inputMode="numeric"
                      placeholder="次數"
                      className={NUM_INPUT}
                      onBlur={(e) => patchExercise(ex.id, { defaultReps: numOrUndef(e.target.value) })}
                    />
                    <span className={UNIT_BOX}>單位：次</span>
                  </div>

                  <button
                    className="rounded-lg border px-3 py-2 ml-auto"
                    onClick={() => removeExercise(ex)}
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 其他動作 */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">其他動作</h2>

        {others.length === 0 ? (
          <p className="text-gray-500">無其他動作</p>
        ) : (
          <ul className="space-y-3">
            {others.map((ex) => (
              <li key={ex.id} className="rounded-xl border p-3 space-y-2">
                {/* 第1排：名稱 */}
                <div className="font-medium truncate">{ex.name}</div>

                {/* 第2排：重量 + 單位 + 設為常用 */}
                <div className={ROW}>
                  <input
                    defaultValue={ex.defaultWeight ?? ""}
                    inputMode="decimal"
                    placeholder="重量"
                    className={NUM_INPUT}
                    onBlur={(e) => patchExercise(ex.id, { defaultWeight: numOrUndef(e.target.value) })}
                  />
                  <button className={UNIT_BOX} onClick={() => toggleUnit(ex)}>
                    單位：{ex.defaultUnit ?? "kg"}
                  </button>

                  <button className="rounded-lg border px-3 py-2" onClick={() => toggleFavorite(ex)}>設為常用</button>
                </div>

                {/* 第3排：次數 + 單位：次 —— 刪除靠右 */}
                <div className={`${ROW} justify-between`}>
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={ex.defaultReps ?? ""}
                      inputMode="numeric"
                      placeholder="次數"
                      className={NUM_INPUT}
                      onBlur={(e) => patchExercise(ex.id, { defaultReps: numOrUndef(e.target.value) })}
                    />
                    <span className={UNIT_BOX}>單位：次</span>
                  </div>

                  <button className="rounded-lg border px-3 py-2 ml-auto" onClick={() => removeExercise(ex)}>刪除</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}