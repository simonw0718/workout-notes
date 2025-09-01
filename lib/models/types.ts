// lib/models/types.ts

export type Unit = "kg" | "lb";

export type Session = {
  id: string;
  startedAt: number;
  endedAt?: number;
};

export type Exercise = {
  id: string;
  name: string;
  defaultWeight?: number; // 建議以 kg 存
  defaultReps?: number;
  isFavorite?: boolean;
};

export type SetRecord = {
  id: string;
  sessionId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  /** 新版資料一定有；為了相容舊資料，型別標成可選 */
  unit?: Unit;
  createdAt: number;
};
