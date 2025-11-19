// app/sync/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addTransferLog,
  listTransferLogs,
  clearTransferLogs,
  listAllExercises,
} from "@/lib/db";
import type {
  ExportBundleV1,
  Preset,
  ImportPlanDetailed,
  ImportDecision,
} from "@/lib/models/presets";
import {
  tryShareFile as trySharePresets,
  triggerDownload as downloadPresets,
  parseAndValidate as parsePresetsBundle,
  exportPresetsAsBlob,
  buildImportDiffsByName,
  applyImportWithDecisions,
} from "@/lib/export/presets";
import {
  exportHistoryAsBlob,
  tryShareFile as tryShareHistory,
  triggerDownload as downloadHistory,
  parseAndValidateHistory,
  applyImportHistory,
} from "@/lib/export/history";

/**
 * 資料搬運中心：
 * - 完全基於 IndexedDB + File / Web Share API
 * - 不呼叫任何遠端 API，因此在離線模式下依然可用
 * - 如果你未來真的要做雲端同步，可以另外開新頁，不用改這裡
 */

export default function SyncPage() {
  return (
    <main className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">資料搬運中心</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/diagnostics"
            className="hidden sm:inline-block rounded-xl px-3 py-2 text-sm bg-red-600 text-white hover:bg-red-700"
          >
            🚨 偵錯
          </Link>
          <Link
            href="/"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            回首頁
          </Link>
        </div>
      </header>

      {/* 📦 Presets 卡片 */}
      <PresetsCard />

      {/* 🕘 History 卡片 */}
      <HistoryCard />

      {/* 📜 Transfer Logs */}
      <LogsCard />
    </main>
  );
}

/* ----------------------------- Presets ----------------------------- */

function PresetsCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // A. 直接讀 DB 的清單（僅顯示用）
  const [localEx, setLocalEx] = useState<any[] | null>(null);

  // B. 匯出預覽
  const [pendingExport, setPendingExport] = useState<{
    bundle: ExportBundleV1;
    blob: Blob;
    filename: string;
  } | null>(null);

  // C. 匯入預覽（含 diff 與策略）
  const [planDetail, setPlanDetail] = useState<ImportPlanDetailed | null>(null);
  const [lastBundle, setLastBundle] = useState<ExportBundleV1 | null>(null);
  const [defaultAdd, setDefaultAdd] = useState<ImportDecision>("overwrite");
  const [defaultUpdate, setDefaultUpdate] =
    useState<ImportDecision>("overwrite");
  const [defaultSame, setDefaultSame] = useState<ImportDecision>("skip");
  const [overrides, setOverrides] = useState<Record<string, ImportDecision>>(
    {}
  );

  useEffect(() => {
    (async () => {
      try {
        const exs = await listAllExercises();
        setLocalEx(exs);
      } catch {
        setLocalEx([]);
      }
    })();
  }, []);

  async function onPrepareExport() {
    try {
      setBusy(true);
      setMsg("");
      const { bundle, blob, filename } = await exportPresetsAsBlob();
      setPendingExport({ bundle, blob, filename });
      setMsg(`已產生匯出預覽：${bundle.items.length} 筆。`);
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
      const shared = await trySharePresets(blob, filename);
      if (!shared) await downloadPresets(blob, filename);
      // 補記 log 的 source
      try {
        await addTransferLog({
          type: "export",
          count: bundle.items.length,
          filename,
          source: shared ? "share" : "download",
          deviceUA:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          notes: "presets export confirmed",
        });
      } catch {}
      setMsg(`已${shared ? "分享" : "下載"}：${bundle.items.length} 筆。`);
      setPendingExport(null);
    } catch (e: any) {
      setMsg(`匯出失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(text: string) {
    try {
      setBusy(true);
      setMsg("驗證中…");
      const bundle = await parsePresetsBundle(text);
      setLastBundle(bundle);

      const p = await buildImportDiffsByName(bundle.items);
      setPlanDetail(p);
      setOverrides({});
      setMsg(
        `預覽完成：新增 ${p.summary.add}、更新 ${p.summary.update}、相同 ${p.summary.same}`
      );
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
      try {
        await addTransferLog({
          type: "import",
          count: planDetail.diffs.length,
          source: "paste",
          deviceUA:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          notes: "presets import applied",
        });
      } catch {}
    } catch (e: any) {
      setMsg(`寫入失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <h2 className="text-lg font-bold">Presets 匯出／匯入</h2>

      {/* A. 本機動作清單（顯示） */}
      <div className="text-sm">
        <div>
          本機動作筆數：<b>{localEx ? localEx.length : "…"}</b>
        </div>
        {localEx && localEx.length > 0 && (
          <ul className="mt-1 text-sm list-disc pl-5 max-h-32 overflow-y-auto">
            {localEx.map((e: any) => (
              <li key={String(e.id)}>
                {e.name}（{e.defaultWeight ?? "-"} {e.defaultUnit ?? "kg"} ×{" "}
                {e.defaultReps ?? "-"}）
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* B. 匯出 */}
      <div className="space-y-2">
        <div className="font-medium">匯出</div>
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
            <div className="text-sm">
              預覽：共 <b>{pendingExport.bundle.items.length}</b> 筆
            </div>
            <ul className="text-sm list-disc pl-5 max-h-40 overflow-y-auto">
              {pendingExport.bundle.items.map((p: Preset) => (
                <li key={p.uuid}>
                  {p.name}（{p.default_weight ?? "-"} {p.unit} ×{" "}
                  {p.default_reps ?? "-"}）
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
      </div>

      {/* C. 匯入 */}
      <div className="space-y-3">
        <div className="font-medium">匯入</div>
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

        {planDetail && (
          <div className="space-y-3">
            <div className="text-sm text-gray-800">
              預覽結果：新增 <b>{planDetail.summary.add}</b>、更新{" "}
              <b>{planDetail.summary.update}</b>、相同{" "}
              <b>{planDetail.summary.same}</b>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <StrategySelect
                label="新增"
                value={defaultAdd}
                onChange={setDefaultAdd}
              />
              <StrategySelect
                label="更新"
                value={defaultUpdate}
                onChange={setDefaultUpdate}
              />
              <StrategySelect
                label="相同"
                value={defaultSame}
                onChange={setDefaultSame}
              />
            </div>
            <div className="text-sm mt-2">逐筆調整</div>
            <ul className="max-h-48 overflow-y-auto text-sm border rounded-lg">
              {planDetail.diffs.map((d) => {
                const k = d.name;
                const v = overrides[k] ?? "";
                return (
                  <li
                    key={k}
                    className="flex items-center justify-between px-3 py-2 border-b last:border-b-0"
                  >
                    <div>
                      <b>{d.name}</b>{" "}
                      <span className="text-gray-500">[{d.status}]</span>
                    </div>
                    <select
                      className="border rounded-lg px-2 py-1"
                      value={v}
                      onChange={(e) => {
                        const val = (e.target.value || "") as
                          | ImportDecision
                          | "";
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
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </section>
  );
}

/* ----------------------------- History ----------------------------- */

function HistoryCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [pendingExport, setPendingExport] = useState<{
    filename: string;
    blob: Blob;
    sessionsCount: number;
    setsCount: number;
  } | null>(null);

  // 匯入控制
  const [importText, setImportText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const canImport = useMemo(
    () => importText.trim().length > 0 && !busy,
    [importText, busy]
  );

  async function onPrepareExport() {
    try {
      setBusy(true);
      setMsg("");
      const { blob, filename, bundle } = await exportHistoryAsBlob();
      setPendingExport({
        filename,
        blob,
        sessionsCount: bundle.sessions.length,
        setsCount: bundle.sets.length,
      });
      setMsg(
        `已產生匯出預覽：sessions ${bundle.sessions.length}、sets ${bundle.sets.length}`
      );
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
      const { blob, filename } = pendingExport;
      const shared = await tryShareHistory(blob, filename);
      if (!shared) await downloadHistory(blob, filename);
      setMsg(`已${shared ? "分享" : "下載"}：${filename}`);
      setPendingExport(null);
    } catch (e: any) {
      setMsg(`匯出失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(file: File) {
    const txt = await file.text();
    setImportText(txt);
  }

  async function onPreviewImport() {
    try {
      setBusy(true);
      setMsg("驗證中…");
      await parseAndValidateHistory(importText);
      setMsg("驗證通過，可執行匯入。");
    } catch (e: any) {
      setMsg(`驗證失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onApplyImport() {
    try {
      setBusy(true);
      setMsg("匯入中…");
      const bundle = await parseAndValidateHistory(importText);
      const applied = await applyImportHistory({
        bundle,
        overwriteExisting: overwrite,
      });
      setMsg(`完成：已寫入 ${applied} 筆。`);
      try {
        await addTransferLog({
          type: "import",
          count: applied,
          source: "paste",
          deviceUA:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          notes: overwrite
            ? "history import (overwrite=true)"
            : "history import (overwrite=false)",
        });
      } catch {}
      setImportText("");
    } catch (e: any) {
      setMsg(`匯入失敗：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <h2 className="text-lg font-bold">History 備份／還原</h2>

      {/* 匯出 */}
      <div className="space-y-2">
        <div className="font-medium">匯出</div>
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
            <div className="text-sm">
              預覽：<b>{pendingExport.filename}</b>
              <br />
              sessions：{pendingExport.sessionsCount}，sets：
              {pendingExport.setsCount}
            </div>
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
      </div>

      {/* 匯入 */}
      <div className="space-y-3">
        <div className="font-medium">匯入</div>
        <div className="flex items-start gap-3">
          <label className="px-3 py-2 rounded-xl border cursor-pointer select-none">
            選擇檔案
            <input
              type="file"
              accept="application/json,.json,.wkn.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await onPickFile(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <div className="flex-1">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="或直接貼上 history JSON"
              className="w-full h-24 p-2 border rounded-lg"
              disabled={busy}
            />
            <div className="mt-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-black"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  disabled={busy}
                />
                匯入時覆蓋同 id 資料
              </label>
              <button
                onClick={onPreviewImport}
                disabled={!canImport}
                className="px-3 py-2 rounded-xl border text-sm disabled:opacity-50"
              >
                預覽驗證
              </button>
              <button
                onClick={onApplyImport}
                disabled={!canImport}
                className="px-3 py-2 rounded-xl bg-green-700 text-white text-sm disabled:opacity-50"
              >
                執行匯入
              </button>
            </div>
          </div>
        </div>
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </section>
  );
}

/* ------------------------------ Logs ------------------------------- */

function LogsCard() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLogs(await listTransferLogs(50));
    })();
  }, []);

  const reloadLogs = async () => {
    setLogs(await listTransferLogs(50));
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">資料搬運紀錄</h2>
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            await clearTransferLogs();
            setLogs([]);
          }}
          className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50"
        >
          清除紀錄
        </button>
        <button
          onClick={reloadLogs}
          className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50"
        >
          重新整理
        </button>
      </div>
      <ul className="text-sm border rounded-xl divide-y max-h-64 overflow-y-auto">
        {logs.map((l) => (
          <li
            key={l.id}
            className="px-3 py-2 flex items-center justify-between"
          >
            <div>
              <div className="font-medium">
                {l.type} · {l.count} 筆
              </div>
              <div className="text-gray-500">
                {new Date(l.at).toLocaleString()}
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              {l.filename ?? "-"}
              <br />
              {l.source ?? "-"}
            </div>
          </li>
        ))}
        {logs.length === 0 && (
          <li className="px-3 py-2 text-gray-500">目前沒有紀錄</li>
        )}
      </ul>
    </section>
  );
}

/* --------------------------- Reusable UI --------------------------- */

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