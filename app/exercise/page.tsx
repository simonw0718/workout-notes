// app/exercise/page.tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  addSet,
  deleteSet,
  getExerciseById,
  getLastSetsForExercise,
  getLatestSetAcrossSessions,
  getLatestSetInSession,
  listSetsBySessionAndExercise,
  startSession,
} from "@/lib/db";
import type { SetRecord, Unit } from "@/lib/models/types";
import NumberStepper from "@/components/NumberStepper";
import SetList from "@/components/SetList";

/** 換算：lb ↔ kg */
const LB_TO_KG = 0.45359237;
const toKg = (lb: number) => Math.round(lb * LB_TO_KG * 10) / 10;
const toLb = (kg: number) => Math.round(kg / LB_TO_KG);

function ExerciseInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const sessionId = sp.get("sessionId") ?? "";
  const exerciseId = sp.get("exerciseId") ?? "";

  /** 單位（頁內可切換），重量、次數、RPE */
  const [unit, setUnit] = useState<Unit>("lb");
  const [weight, setWeight] = useState<number>(60);
  const [reps, setReps] = useState<number>(8);
  const [rpe, setRpe] = useState<number | null>(null);
  const weightStep = unit === "kg" ? 2.5 : 5;

  /** 標題、列表、上一回合 */
  const [name, setName] = useState("Loading...");
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [lastSets, setLastSets] = useState<SetRecord[]>([]);

  /** 撤銷刪除 */
  const [undoVisible, setUndoVisible] = useState(false);
  const lastDeletedRef = useRef<SetRecord | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabled = !sessionId || !exerciseId;

  /** 單位切換：只有這裡會轉換重量 */
  const toggleUnit = () => {
    setUnit((prev) => {
      if (prev === "kg") {
        setWeight((w) => toLb(w)); // kg -> lb
        return "lb";
      } else {
        setWeight((w) => toKg(w)); // lb -> kg
        return "kg";
      }
    });
  };

  /** 確保 session 存在，然後載入動作/列表/上一回合 + 自動帶入策略 */
  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      if (!sessionId) {
        const s = await startSession();
        if (cancelled) return true;
        router.replace(`/exercise?exerciseId=${exerciseId}&sessionId=${s.id}`);
        return true;
      }
      return false;
    }

    async function load() {
      const created = await ensureSession();
      if (created || !exerciseId) return;

      // 併行取得資料
      const [ex, list, prev, sameSessionLast, crossSessionLast] =
        await Promise.all([
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

      // === 自動帶入策略（優先序）===
      // 1) 同一 Session 最近一組
      // 2) 跨 Session 最近一組
      // 3) 動作預設
      const fallbackUnit: Unit = (ex?.defaultUnit ?? "lb") as Unit;
      const fallbackWeight = ex?.defaultWeight;
      const fallbackReps = ex?.defaultReps;

      let nextUnit: Unit = fallbackUnit;
      let nextWeight: number | undefined = fallbackWeight;
      let nextReps: number | undefined = fallbackReps;

      if (crossSessionLast) {
        // 先設成跨 Session，後面若同 Session 有更近的會覆蓋
        nextUnit = (crossSessionLast.unit ?? fallbackUnit) as Unit;
        nextWeight = crossSessionLast.weight;
        nextReps = crossSessionLast.reps;
      }
      if (sameSessionLast) {
        nextUnit = (sameSessionLast.unit ?? nextUnit) as Unit;
        nextWeight = sameSessionLast.weight;
        nextReps = sameSessionLast.reps;
      }

      // 設定畫面單位 = nextUnit
      setUnit(nextUnit);

      // 權責：只有在有值時才設定，避免覆蓋為 undefined
      if (typeof nextWeight === "number") setWeight(nextWeight);
      if (typeof nextReps === "number") setReps(nextReps);
    }

    load();
    return () => {
      cancelled = true;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, sessionId]);

  /** 刷新當前列表 */
  const refreshList = async () => {
    if (!sessionId || !exerciseId) return;
    const list = await listSetsBySessionAndExercise(sessionId, exerciseId);
    setSets(list);
  };

  /** 新增一組（寫入當前 unit） */
  const handleAdd = async () => {
    if (disabled) return;
    await addSet({ sessionId, exerciseId, weight, reps, unit, rpe });
    await refreshList();
  };

  /** 刪除、撤銷 */
  const handleDelete = async (id: string) => {
    const rec = sets.find((s) => s.id === id) || null;
    lastDeletedRef.current = rec;
    await deleteSet(id);
    await refreshList();

    setUndoVisible(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoVisible(false), 5000);
  };

  const handleUndo = async () => {
    const rec = lastDeletedRef.current;
    if (!rec) return;
    await addSet({
      sessionId: rec.sessionId,
      exerciseId: rec.exerciseId,
      weight: rec.weight,
      reps: rec.reps,
      unit: rec.unit ?? "lb",
      rpe: rec.rpe ?? null,
    });
    lastDeletedRef.current = null;
    setUndoVisible(false);
    await refreshList();
  };

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      {/* Header：返回 + 標題 + 單位切換 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:underline"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold">{name}</h1>
        <div className="flex items-center gap-2 select-none">
          <span className={unit === "kg" ? "font-semibold" : ""}>kg</span>
          <button
            onClick={toggleUnit}
            aria-label="toggle weight unit"
            className={`w-12 h-6 rounded-full relative transition ${
              unit === "kg" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                unit === "kg" ? "left-6" : "left-1"
              }`}
            />
          </button>
          <span className={unit === "lb" ? "font-semibold" : ""}>lb</span>
        </div>
      </div>

      {/* 上一次訓練（最後三組） */}
      {lastSets.length > 0 && (
        <section className="rounded-xl border p-3">
          <div className="text-sm text-gray-600 mb-2">
            上一次訓練（最後三組）
          </div>
          <div className="flex flex-wrap gap-2">
            {lastSets.map((s) => (
              <span
                key={s.id}
                className="px-2 py-1 rounded-lg bg-gray-100 text-sm"
              >
                {s.weight}
                {s.unit ?? "lb"}×{s.reps}
                {s.rpe != null ? ` RPE${s.rpe}` : ""}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 輸入區 */}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <NumberStepper
          label={`重量 (${unit})`}
          value={weight}
          step={weightStep}
          onChange={setWeight}
          onEnter={handleAdd}
        />

        <NumberStepper
          label="次數"
          value={reps}
          step={1}
          onChange={setReps}
          onEnter={handleAdd}
        />

        {/* RPE 快速鈕（可選） */}
        <div className="space-y-2">
          <div className="text-sm text-gray-600">RPE（可選）</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRpe(null)}
              className={`px-3 py-1 rounded-lg border ${
                rpe == null ? "bg-gray-900 text-white" : ""
              }`}
            >
              NA
            </button>
            {[6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRpe(n)}
                className={`px-3 py-1 rounded-lg border ${
                  rpe === n ? "bg-blue-600 text-white" : ""
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={disabled}
          type="submit"
          className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white disabled:bg-gray-300"
        >
          + 記一組
        </button>

        {disabled && (
          <p className="text-xs text-gray-500">請先在首頁點「開始新訓練」</p>
        )}
      </form>

      {/* 已記錄列表 */}
      <SetList
        items={sets}
        onDelete={handleDelete}
        onUndo={handleUndo}
        showUndoHint={undoVisible}
      />
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
