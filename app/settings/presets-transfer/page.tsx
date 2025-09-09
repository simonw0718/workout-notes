// app/settings/presets-transfer/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { ExportBundleV1, Preset } from "@/lib/models/presets";
import { listAllExercises } from "@/lib/db";
import {
  tryShareFile,
  triggerDownload,
  parseAndValidate,
  planImportByName,
  applyImportByName,
} from "@/lib/export/presets";

// --- helpers ---
function toPreset(e: any, nowISO: string): Preset {
  return {
    uuid: String(e.id ?? e.uuid ?? e.name),
    name: e.name,
    unit: e.defaultUnit === "lb" ? "lb" : "kg",
    default_weight: typeof e.defaultWeight === "number" ? e.defaultWeight : undefined,
    default_reps: typeof e.defaultReps === "number" ? e.defaultReps : undefined,
    muscles: undefined,
    notes: undefined,
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function PresetsTransferPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // A. 直接讀 DB 的清單（真相來源）
  const [localEx, setLocalEx] = useState<any[] | null>(null);

  // B. 匯出預覽（由 A 組成）
  const [pendingExport, setPendingExport] = useState<{ bundle: ExportBundleV1; blob: Blob; filename: string } | null>(null);

  // C. 匯入預覽
  const [importPlan, setImportPlan] = useState<{ add: number; update: number; skip: number } | null>(null);
  const [lastBundle, setLastBundle] = useState<ExportBundleV1 | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const exs = await listAllExercises();
        setLocalEx(exs);
        console.debug("[transfer] DB exercises =", exs.length, exs);
      } catch (err) {
        console.warn("[transfer] listAllExercises failed", err);
        setLocalEx([]);
      }
    })();
  }, []);

  // ---- Export: 預覽 → 確認 ----
  async function onPrepareExport() {
    try {
      setBusy(true);
      setMsg("");
      const now = new Date().toISOString();
      const items: Preset[] = (localEx ?? []).map(e => toPreset(e, now));
      const base: Omit<ExportBundleV1, "checksum"> = {
        app: "WorkoutNotes",
        kind: "presets",
        version: 1,
        exportedAt: now,
        device: { ua: typeof navigator !== "undefined" ? navigator.userAgent : "unknown" },
        items,
      };
      const hex = await sha256Hex(JSON.stringify(base));
      const bundle: ExportBundleV1 = { ...base, checksum: `sha256:${hex}` };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const filename = `workoutnotes-presets-${now.slice(0, 10)}.wkn.json`;
      setPendingExport({ bundle, blob, filename });
      setMsg(`已產生匯出預覽：${items.length} 筆。`);
    } catch (e: any) {
      setMsg(`匯出預覽失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmExport() {
    if (!pendingExport) return;
    try {
      setBusy(true);
      const { blob, filename, bundle } = pendingExport;
      const shared = await tryShareFile(blob, filename);
      if (shared) setMsg(`已透過分享送出，共 ${bundle.items.length} 筆。`);
      else {
        await triggerDownload(blob, filename);
        setMsg(`已下載檔案，共 ${bundle.items.length} 筆。`);
      }
      setPendingExport(null);
    } catch (e: any) {
      setMsg(`匯出失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  // ---- Import: 選檔/貼上 → 預覽 → 套用 ----
  async function handleImport(text: string) {
    try {
      setBusy(true);
      setMsg("驗證中…");
      const bundle = await parseAndValidate(text);
      setLastBundle(bundle);
      const p = await planImportByName(bundle.items);
      setImportPlan({ add: p.add.length, update: p.update.length, skip: p.skip.length });
      setMsg("預覽完成，確認後執行匯入。");
    } catch (e: any) {
      setImportPlan(null);
      setLastBundle(null);
      setMsg(`匯入檢查失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onApplyImport() {
    if (!lastBundle) return;
    try {
      setBusy(true);
      setMsg("寫入中…");
      const p = await planImportByName(lastBundle.items);
      await applyImportByName(p);
      setMsg(`完成：新增 ${p.add.length}、更新 ${p.update.length}、跳過 ${p.skip.length}`);
      setImportPlan(null);
      setLastBundle(null);
      // 重新讀 DB，讓上面的本機清單同步
      const exs = await listAllExercises();
      setLocalEx(exs);
    } catch (e: any) {
      setMsg(`寫入失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="sticky top-0 -mx-4 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <Link href="/settings" className="text-sm">← 返回設定</Link>
          <div className="text-sm text-gray-500">Presets 匯出／匯入（進階）</div>
        </div>
      </div>

      {/* A. 本機動作（直接讀 DB） */}
      <section className="rounded-2xl border p-4 space-y-2">
        <h2 className="text-lg font-medium">本機動作（直接讀取 DB）</h2>
        <div className="text-sm">筆數：<b>{localEx ? localEx.length : "…"}</b></div>
        {localEx && (
          <ul className="text-sm list-disc pl-5 max-h-40 overflow-y-auto">
            {localEx.map((e: any) => (
              <li key={String(e.id)}>
                {e.name}（{e.defaultWeight ?? "-"} {e.defaultUnit ?? "kg"} × {e.defaultReps ?? "-"}）
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* B. 匯出（預覽 → 確認） */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-lg font-medium">匯出 presets</h2>
        {!pendingExport ? (
          <button
            onClick={onPrepareExport}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
          >
            產生匯出預覽
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">預覽：共 <b>{pendingExport.bundle.items.length}</b> 筆</div>
            <ul className="text-sm list-disc pl-5 max-h-40 overflow-y-auto">
              {pendingExport.bundle.items.map((p) => (
                <li key={p.uuid}>
                  {p.name}（{p.default_weight ?? "-"} {p.unit} × {p.default_reps ?? "-"}）
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={onConfirmExport}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-green-700 text-white disabled:opacity-50"
              >
                確認匯出
              </button>
              <button
                onClick={() => setPendingExport(null)}
                disabled={busy}
                className="px-4 py-2 rounded-xl border disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      {/* C. 匯入（選檔/貼上 → 預覽 → 套用） */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-lg font-medium">匯入 presets</h2>

        <div className="flex items-start gap-3">
          <label className="px-3 py-2 rounded-xl border cursor-pointer select-none">
            選擇檔案
            <input
              type="file"
              accept="application/json,.json,.wkn.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const txt = await f.text();
                  await handleImport(txt);
                  e.currentTarget.value = "";
                }
              }}
            />
          </label>

          <PasteBox onPaste={handleImport} disabled={busy} />
        </div>

        {importPlan && (
          <div className="text-sm text-gray-800">
            將新增 <b>{importPlan.add}</b>、更新 <b>{importPlan.update}</b>、跳過 <b>{importPlan.skip}</b>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onApplyImport}
            disabled={busy || !importPlan}
            className="px-4 py-2 rounded-xl bg-green-700 text-white disabled:opacity-50"
          >
            執行匯入
          </button>
          <button
            onClick={() => { setImportPlan(null); setLastBundle(null); setMsg(""); }}
            disabled={busy || !importPlan}
            className="px-4 py-2 rounded-xl border disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </section>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </main>
  );
}

function PasteBox({
  onPaste,
  disabled,
}: {
  onPaste: (text: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const canImport = value.trim().length > 0 && !disabled;

  return (
    <div className="flex-1">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="或直接貼上 JSON 內容"
        className="w-full h-24 p-2 border rounded-lg"
        disabled={disabled}
      />
      <div className="mt-2">
        <button
          onClick={() => onPaste(value)}
          disabled={!canImport}
          className="px-3 py-2 rounded-xl border disabled:opacity-50"
        >
          預覽匯入
        </button>
      </div>
    </div>
  );
}