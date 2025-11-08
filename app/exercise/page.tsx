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

/** 換算：lb ↔ kg */
const LB_TO_KG = 0.45359237;
const toKg = (lb: number) => Math.round(lb * LB_TO_KG * 10) / 10;
const toLb = (kg: number) => Math.round(kg / LB_TO_KG);

/** 將秒轉為 mm:ss */
function fmtSec(total: number) {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function ExerciseInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const sessionId = sp.get("sessionId") ?? "";
  const exerciseId = sp.get("exerciseId") ?? "";

  // 錯誤提示
  const [lastError, setLastError] = useState<string>("");

  /** 單位、重量、次數、RPE */
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

  /** 記錄提示 */
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabled = !sessionId || !exerciseId;

  /** 休息倒數計時器狀態 */
  const [targetSeconds, setTargetSeconds] = useState<number>(120);
  const [secondsLeft, setSecondsLeft] = useState<number>(120);
  const [running, setRunning] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 完成提醒：Toast + 螢幕閃爍 */
  const [toast, setToast] = useState<string>("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3000);
  };
  const triggerFlash = () => {
    setFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(false), 500);
  };

  const toggleUnit = () => {
    setUnit((prev) => {
      if (prev === "kg") {
        setWeight((w) => (typeof w === "number" ? toLb(w) : w));
        return "lb";
      }
      setWeight((w) => (typeof w === "number" ? toKg(w) : w));
      return "kg";
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
        let nextUnit: Unit = fallbackUnit;
        let nextWeight: number | undefined = ex?.defaultWeight ?? undefined;
        let nextReps: number | undefined = ex?.defaultReps ?? undefined;

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
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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

  /** 新增一組：保留 reps、不清空；顯示「已紀錄！」2 秒 */
  const handleAdd = async () => {
    setLastError("");
    if (disabled) {
      setLastError("參數不足：sessionId 或 exerciseId 缺失");
      return;
    }
    const w = Number(weight);
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || r <= 0) {
      setLastError("請輸入正確的『重量』與『次數』");
      return;
    }
    try {
      await addSet({ sessionId, exerciseId, weight: w, reps: r, unit, rpe });
      await refreshList();
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 2000);
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
    } catch (e) {
      console.error("[Exercise] undo failed:", e);
      setLastError("撤銷失敗：" + (e instanceof Error ? e.message : String(e)));
    }
  };

  /** ====== 計時器：控制函式 ====== */
  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = (secs?: number) => {
    // 若有指定秒數就用它；否則以「剩餘秒數 > 0 ? 剩餘秒數 : 目標秒數」
    const base = Number.isFinite(secs as number)
      ? Math.max(1, Math.floor(secs as number))
      : (secondsLeft > 0 ? secondsLeft : targetSeconds);

    clearTick();
    setTargetSeconds(base);
    setSecondsLeft(base);
    setRunning(true);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTick();
          setRunning(false);
          // 完成提醒（不使用震動；用 Toast + 閃爍）
          triggerFlash();
          showToast("休息結束！開始下一組吧 👊");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    clearTick();
    setRunning(false);
  };

  const resetTimer = () => {
    clearTick();
    setRunning(false);
    setSecondsLeft(targetSeconds);
  };

  /** 自訂秒數：輸入完就把數字帶到倒數區（不自動開始） */
  const applyCustomSeconds = () => {
    const n = Math.floor(Number(customInput));
    if (Number.isFinite(n) && n > 0) {
      stopTimer();
      setTargetSeconds(n);
      setSecondsLeft(n);
    }
  };

  const canSave =
    !!sessionId &&
    !!exerciseId &&
    Number.isFinite(Number(weight)) &&
    Number.isFinite(Number(reps)) &&
    Number(reps) > 0;

  return (
    <main className="min-h-[100dvh] bg-white">
      {/* Header：黑底白字 */}
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
        {/* 錯誤提示 */}
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

        {/* 新增一組 */}
        <section className="rounded-2xl p-4 bg-black text-white space-y-4 text-center">
          <h2 className="font-semibold">新增一組</h2>

          {/* 重量 */}
          <div className="space-y-2 max-w-sm mx-auto">
            <div className="text-xs text-white/80">重量/秒數（{unit}）</div>
            <div className="rounded-2xl border border-white/25 p-2">
              <div className="grid grid-cols-[72px_1fr_72px] gap-2 items-center">
                <button
                  type="button"
                  className="h-10 rounded-lg border border-white/50 px-3 font-medium hover:bg-white/10"
                  onClick={() => setWeight((prev) => Math.max(0, Number(prev) - weightStep))}
                >
                  −{weightStep}
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  className="h-10 w-full rounded-lg bg-white text-black text-center px-3"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <button
                  type="button"
                  className="h-10 rounded-lg border border-white/50 px-3 font-medium hover:bg-white/10"
                  onClick={() => setWeight((prev) => Number(prev) + weightStep)}
                >
                  +{weightStep}
                </button>
              </div>
            </div>
          </div>

          {/* 次數 */}
          <div className="space-y-2 max-w-sm mx-auto">
            <div className="text-xs text-white/80">次數/秒數</div>
            <div className="rounded-2xl border border-white/25 p-2">
              <div className="grid grid-cols-[72px_1fr_72px] gap-2 items-center">
                <button
                  type="button"
                  className="h-10 rounded-lg border border-white/50 px-3 font-medium hover:bg-white/10"
                  onClick={() => setReps((prev) => Math.max(0, Number(prev) - 1))}
                >
                  −1
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  className="h-10 w-full rounded-lg bg-white text-black text-center px-3"
                  value={reps}
                  onChange={(e) => setReps(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <button
                  type="button"
                  className="h-10 rounded-lg border border-white/50 px-3 font-medium hover:bg-white/10"
                  onClick={() => setReps((prev) => Number(prev) + 1)}
                >
                  +1
                </button>
              </div>
            </div>
          </div>

          {/* RPE */}
          <div className="space-y-2 max-w-sm mx-auto">
            <div className="text-xs text-white/80 text-left">RPE（可選）</div>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={() => setRpe(null)}
                className={`px-3 py-2 rounded-lg border ${rpe == null ? "bg-white text-black" : "border-white/40"}`}
              >
                NA
              </button>
              {[6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpe(n)}
                  className={`px-3 py-2 rounded-lg border ${rpe === n ? "bg-white text-black" : "border-white/40"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* 記一組（白框按鈕） + 提示 */}
          <div className="max-w-sm mx-auto">
            <button
              onClick={handleAdd}
              disabled={!canSave}
              className="w-full h-12 rounded-xl border border-white/70 text-white font-medium hover:bg-white/10 disabled:opacity-50"
            >
              + 記一組
            </button>
            {justSaved && <p className="text-xs text-green-300 mt-2">已紀錄！</p>}
            {!canSave && (
              <p className="text-xs text-white/70 mt-2">
                請輸入有效的重量與次數，並確認已在首頁開始訓練
              </p>
            )}
          </div>
        </section>

        {/* 休息倒數 */}
        <section className="rounded-2xl p-4 bg-black text-white space-y-4 text-center">
          <h2 className="font-semibold">休息計時</h2>

          {/* 倒數顯示 */}
          <div className="max-w-sm mx-auto">
            <div className="rounded-2xl border border-white/70 p-4">
              <div className="mx-auto w-48 h-16 rounded-xl bg-white text-black grid place-items-center text-2xl font-mono">
                {fmtSec(secondsLeft)}
              </div>

              {/* 控制列 */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => startTimer()}
                  className="h-10 rounded-xl bg-green-500 text-black font-medium hover:opacity-90"
                >
                  開始
                </button>
                <button
                  onClick={stopTimer}
                  className="h-10 rounded-xl bg-red-500 text-black font-medium hover:opacity-90"
                >
                  停止
                </button>
                <button
                  onClick={resetTimer}
                  className="h-10 rounded-xl bg-yellow-400 text-black font-medium hover:opacity-90"
                >
                  重置
                </button>
              </div>

              {/* 預設秒數 + 自訂 */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                <button
                  onClick={() => startTimer(120)}
                  className="h-10 rounded-xl border border-white/70 hover:bg-white/10"
                >
                  2:00
                </button>
                <button
                  onClick={() => startTimer(60)}
                  className="h-10 rounded-xl border border-white/70 hover:bg-white/10"
                >
                  1:00
                </button>
                <button
                  onClick={() => startTimer(30)}
                  className="h-10 rounded-xl border border-white/70 hover:bg-white/10"
                >
                  0:30
                </button>
                <div className="h-10 rounded-xl border border-white/70 flex items-center px-2">
                  <input
                    aria-label="自訂秒數"
                    type="number"
                    inputMode="numeric"
                    className="w-full bg-transparent text-white text-center outline-none"
                    placeholder="自訂秒"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onBlur={applyCustomSeconds}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyCustomSeconds();
                    }}
                  />
                </div>
              </div>

              {/* 目前目標提示 */}
              <div className="mt-2 text-xs text-white/70">目前目標：{fmtSec(targetSeconds)}</div>
            </div>
          </div>
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
                    {s.weight} {s.unit ?? "kg"} × {s.reps}
                    {s.rpe != null ? ` · RPE${s.rpe}` : ""}
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
              <button onClick={handleUndo} className="underline">
                復原
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ===== 提醒：Toast ===== */}
      {toast && (
        <div className="fixed top-4 inset-x-0 z-[60] flex justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-xl bg-white text-black shadow px-4 py-2 text-sm border">
            {toast}
          </div>
        </div>
      )}

      {/* ===== 螢幕閃爍（簡易覆蓋 0.5s）===== */}
      {flash && <div className="fixed inset-0 z-[50] bg-white/80 pointer-events-none" />}
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