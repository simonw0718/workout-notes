// lib/models/presets.ts
import { z } from "zod";

/**
 * Preset：匯出格式的單筆資料
 * - uuid：放寬為任意非空字串（可沿用現有 exercise.id）
 * - unit：統一使用 "kg" | "lb"
 * - createdAt / updatedAt：ISO 字串
 */
export const PresetSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().min(1),
  unit: z.enum(["kg", "lb"]),
  default_weight: z.number().optional(),
  default_reps: z.number().optional(),
  muscles: z.array(z.string()).optional(),
  notes: z.string().optional(),
  createdAt: z.string(), // ISO
  updatedAt: z.string(), // ISO
});
export type Preset = z.infer<typeof PresetSchema>;

/**
 * 匯出檔（Bundle）
 * - checksum：以 `sha256:HEX` 格式回填
 */
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

/**
 * 匯入決策（UI 用）
 * - keep：保留本機
 * - overwrite：以匯入資料覆蓋本機
 * - skip：跳過此筆
 */
export type ImportDecision = "keep" | "overwrite" | "skip";

/**
 * 匯入差異描述
 * - status:
 *   - add：本機沒有，將新增
 *   - update：本機有且匯入較新，預設可覆蓋
 *   - same：本機有且不較新，預設跳過
 */
export type ImportDiff = {
  name: string;
  incoming: Preset;
  status: "add" | "update" | "same";
  decision?: ImportDecision; // UI 可逐筆覆寫
};

export type ImportPlanDetailed = {
  diffs: ImportDiff[]; // 全列表（含 same）
  summary: { add: number; update: number; same: number };
};

/**
 * 資料搬運紀錄（TransferLog）
 * - type：export / import
 * - at：ISO 時間
 * - count：此次處理的筆數（對 export 為 items.length；對 import 為實際套用數）
 * - source：行為來源（share / download / paste）
 */
export type TransferLog = {
  id: string;
  type: "export" | "import";
  at: string; // ISO
  count: number;
  filename?: string;
  source?: "share" | "download" | "paste";
  deviceUA?: string;
  notes?: string;
};