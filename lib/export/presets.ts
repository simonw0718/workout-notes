"use client";

// lib/export/presets.ts
// 說明：這份檔案只在瀏覽器端使用（含 navigator / IndexedDB），故明確加上 "use client"

import { ExportBundleV1Schema, Preset, ExportBundleV1 } from "../models/presets";
// 直接用你設定頁正在用的資料源（同一套 listAllExercises / create / update）
import { listAllExercises, createExercise, updateExercise } from "../db";

// --- utils ---
async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 讀「目前裝置上的動作清單」→ 轉成 Preset 陣列
async function readPresetsFromExercises(): Promise<Preset[]> {
  const exs = await listAllExercises();

  // 可視化除錯
  try {
    console.debug("[export] exercises count =", exs.length, exs.slice(0, 3));
  } catch {}

  const now = new Date().toISOString();
  const presets: Preset[] = exs.map((x: any) => ({
    uuid: String(x.id ?? x.uuid ?? x.name), // 沒 id 就用 name 撐著（理論上有 id）
    name: x.name,
    unit: x.defaultUnit === "lb" ? "lb" : "kg",
    default_weight: typeof x.defaultWeight === "number" ? x.defaultWeight : undefined,
    default_reps: typeof x.defaultReps === "number" ? x.defaultReps : undefined,
    muscles: undefined,
    notes: undefined,
    createdAt: now,
    updatedAt: now,
  }));

  try {
    console.debug("[export] presets to export =", presets.length, presets.slice(0, 3));
  } catch {}

  return presets;
}

// --- Export ---
export async function makeBundleWithChecksum(
  body: Omit<ExportBundleV1, "checksum">
): Promise<ExportBundleV1> {
  const hex = await sha256Hex(JSON.stringify(body));
  return { ...body, checksum: `sha256:${hex}` };
}

export async function exportPresetsAsBlob(): Promise<{ blob: Blob; filename: string; bundle: ExportBundleV1 }> {
  const items: Preset[] = await readPresetsFromExercises();

  const base: Omit<ExportBundleV1, "checksum"> = {
    app: "WorkoutNotes",
    kind: "presets",
    version: 1,
    exportedAt: new Date().toISOString(),
    device: { ua: typeof navigator !== "undefined" ? navigator.userAgent : "unknown" },
    items,
  };

  // 若真的為空，直接在 Console 明示
  if (!items || items.length === 0) {
    try {
      console.warn("[export] items is EMPTY. Check listAllExercises() / DB content.");
    } catch {}
  }

  const bundle = await makeBundleWithChecksum(base);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const filename = `workoutnotes-presets-${new Date().toISOString().slice(0, 10)}.wkn.json`;

  return { blob, filename, bundle };
}

export async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function tryShareFile(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "application/json" });
  const nav: any = navigator;
  if (typeof nav?.canShare === "function" && nav.canShare({ files: [file] })) {
    if (typeof nav?.share === "function") {
      await nav.share({ files: [file] });
      return true;
    }
  }
  return false;
}

// --- Import（以名稱 name 為鍵） ---

export async function parseAndValidate(text: string): Promise<ExportBundleV1> {
  const raw = JSON.parse(text);
  const { checksum, ...withoutChecksum } = raw;
  const parsedNoCk = ExportBundleV1Schema.omit({ checksum: true }).parse(withoutChecksum);
  const expected = await sha256Hex(JSON.stringify(parsedNoCk));
  const norm = (checksum as string) ?? "";
  const match = norm === expected || norm === `sha256:${expected}`;
  if (!match) throw new Error("Checksum mismatch");
  return ExportBundleV1Schema.parse({ ...parsedNoCk, checksum: `sha256:${expected}` });
}

export type ImportPlanByName = {
  add: Preset[];
  update: Preset[];
  skip: Preset[];
};

export async function planImportByName(incoming: Preset[]): Promise<ImportPlanByName> {
  const existing = await listAllExercises();
  const byName = new Map(existing.map((e: any) => [e.name, e]));

  const plan: ImportPlanByName = { add: [], update: [], skip: [] };
  for (const p of incoming) {
    const cur = byName.get(p.name);
    if (!cur) {
      plan.add.push(p);
      continue;
    }
    const curUpdated = cur.updatedAt ? new Date(cur.updatedAt).getTime() : 0;
    const incomingUpdated = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
    if (incomingUpdated > curUpdated) plan.update.push(p);
    else plan.skip.push(p);
  }

  try {
    console.debug("[import/plan] add=%d update=%d skip=%d", plan.add.length, plan.update.length, plan.skip.length);
  } catch {}
  return plan;
}

export async function applyImportByName(plan: ImportPlanByName) {
  const existing = await listAllExercises();
  const byName = new Map(existing.map((e: any) => [e.name, e]));

  for (const p of plan.add) {
    await createExercise({
      name: p.name,
      defaultWeight: p.default_weight,
      defaultReps: p.default_reps,
      defaultUnit: p.unit === "lb" ? "lb" : "kg",
      isFavorite: false,
    });
  }

  for (const p of plan.update) {
    const cur = byName.get(p.name);
    if (!cur) continue;
    await updateExercise({
      id: cur.id,
      defaultWeight: p.default_weight,
      defaultReps: p.default_reps,
      defaultUnit: p.unit === "lb" ? "lb" : (cur.defaultUnit ?? "kg"),
    });
  }
}