// File: lib/models/types.ts

/** ===== 基本列舉（字面量） ===== */
export type Unit = "kg" | "lb" | "sec" | "min";
export type Category = "upper" | "lower" | "core" | "other";

/** 供 UI/驗證使用的常數清單（可選） */
export const UNIT_OPTIONS: Unit[] = ["kg", "lb", "sec", "min"];
export const CATEGORY_OPTIONS: Category[] = ["upper", "lower", "core", "other"];

/** 型別守衛（可選） */
export function isWeightUnit(u: Unit): u is "kg" | "lb" {
  return u === "kg" || u === "lb";
}
export function isTimeUnit(u: Unit): u is "sec" | "min" {
  return u === "sec" || u === "min";
}

/** ===== Meta（裝置／使用者） ===== */
export type Meta = {
  id: "app";
  deviceId: string;
  userId?: string;
  token?: string;
  lastServerVersion?: number;
};

/** ===== Session（訓練場次） ===== */
export type Session = {
  id: string;
  startedAt: number;
  endedAt?: number | null;
  deletedAt?: number | null;
  updatedAt: number;
  deviceId: string;
  /** 支援接續 */
  status?: "in_progress" | "ended";
};

/** ===== Exercise（動作） ===== */
export type Exercise = {
  id: string;
  name: string;
  defaultWeight?: number | null;
  defaultReps?: number | null;
  defaultUnit?: Unit | null;
  isFavorite?: boolean | null; // 舊欄位相容
  sortOrder?: number | null;
  deletedAt?: number | null;
  updatedAt: number;
  deviceId: string;
  category?: Category | null;  // 新分類
};

/** ===== SetRecord（一組紀錄） ===== */
export type SetRecord = {
  id: string;
  sessionId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  unit?: Unit | null;
  rpe?: number | null;
  createdAt: number;
  deletedAt?: number | null;
  updatedAt: number;
  deviceId: string;
};