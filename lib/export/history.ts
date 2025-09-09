// lib/export/history.ts
"use client";

import { ExportHistoryV1, ExportHistoryV1Schema, SessionExport, SetRecordExport } from "@/lib/models/history";
import {
  listAllSessions,
  listAllSets,
  bulkUpsertHistory,
  addTransferLog, // 若你暫時沒實作，可先移除此行與文內兩處 try/catch
} from "@/lib/db";

/** 遞迴排序鍵，確保序列化穩定（避免 checksum 受鍵序影響） */
function stableStringify(value: any): string {
  const sort = (v: any): any => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out: any = {};
      for (const k of Object.keys(v).sort()) out[k] = sort(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

/** 剔除易變欄位（dirty 等）不納入 checksum */
function stripVolatile<T extends Record<string, any>>(obj: T): T {
  const { dirty, ...rest } = obj as any;
  return rest as T;
}

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** 讀 DB → 組 bundle（不含 checksum） */
async function makeBaseBundle(): Promise<Omit<ExportHistoryV1, "checksum">> {
  const sessionsRaw = await listAllSessions();
  const setsRaw = await listAllSets();
  const sessions = sessionsRaw.map(stripVolatile) as unknown as SessionExport[];
  const sets = setsRaw.map(stripVolatile) as unknown as SetRecordExport[];
  return {
    app: "WorkoutNotes",
    kind: "history",
    version: 1,
    exportedAt: new Date().toISOString(),
    device: { ua: typeof navigator !== "undefined" ? navigator.userAgent : "unknown" },
    sessions,
    sets,
  };
}

export async function exportHistoryAsBlob(): Promise<{ blob: Blob; filename: string; bundle: ExportHistoryV1 }> {
  const base = await makeBaseBundle();
  const hex = await sha256Hex(stableStringify(base));         // ← 用穩定序列化算 checksum
  const bundle: ExportHistoryV1 = { ...base, checksum: `sha256:${hex}` };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });

  const filename = `history-${base.exportedAt.slice(0, 10)}.wkn.json`;  // ← 改成 history- 開頭

  try {
    await addTransferLog({
      type: "export",
      count: base.sessions.length + base.sets.length,
      filename,
      deviceUA: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      notes: "history bundle generated",
    });
  } catch {}

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

/** 解析 + checksum 驗證（同樣使用穩定序列化；並剔除易變欄位後再驗證） */
export async function parseAndValidateHistory(text: string): Promise<ExportHistoryV1> {
  const raw = JSON.parse(text);
  const { checksum, ...without } = raw ?? {};

  const cleaned = {
    ...without,
    sessions: (without.sessions ?? []).map(stripVolatile),
    sets: (without.sets ?? []).map(stripVolatile),
  };

  const parsedNoCk = ExportHistoryV1Schema.omit({ checksum: true }).parse(cleaned);
  const expected = await sha256Hex(stableStringify(parsedNoCk));
  const norm = (checksum as string) ?? "";
  const match = norm === expected || norm === `sha256:${expected}`;
  if (!match) throw new Error("Checksum mismatch");
  return ExportHistoryV1Schema.parse({ ...parsedNoCk, checksum: `sha256:${expected}` });
}

/** 匯入（預設不覆蓋同 id；可選覆蓋） */
export async function applyImportHistory(opts: {
  bundle: ExportHistoryV1;
  overwriteExisting?: boolean; // 預設 false
}) {
  const overwrite = !!opts.overwriteExisting;
  const sessions = opts.bundle.sessions as SessionExport[];
  const sets = opts.bundle.sets as SetRecordExport[];

  const applied = await bulkUpsertHistory({ sessions, sets }, overwrite);

  try {
    await addTransferLog({
      type: "import",
      count: applied,
      source: "paste",
      deviceUA: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      notes: overwrite ? "history import (overwrite=true)" : "history import (overwrite=false)",
    });
  } catch {}

  return applied;
}