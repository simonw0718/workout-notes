// app/settings/page.tsx
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

// 小工具：把空字串視為 undefined
const numOrUndef = (v: string) => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export default function SettingsPage() {
  // 新增用欄位
  const [name, setName] = useState("");
  const [defaultWeight, setDefaultWeight] = useState<string>("");
  const [defaultReps, setDefaultReps] = useState<string>("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [asFavorite, setAsFavorite] = useState(true);

  // 清單
  const [favorites, setFavorites] = useState<Exercise[]>([]);
  const [others, setOthers] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

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
    // 初次載入
    load();
  }, []);

  // ---------------- 新增 ----------------
  const handleCreate = async () => {
    if (!canCreate) return;
    await createExercise({
      name: name.trim(),
      defaultWeight: numOrUndef(defaultWeight),
      defaultReps: numOrUndef(defaultReps),
      defaultUnit: unit,
      isFavorite: asFavorite,
    });
    // reset
    setName("");
    setDefaultWeight("");
    setDefaultReps("");
    setUnit("kg");
    setAsFavorite(true);

    await load();
    emitFavoritesChanged();
  };

  // ---------------- 編輯（就地） ----------------
  const patchExercise = async (id: string, patch: Partial<Exercise>) => {
    await updateExercise({ id, ...patch });
    await load();
    emitFavoritesChanged();
  };

  // 單位切換
  const toggleUnit = async (ex: Exercise) => {
    const next: Unit = ex.defaultUnit === "kg" ? "lb" : "kg";
    await patchExercise(ex.id, { defaultUnit: next });
  };

  // 切換常用 / 取消常用
  const toggleFavorite = async (ex: Exercise) => {
    await patchExercise(ex.id, { isFavorite: !ex.isFavorite });
  };

  // 刪除
  const removeExercise = async (ex: Exercise) => {
    if (!confirm(`確定要刪除「${ex.name}」嗎？`)) return;
    await deleteExercise(ex.id);
    await load();
    emitFavoritesChanged();
  };

  // favorites 排序：上移/下移
  const moveFavorite = async (index: number, dir: -1 | 1) => {
    const arr = [...favorites];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    setFavorites(arr);
    await reorderFavorites(arr.map((x) => x.id));
    // 不必再 load，因為上面已經 setFavorites；但為了安全和其它端同步仍建議 load 一次
    await load();
    emitFavoritesChanged();
  };

  if (loading) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm">
            ← 返回
          </Link>
          <Link
            href="/sync"
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
          >
            雲端同步
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-6">設定</h1>
        <p>載入中…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm">
          ← 返回
        </Link>
        <Link
          href="/sync"
          className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
        >
          雲端同步
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">設定</h1>

      {/* 新增 */}
      <section className="rounded-2xl border p-4 mb-8">
        <h2 className="text-xl font-semibold mb-4">新增動作</h2>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="動作名稱（必填）"
            className="rounded-xl border px-3 py-2"
          />

          <div className="flex items-center gap-3">
            <span>kg</span>
            <button
              type="button"
              onClick={() => setUnit(unit === "kg" ? "lb" : "kg")}
              className={`w-16 h-9 rounded-full transition-all ${
                unit === "kg" ? "bg-blue-600" : "bg-gray-300"
              }`}
              aria-label="切換預設單位"
            >
              <span
                className={`block w-9 h-9 bg-white rounded-full shadow transform transition-all ${
                  unit === "kg" ? "translate-x-7" : ""
                }`}
              />
            </button>
            <span>lb</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={defaultWeight}
              onChange={(e) => setDefaultWeight(e.target.value)}
              inputMode="numeric"
              placeholder="預設重量（可空）"
              className="rounded-xl border px-3 py-2"
            />
            <input
              value={defaultReps}
              onChange={(e) => setDefaultReps(e.target.value)}
              inputMode="numeric"
              placeholder="預設次數（可空）"
              className="rounded-xl border px-3 py-2"
            />
          </div>

          <label className="mt-2 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={asFavorite}
              onChange={(e) => setAsFavorite(e.target.checked)}
            />
            設為常用（顯示在首頁）
          </label>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className="mt-2 w-28 rounded-xl bg-black text-white py-2 disabled:opacity-40"
          >
            新增
          </button>
        </div>
      </section>

      {/* 常用（可排序） */}
      <section className="rounded-2xl border p-4 mb-8">
        <h2 className="text-xl font-semibold mb-4">常用動作（可排序）</h2>

        {favorites.length === 0 ? (
          <p className="text-gray-500">尚未設定常用動作</p>
        ) : (
          <ul className="space-y-3">
            {favorites.map((ex, i) => (
              <li key={ex.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-sm text-gray-500">
                      預設：{ex.defaultWeight ?? "-"} {ex.defaultUnit ?? "-"} ×{" "}
                      {ex.defaultReps ?? "-"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border px-2 py-1"
                      onClick={() => moveFavorite(i, -1)}
                    >
                      上移
                    </button>
                    <button
                      className="rounded-lg border px-2 py-1"
                      onClick={() => moveFavorite(i, 1)}
                    >
                      下移
                    </button>

                    <button
                      className="rounded-lg border px-2 py-1"
                      onClick={() => toggleFavorite(ex)}
                      title="取消常用"
                    >
                      取消常用
                    </button>

                    <button
                      className="rounded-lg border px-2 py-1"
                      onClick={() => removeExercise(ex)}
                    >
                      刪除
                    </button>
                  </div>
                </div>

                {/* 就地編輯預設參數 */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <input
                    defaultValue={ex.defaultWeight ?? ""}
                    inputMode="numeric"
                    placeholder="預設重量"
                    className="rounded-lg border px-2 py-1 w-28"
                    onBlur={(e) =>
                      patchExercise(ex.id, {
                        defaultWeight: numOrUndef(e.target.value),
                      })
                    }
                  />
                  <button
                    className="rounded-lg border px-2 py-1"
                    onClick={() => toggleUnit(ex)}
                  >
                    單位：{ex.defaultUnit ?? "kg"}
                  </button>
                  <input
                    defaultValue={ex.defaultReps ?? ""}
                    inputMode="numeric"
                    placeholder="預設次數"
                    className="rounded-lg border px-2 py-1 w-28"
                    onBlur={(e) =>
                      patchExercise(ex.id, {
                        defaultReps: numOrUndef(e.target.value),
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 其他動作 */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-xl font-semibold mb-4">其他動作</h2>

        {others.length === 0 ? (
          <p className="text-gray-500">無其他動作</p>
        ) : (
          <ul className="space-y-3">
            {others.map((ex) => (
              <li key={ex.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-sm text-gray-500">
                      預設：{ex.defaultWeight ?? "-"} {ex.defaultUnit ?? "-"} ×{" "}
                      {ex.defaultReps ?? "-"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border px-2 py-1"
                      onClick={() => toggleFavorite(ex)}
                    >
                      設為常用
                    </button>
                    <button
                      className="rounded-lg border px-2 py-1"
                      onClick={() => removeExercise(ex)}
                    >
                      刪除
                    </button>
                  </div>
                </div>

                {/* 就地編輯預設參數 */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <input
                    defaultValue={ex.defaultWeight ?? ""}
                    inputMode="numeric"
                    placeholder="預設重量"
                    className="rounded-lg border px-2 py-1 w-28"
                    onBlur={(e) =>
                      patchExercise(ex.id, {
                        defaultWeight: numOrUndef(e.target.value),
                      })
                    }
                  />
                  <button
                    className="rounded-lg border px-2 py-1"
                    onClick={() => toggleUnit(ex)}
                  >
                    單位：{ex.defaultUnit ?? "kg"}
                  </button>
                  <input
                    defaultValue={ex.defaultReps ?? ""}
                    inputMode="numeric"
                    placeholder="預設次數"
                    className="rounded-lg border px-2 py-1 w-28"
                    onBlur={(e) =>
                      patchExercise(ex.id, {
                        defaultReps: numOrUndef(e.target.value),
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}