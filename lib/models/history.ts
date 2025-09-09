// lib/models/history.ts
import { z } from "zod";

// 直接沿用你現有 types 的語意（數值時間戳）
export const SessionExportSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  endedAt: z.number().nullable().optional(),
  deletedAt: z.number().nullable().optional(),
  updatedAt: z.number(),
  deviceId: z.string(),
});

export type SessionExport = z.infer<typeof SessionExportSchema>;

export const SetRecordExportSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  exerciseId: z.string(),
  weight: z.number(),
  reps: z.number(),
  unit: z.enum(["kg", "lb"]).nullable().optional(),
  rpe: z.number().nullable().optional(),
  createdAt: z.number(),
  deletedAt: z.number().nullable().optional(),
  updatedAt: z.number(),
  deviceId: z.string(),
});

export type SetRecordExport = z.infer<typeof SetRecordExportSchema>;

/** 歷史匯出檔格式（含 checksum） */
export const ExportHistoryV1Schema = z.object({
  app: z.literal("WorkoutNotes"),
  kind: z.literal("history"),
  version: z.literal(1),
  exportedAt: z.string(), // ISO
  device: z.object({ ua: z.string().optional() }).optional(),
  sessions: z.array(SessionExportSchema),
  sets: z.array(SetRecordExportSchema),
  checksum: z.string(),
});

export type ExportHistoryV1 = z.infer<typeof ExportHistoryV1Schema>;