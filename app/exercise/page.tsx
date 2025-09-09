"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  addSet, deleteSet, getExerciseById, getLastSetsForExercise,
  getLatestSetAcrossSessions, getLatestSetInSession,
  listSetsBySessionAndExercise, startSession,
} from "@/lib/db";
import type { SetRecord, Unit } from "@/lib/models/types";

/** 換算：lb ↔ kg */
const LB_TO_KG = 0.45359237;
const toKg = (lb: number) => Math.round(lb * LB_TO_KG * 10) / 10;
const toLb = (kg: number) => Math.round(kg / LB_TO_KG);

function ExerciseInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const sessionId = sp.get("sessionId") ?? "";
  const exerciseId = sp.get("exerciseId") ?? "";

  // 錯誤提示（僅在下方表單上方顯示，不再有 sessionId debug 列）
  const [lastError, setLastError] = useState<string>("");

  /** 單位（頁內可切換），重量、次數、RPE */
  const [unit, setUnit] = useState<Unit>("lb");
  const [weight, setWeight] = useState<number | string>(60);
  const [reps, setReps] = useState<number | string>(8);
  const [rpe, setRpe] = useState<number | null>(null);

  const weightStep = unit === "kg" ? 2.5 : 5;

  /** 標題、列表、上一回合 */
  const [name, setName] = useState("Loading…");
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [lastSets, setLastSets] = useState<SetRecord[]>([]);

  /** 撤銷刪除 */
  const [undoVisible, setUndoVisible] = useState(false);
  const lastDeletedRef = useRef<SetRecord | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabled = !sessionId || !exerciseId;

  const toggleUnit = () => {
    setUnit((prev) => {
      if (prev === "kg") { setWeight((w) => (typeof w === "number" ? toLb(w) : w)); return "lb"; }
      setWeight((w) => (typeof w === "number" ? toKg(w) : w)); return "kg";
    });
  };

  /** 確保 session + 載入資料 */
  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      try {
        if (!sessionId) {
          const s = await startSession();
          if (cancelled) return true;
          router.replace(`/exercise?exerciseId=${exerciseId}&sessionId=${s.id}`);
          return true;
        }
      } catch (e) {
        console.error("[Exercise] ensureSession failed:", e);
        setLastError("ensureSession 失敗：" + (e instanceof Error ? e.message : String(e)));
        return true;
      }
      return false;
    }

    async function load() {
      setLastError("");
      const created = await ensureSession();
      if (created || !exerciseId) return;

      try {
        const [ex, list, prev, sameSessionLast, crossSessionLast] = await Promise.all([
          getExerciseById(exerciseId),
          listSetsBySessionAndExercise(sessionId, exerciseId),
          getLastSetsForExercise(exerciseId, sessionId, 3),
          getLatestSetInSession(exerciseId, sessionId),
          getLatestSetAcrossSessions(exerciseId, sessionId),
        ]);
        if (cancelled) return;

        setName(ex?.name ?? "Unknown");
        setSets(list);
        setLastSets(prev);

        // 自動帶入策略
        const fallbackUnit: Unit = (ex?.defaultUnit ?? "lb") as Unit;
        const fallbackWeight = ex?.defaultWeight ?? undefined;
        const fallbackReps = ex?.defaultReps ?? undefined;

        let nextUnit: Unit = fallbackUnit;
        let nextWeight: number | undefined = fallbackWeight;
        let nextReps: number | undefined = fallbackReps;

        if (crossSessionLast) {
          nextUnit = (crossSessionLast.unit ?? nextUnit) as Unit;
          nextWeight = crossSessionLast.weight;
          nextReps = crossSessionLast.reps;
        }
        if (sameSessionLast) {
          nextUnit = (sameSessionLast.unit ?? nextUnit) as Unit;
          nextWeight = sameSessionLast.weight;
          nextReps = sameSessionLast.reps;
        }

        setUnit(nextUnit);
        if (typeof nextWeight === "number") setWeight(nextWeight);
        if (typeof nextReps === "number") setReps(nextReps);
      } catch (e) {
        console.error("[Exercise] load failed:", e);
        setLastError("載入資料失敗：" + (e instanceof Error ? e.message : String(e)));
      }
    }

    load();
    return () => {
      cancelled = true;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, sessionId]);

  const refreshList = async () => {
    if (!sessionId || !exerciseId) return;
    try {
      const list = await listSetsBySessionAndExercise(sessionId, exerciseId);
      setSets(list);
    } catch (e) {
      console.error("[Exercise] refreshList failed:", e);
      setLastError("refreshList 失敗：" + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleAdd = async () => {
    setLastError("");
    if (disabled) { setLastError("參數不足：sessionId 或 exerciseId 缺失"); return; }
    const w = Number(weight);
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || r <= 0) {
      setLastError("請輸入正確的『重量』與『次數』");
      return;
    }
    try {
      await addSet({ sessionId, exerciseId, weight: w, reps: r, unit, rpe });
      await refreshList();
      // 下一組沿用重量，清空次數
      setReps("");
    } catch (e) {
      console.error("[Exercise] addSet failed:", e);
      setLastError("addSet 失敗：" + (e instanceof Error ? e.message : String(e)));
      alert("新增失敗：請截圖給我。");
    }
  };

  const handleDelete = async (id: string) => {
    const rec = sets.find((s) => s.id === id) || null;
    lastDeletedRef.current = rec;
    try {
      await deleteSet(id);
      await refreshList();
      setUndoVisible(true);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoVisible(false), 5000);
    } catch (e) {
      console.error("[Exercise] delete failed:", e);
      setLastError("刪除失敗：" + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleUndo = async () => {
    const rec = lastDeletedRef.current;
    if (!rec) return;
    try {
      await addSet({
        sessionId: rec.sessionId, exerciseId: rec.exerciseId,
        weight: rec.weight, reps: rec.reps, unit: rec.unit ?? "lb", rpe: rec.rpe ?? null,
      });
      lastDeletedRef.current = null;
      setUndoVisible(false);
      await refreshList();
    } catch (e) {
      console.error("[Exercise] undo failed:", e);
      setLastError("撤銷失敗：" + (e instanceof Error ? e.message : String(e)));
    }
  };

  const canSave = !!sessionId && !!exerciseId && Number.isFinite(Number(weight)) && Number.isFinite(Number(reps)) && Number(reps) > 0;

  return (
    <main className="min-h-[100dvh] bg-white">
      {/* Header：黑底白字，統一樣式（PR4） */}
      <header className="sticky top-0 z-10 bg-black text-white px-4 py-4">
        <div className="max-w-screen-sm mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="text-sm underline underline-offset-2">
            返回
          </button>
          <h1 className="text-xl font-semibold truncate">{name}</h1>
          <div className="flex items-center gap-2 select-none">
            <span className={unit === "kg" ? "font-semibold" : ""}>kg</span>
            <button
              onClick={toggleUnit}
              aria-label="toggle weight unit"
              className={`w-12 h-6 rounded-full relative transition ${unit === "kg" ? "bg-white/70" : "bg-white/40"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${unit === "kg" ? "left-6" : "left-1"}`}
              />
            </button>
            <span className={unit === "lb" ? "font-semibold" : ""}>lb</span>
          </div>
        </div>
      </header>

      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6">
        {/* 錯誤提示（不再顯示 sessionId/debug；只顯示錯誤） */}
        {lastError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {lastError}
          </div>
        )}

        {/* 上一次訓練（最後三組） */}
        {lastSets.length > 0 && (
          <section className="rounded-2xl p-4 bg-black text-white">
            <h2 className="font-semibold mb-2">上一次訓練（最後三組）</h2>
            <div className="flex flex-wrap gap-2">
              {lastSets.map((s) => (
                <span key={s.id} className="px-2 py-1 rounded-lg bg-white/10 text-sm">
                  {s.weight}{s.unit ?? "lb"}×{s.reps}{s.rpe != null ? ` RPE${s.rpe}` : ""}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 新增一組：黑底白字控件（PR4） */}
        <section className="rounded-2xl p-4 bg-black text-white space-y-3">
          <h2 className="font-semibold">新增一組</h2>

          <label className="block">
            <div className="text-xs text-white/80 mb-1">重量（{unit}）</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-white text-black"
                onClick={() => setWeight((prev) => Math.max(0, Number(prev) - weightStep))}
              >
                −{weightStep}
              </button>
              <input
                type="number"
                inputMode="decimal"
                className="flex-1 px-3 py-2 rounded-lg bg-white text-black"
                value={weight}
                onChange={(e) => setWeight(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-white text-black"
                onClick={() => setWeight((prev) => Number(prev) + weightStep)}
              >
                +{weightStep}
              </button>
            </div>
          </label>

          <label className="block">
            <div className="text-xs text-white/80 mb-1">次數</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-white text-black"
                onClick={() => setReps((prev) => Math.max(0, Number(prev) - 1))}
              >
                −1
              </button>
              <input
                type="number"
                inputMode="numeric"
                className="flex-1 px-3 py-2 rounded-lg bg-white text-black"
                value={reps}
                onChange={(e) => setReps(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-white text-black"
                onClick={() => setReps((prev) => Number(prev) + 1)}
              >
                +1
              </button>
            </div>
          </label>

          <div className="space-y-2">
            <div className="text-xs text-white/80">RPE（可選）</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRpe(null)}
                className={`px-3 py-1 rounded-lg border ${rpe == null ? "bg-white text-black" : "border-white/40"}`}
              >
                NA
              </button>
              {[6,7,8,9,10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpe(n)}
                  className={`px-3 py-1 rounded-lg border ${rpe === n ? "bg:white text-black" : "border-white/40"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!canSave}
            className="w-full h-12 rounded-xl bg-white text-black font-medium disabled:opacity-50"
          >
            + 記一組
          </button>
          {!canSave && <p className="text-xs text-white/70">請輸入有效的重量與次數，並確認已在首頁開始訓練</p>}
        </section>

        {/* 本場次清單 */}
        <section className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">本場次紀錄</h2>
          {sets.length === 0 ? (
            <div className="text-gray-500 text-sm">尚未新增任何組數</div>
          ) : (
            <ul className="divide-y">
              {sets.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <div className="text-sm font-mono">
                    {s.weight} {s.unit ?? "kg"} × {s.reps}{s.rpe != null ? ` · RPE${s.rpe}` : ""}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {new Date(s.createdAt).toLocaleTimeString()}
                    </span>
                    <button
                      className="text-xs px-2 py-1 rounded-lg border hover:bg-gray-50"
                      onClick={() => handleDelete(s.id)}
                    >
                      刪除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {undoVisible && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-yellow-50 text-yellow-800 px-3 py-2 text-sm">
              <span>已刪除一筆</span>
              <button onClick={handleUndo} className="underline">復原</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ExercisePage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <ExerciseInner />
    </Suspense>
  );
}