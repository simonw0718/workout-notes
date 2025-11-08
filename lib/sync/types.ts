// lib/sync/types.ts
export type Unit = "kg" | "lb";
export type RepsUnit = "rep" | "sec"; 
export type SessionRow = {
  id: string;
  startedAt: number;
  endedAt?: number | null;
  updatedAt: number;
  deletedAt?: number | null;
  deviceId: string;
};

export type ExerciseRow = {
  id: string;
  name: string;
  defaultWeight?: number;
  defaultReps?: number;
  defaultUnit?: Unit;
  defaultRepsUnit?: RepsUnit;
  isFavorite?: boolean;
  sortOrder?: number | null;
  updatedAt: number;
  deletedAt?: number | null;
  deviceId: string;
};

export type SetRow = {
  id: string;
  sessionId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  unit?: Unit;
  rpe?: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  deviceId: string;
};

export type ChangesPayload = {
  sessions: SessionRow[];
  exercises: ExerciseRow[];
  sets: SetRow[];
};

export type SyncRequest = {
  deviceId: string;
  token: string;
  lastVersion: number;
  changes: ChangesPayload;
};

export type SyncResponse = {
  serverVersion: number;
  changes: {
    sessions: SessionRow[];
    exercises: ExerciseRow[];
    sets: SetRow[];
  };
};