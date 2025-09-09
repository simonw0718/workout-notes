// lib/models/presets.ts
import { z } from "zod";

// 放寬：uuid 允許任意非空字串（沿用現有 exercise.id 即可）
export const PresetSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().min(1),
  unit: z.enum(["kg", "lb"]), // 與現有 UI 一致（不是 "lbs"）
  default_weight: z.number().optional(),
  default_reps: z.number().optional(),
  muscles: z.array(z.string()).optional(),
  notes: z.string().optional(),
  createdAt: z.string(), // ISO
  updatedAt: z.string(), // ISO
});
export type Preset = z.infer<typeof PresetSchema>;

export const ExportBundleV1Schema = z.object({
  app: z.literal("WorkoutNotes"),
  kind: z.literal("presets"),
  version: z.literal(1),
  exportedAt: z.string(),
  device: z.object({ ua: z.string().optional() }).optional(),
  items: z.array(PresetSchema),
  checksum: z.string(),
});
export type ExportBundleV1 = z.infer<typeof ExportBundleV1Schema>;