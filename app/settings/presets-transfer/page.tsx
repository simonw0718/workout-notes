"use client";
//presets-transfer/page.tsx
import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { ExportBundleV1, Preset, ImportPlanDetailed, ImportDecision } from "@/lib/models/presets";
import { listAllExercises, addTransferLog } from "@/lib/db";
import {
  tryShareFile,
  triggerDownload,
  parseAndValidate,
  exportPresetsAsBlob,
  buildImportDiffsByName,
  applyImportWithDecisions,
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

export default function PresetsTransferPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // A. 直接讀 DB 的清單
  const [localEx, setLocalEx] = useState<any[] | null>(null);

  // B. 匯出預覽
  const [pendingExport, setPendingExport] = useState<{ bundle: ExportBundleV1; blob: Blob; filename: string } | null>(null);

  // C. 匯入預覽（新版：含 diff 與策略）
  const [planDetail, setPlanDetail] = useState<ImportPlanDetailed | null>(null);
  const [lastBundle, setLastBundle] = useState<ExportBundleV1 | null>(null);
  const [defaultAdd, setDefaultAdd] = useState<ImportDecision>("overwrite");
  const [defaultUpdate, setDefaultUpdate] = useState<ImportDecision>("overwrite");
  const [defaultSame, setDefaultSame] = useState<ImportDecision>("skip");
  const [overrides, setOverrides] = useState<Record<string, ImportDecision>>({});

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
      const items: Preset[] = (localEx ?? []).map((e) => toPreset(e, now));
      const { bundle, blob, filename } = await exportPresetsAsBlob();
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
      try {
        await addTransferLog({
          type: "export",
          count: bundle.items.length,
          filename,
          source: shared ? "share" : "download",
          deviceUA: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          notes: "user action confirmed",
        });
      } catch {}
      setPendingExport(null);
    } catch (e: any) {
      setMsg(`匯出失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  // ---- Import: 選檔/貼上 → 預覽(diff) → 策略 → 套用 ----
  async function handleImport(text: string) {
    try {
      setBusy(true);
      setMsg("驗證中…");
      const bundle = await parseAndValidate(text);
      setLastBundle(bundle);

      const p = await buildImportDiffsByName(bundle.items);
      setPlanDetail(p);
      setOverrides({});
      setMsg(`預覽完成：新增 ${p.summary.add}、更新 ${p.summary.update}、相同 ${p.summary.same}`);
    } catch (e: any) {
      setPlanDetail(null);
      setLastBundle(null);
      setMsg(`匯入檢查失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onApplyImport() {
    if (!lastBundle || !planDetail) return;
    try {
      setBusy(true);
      setMsg("寫入中…");
      await applyImportWithDecisions({
        plan: planDetail,
        defaultDecisionForAdd: defaultAdd,
        defaultDecisionForUpdate: defaultUpdate,
        defaultDecisionForSame: defaultSame,
        perItem: overrides,
      });
      setMsg(`完成：已套用所選決策。`);
      setPlanDetail(null);
      setLastBundle(null);
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
            className="px-4 py-2 rounded-xl bg-black text-white border border-white disabled:opacity-50"
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

      {/* C. 匯入（選檔/貼上 → 預覽 → 策略 → 套用） */}
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

        {/* 策略 + 逐筆覆寫 */}
        {planDetail && (
          <div className="space-y-3">
            <div className="text-sm text-gray-800">
              預覽結果：新增 <b>{planDetail.summary.add}</b>、更新 <b>{planDetail.summary.update}</b>、相同 <b>{planDetail.summary.same}</b>
            </div>

            <div className="text-sm font-medium">批次策略</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <StrategySelect label="新增" value={defaultAdd} onChange={setDefaultAdd} />
              <StrategySelect label="更新" value={defaultUpdate} onChange={setDefaultUpdate} />
              <StrategySelect label="相同" value={defaultSame} onChange={setDefaultSame} />
            </div>

            <div className="text-sm mt-2">逐筆調整</div>
            <ul className="max-h-48 overflow-y-auto text-sm border rounded-lg">
              {planDetail.diffs.map((d) => {
                const k = d.name;
                const v = overrides[k] ?? "";
                return (
                  <li key={k} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                    <div>
                      <b>{d.name}</b>{" "}
                      <span className="text-gray-500">[{d.status}]</span>
                    </div>
                    <select
                      className="border rounded-lg px-2 py-1"
                      value={v}
                      onChange={(e) => {
                        const val = (e.target.value || "") as ImportDecision | "";
                        setOverrides((prev) => {
                          const next = { ...prev };
                          if (!val) delete next[k];
                          else next[k] = val;
                          return next;
                        });
                      }}
                    >
                      <option value="">（跟隨批次）</option>
                      <option value="keep">保留本機</option>
                      <option value="overwrite">匯入覆蓋</option>
                      <option value="skip">跳過</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onApplyImport}
            disabled={busy || !planDetail}
            className="px-4 py-2 rounded-xl bg-green-700 text-white disabled:opacity-50"
          >
            執行匯入
          </button>
          <button
            onClick={() => {
              setPlanDetail(null);
              setLastBundle(null);
              setMsg("");
              setOverrides({});
            }}
            disabled={busy || !planDetail}
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

function StrategySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ImportDecision;
  onChange: (v: ImportDecision) => void;
}) {
  return (
    <label className="flex items-center justify-between border rounded-lg px-3 py-2">
      <span className="text-gray-700">{label}</span>
      <select
        className="border rounded-lg px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value as ImportDecision)}
      >
        <option value="keep">保留本機</option>
        <option value="overwrite">匯入覆蓋</option>
        <option value="skip">跳過</option>
      </select>
    </label>
  );
}