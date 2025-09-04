// lib/models/types.ts

export type Unit = "kg" | "lb";

export type Meta = {
  id: "app";
  deviceId: string;
  userId?: string;
  token?: string;
  lastServerVersion?: number;
};

export type Session = {
  id: string;
  startedAt: number;
  endedAt?: number | null;
  deletedAt?: number | null;
  updatedAt: number;
  deviceId: string;
};

export type Exercise = {
  id: string;
  name: string;
  defaultWeight?: number | null;
  defaultReps?: number | null;
  defaultUnit?: Unit | null;
  isFavorite?: boolean | null;
  sortOrder?: number | null;
  deletedAt?: number | null;
  updatedAt: number;
  deviceId: string;
};

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