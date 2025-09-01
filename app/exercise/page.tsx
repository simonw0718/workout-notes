"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  addSet,
  deleteSet,
  getExerciseById,
  getLastSetsForExercise,
  listSetsBySessionAndExercise,
  startSession,
} from "@/lib/db";
import type { SetRecord, Unit } from "@/lib/models/types";
import NumberStepper from "@/components/NumberStepper";
import SetList from "@/components/SetList";

// 換算：lb ↔ kg
const LB_TO_KG = 0.45359237;
const toKg = (lb: number) => Math.round(lb * LB_TO_KG * 10) / 10;
const toLb = (kg: number) => Math.round(kg / LB_TO_KG);

export default function ExercisePage() {
  const sp = useSearchParams();
  const router = useRouter();

  const sessionId = sp.get("sessionId") ?? "";
  const exerciseId = sp.get("exerciseId") ?? "";

  // 基本狀態
  const [name, setName] = useState("Loading...");
  const [weight, setWeight] = useState<number>(60);
  const [reps, setReps] = useState<number>(8);
  const [unit, setUnit] = useState<Unit>("lb"); // 預設 lb

  // 已記錄列表 / 上一次訓練
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [lastSets, setLastSets] = useState<SetRecord[]>([]);

  // 撤銷刪除
  const [undoVisible, setUndoVisible] = useState(false);
  const lastDeletedRef = useRef<SetRecord | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const disabled = useMemo(
    () => !sessionId || !exerciseId,
    [sessionId, exerciseId],
  );
  const weightStep = unit === "kg" ? 2.5 : 5;

  // 載入：確保 sessionId → 動作資料 + 當前列表 + 上一次訓練(最後三組)
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
      if (created) return;
      if (!exerciseId) return;

      const [ex, list, prev] = await Promise.all([
        getExerciseById(exerciseId),
        listSetsBySessionAndExercise(sessionId, exerciseId),
        getLastSetsForExercise(exerciseId, sessionId, 3),
      ]);
      if (cancelled) return;

      // 動作基本資料（假設 defaultWeight 以 kg 儲存；若你是 lb，請改成相反換算）
      setName(ex?.name ?? "Unknown");
      if (ex?.defaultWeight != null) {
        setWeight(unit === "kg" ? ex.defaultWeight : toLb(ex.defaultWeight));
      }
      if (ex?.defaultReps != null) setReps(ex.defaultReps);

      setSets(list);
      setLastSets(prev);
    }

    load();
    return () => {
      cancelled = true;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, sessionId]);

  // 切換單位（同步換算目前 weight）
  const toggleUnit = () => {
    setUnit((prev) => {
      if (prev === "kg") {
        setWeight((w) => toLb(w));
        return "lb";
      } else {
        setWeight((w) => toKg(w));
        return "kg";
      }
    });
  };

  // 列表刷新
  const refreshList = async () => {
    if (!sessionId || !exerciseId) return;
    const list = await listSetsBySessionAndExercise(sessionId, exerciseId);
    setSets(list);
  };

  // 新增一組（帶 unit）
  const handleAdd = async () => {
    if (disabled) return;
    await addSet({ sessionId, exerciseId, weight, reps, unit });
    await refreshList();
  };

  // 刪除／撤銷
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
    });
    lastDeletedRef.current = null;
    setUndoVisible(false);
    await refreshList();
  };

  // UI
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
            className={`w-12 h-6 rounded-full relative transition ${unit === "kg" ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${unit === "kg" ? "left-6" : "left-1"}`}
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
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 輸入區 */}
      <div className="space-y-4">
        <NumberStepper
          label={`重量（${unit}）`}
          value={weight}
          step={weightStep}
          onChange={setWeight}
        />
        <NumberStepper label="次數" value={reps} step={1} onChange={setReps} />

        <button
          disabled={disabled}
          onClick={handleAdd}
          className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white disabled:bg-gray-300"
        >
          + 記一組
        </button>

        {disabled && (
          <p className="text-xs text-gray-500">請先在首頁點「開始新訓練」</p>
        )}
      </div>

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
