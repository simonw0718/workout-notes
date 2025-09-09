// app/diagnostics/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getDB, startSession, addSet, listSetsBySessionAndExercise } from "@/lib/db";

type Coverage = { url: string; inCache: boolean };

export default function Diagnostics() {
  const [cacheNames, setCacheNames] = useState<string[]>([]);
  const [selectedCache, setSelectedCache] = useState<string>("");
  const [cacheEntries, setCacheEntries] = useState<string[]>([]);
  const [precacheList, setPrecacheList] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [idbMsg, setIdbMsg] = useState<string>("");
  const [idbOk, setIdbOk] = useState<boolean | null>(null);

  const short = (u: string) => {
    try { return new URL(u, location.origin).pathname || "/"; } catch { return u; }
  };

  const autoPick = useMemo(() => {
    const pref = cacheNames.filter((n) => n.startsWith("workout-shell-"));
    if (pref.length) return pref.sort().slice(-1)[0];
    return cacheNames[0] ?? "";
  }, [cacheNames]);

  useEffect(() => { (async () => setCacheNames(await caches.keys()))(); }, []);
  useEffect(() => { if (!selectedCache && autoPick) setSelectedCache(autoPick); }, [autoPick, selectedCache]);

  async function refreshCacheEntries() {
    if (!selectedCache) return;
    setBusy(true);
    try {
      const c = await caches.open(selectedCache);
      const reqs = await c.keys();
      setCacheEntries(reqs.map((r) => { try { return new URL(r.url).pathname || "/"; } catch { return r.url; } }));
      setMsg(`已載入 ${selectedCache} 內的 ${reqs.length} 個條目`);
    } finally { setBusy(false); }
  }

  async function loadPrecacheList() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/precache-assets.json", { cache: "no-cache" });
      if (!res.ok) { setMsg(`[錯誤] 讀取 precache-assets.json 失敗：${res.status}`); setPrecacheList([]); return; }
      const json = await res.json();
      const arr: string[] = Array.isArray(json) ? json : (Array.isArray(json.assets) ? json.assets : []);
      const origin = location.origin;
      setPrecacheList(arr.map((p) => (p.startsWith("http") ? p : origin + p)));
      setMsg(`已讀取 precache 清單，共 ${arr.length} 筆`);
    } catch { setMsg("[錯誤] 讀取 precache-assets.json 發生例外"); setPrecacheList([]); }
    finally { setBusy(false); }
  }

  async function comparePrecacheCoverage() {
    if (!selectedCache) return;
    setBusy(true); setMsg(null);
    try {
      if (!cacheEntries.length) await refreshCacheEntries();
      if (!precacheList.length) await loadPrecacheList();
      const c = await caches.open(selectedCache);
      const results: Coverage[] = [];
      for (const u of precacheList) {
        const req = new Request(u, { cache: "no-cache" });
        const hit = await c.match(req);
        results.push({ url: u, inCache: !!hit });
      }
      setCoverage(results);
      const hitCount = results.filter((r) => r.inCache).length;
      setMsg(`對比完成：${hitCount}/${results.length} 已在 cache`);
    } finally { setBusy(false); }
  }

  async function clearAll() {
    if (!confirm("清除所有 Service Worker 與 Cache？")) return;
    setBusy(true);
    try {
      const ks = await caches.keys();
      await Promise.all(ks.map((k) => caches.delete(k)));
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      setCacheNames([]); setSelectedCache(""); setCacheEntries([]);
      setPrecacheList([]); setCoverage([]); setMsg("已清除所有 SW 與 Cache，請關掉 App 重開。");
    } finally { setBusy(false); }
  }

  async function idbSmoke() {
    setIdbMsg("測試中…"); setIdbOk(null);
    try {
      await getDB();
      const s = await startSession();
      const exerciseId = "diag-" + Math.random().toString(36).slice(2, 8);
      await addSet({ sessionId: s.id, exerciseId, weight: 1, reps: 1, unit: "kg", rpe: null });
      const list = await listSetsBySessionAndExercise(s.id, exerciseId);
      if (Array.isArray(list) && list.length > 0) {
        setIdbOk(true);
        setIdbMsg(`OK：可寫入/讀取（sessionId=${s.id.slice(0,8)}…, exerciseId=${exerciseId}，共 ${list.length} 筆）`);
      } else {
        setIdbOk(false);
        setIdbMsg("讀回 0 筆，疑似寫入失敗（請截 Console）");
      }
    } catch (e) {
      setIdbOk(false);
      setIdbMsg("失敗：" + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <main className="p-4 space-y-6 max-w-screen-md mx-auto">
      {/* ✅ 新增：頂部返回列 */}
      <div className="sticky top-0 -mx-4 md:-mx-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <Link href="/" className="text-sm">← 回首頁</Link>
          <span className="text-xs text-gray-500">online: {String(navigator.onLine)}</span>
        </div>
      </div>

      <h1 className="text-2xl font-semibold">Diagnostics</h1>

      {/* SW 狀態 */}
      <section className="rounded-xl border p-3 text-sm">
        <div className="mb-2">
          <b>SW 狀態：</b>
          <span className={navigator.serviceWorker?.controller ? "text-green-600" : "text-red-600"}>
            {navigator.serviceWorker?.controller ? "controlled" : "not controlled"}
          </span>
          <span className="ml-2 text-gray-500">· online: {String(navigator.onLine)}</span>
        </div>
        <button
          className="rounded border px-3 py-1"
          onClick={async () => {
            const regs = await navigator.serviceWorker.getRegistrations();
            console.log(regs);
            alert(`registrations: ${regs.length}`);
          }}
        >
          重新整理
        </button>
      </section>

      {/* Cache 控制列 */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="border rounded px-2 py-2" value={selectedCache} onChange={(e) => setSelectedCache(e.target.value)}>
          <option value="">（選擇 Cache）</option>
          {cacheNames.map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>

        <button onClick={async () => { const ks = await caches.keys(); setCacheNames(ks); setMsg(`已刷新 cache 清單，共 ${ks.length} 個`); }} className="px-3 py-2 rounded border">
          刷新 Cache 清單
        </button>

        <button onClick={refreshCacheEntries} className="px-3 py-2 rounded border" disabled={!selectedCache || busy}>
          列出目前 Cache 內容
        </button>

        <button onClick={loadPrecacheList} className="px-3 py-2 rounded border bg-blue-600 text-white" disabled={busy}>
          列出 precache 條目
        </button>

        <button onClick={comparePrecacheCoverage} className="px-3 py-2 rounded border bg-amber-500 text-white" disabled={!selectedCache || busy}>
          對比：precache 是否都在 Cache
        </button>

        <button onClick={clearAll} className="px-3 py-2 rounded border bg-red-600 text-white" disabled={busy}>
          清除 SW 與所有 Cache
        </button>
      </div>

      {/* 一鍵導頁／硬刷新 */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => location.assign("/diagnostics")} className="px-3 py-2 rounded border">
          開 /diagnostics
        </button>
        <button onClick={() => location.assign("/start.html")} className="px-3 py-2 rounded border">
          回殼頁（start.html）
        </button>
        <button onClick={() => location.assign("/exercise")} className="px-3 py-2 rounded border">
          開 /exercise
        </button>
        <button onClick={() => location.assign("/history")} className="px-3 py-2 rounded border">
          開 /history
        </button>
        <button onClick={() => location.reload()} className="px-3 py-2 rounded border bg-gray-900 text-white">
          硬重新整理
        </button>
      </div>

      {msg && <div className="p-3 rounded bg-gray-100 text-sm">{busy ? "處理中… " : null}{msg}</div>}

      {/* 目前 Cache 條目 */}
      <section>
        <h2 className="text-lg font-medium mb-2">目前 Cache（{selectedCache || "未選擇"}）</h2>
        {cacheEntries.length === 0 ? <p className="text-sm text-gray-500">（尚無資料）</p> : (
          <ul className="list-disc pl-6 text-sm break-all">
            {cacheEntries.map((e, i) => (<li key={i}>{e}</li>))}
          </ul>
        )}
      </section>

      {/* Precache 清單 */}
      <section>
        <h2 className="text-lg font-medium mb-2">Precache 清單</h2>
        {precacheList.length === 0 ? <p className="text-sm text-gray-500">（尚無資料）</p> : (
          <ul className="list-disc pl-6 text-sm break-all">
            {precacheList.map((u, i) => (<li key={i}>{short(u)}</li>))}
          </ul>
        )}
      </section>

      {/* Coverage 對比 */}
      <section>
        <h2 className="text-lg font-medium mb-2">Coverage 對比（precache → cache）</h2>
        {coverage.length === 0 ? <p className="text-sm text-gray-500">（尚無資料）</p> : (
          <>
            <div className="text-sm mb-2">
              已在 Cache：{coverage.filter((c) => c.inCache).length} / {coverage.length}
            </div>
            <ul className="list-disc pl-6 text-sm break-all">
              {coverage.map((c, i) => (
                <li key={i} className={c.inCache ? "text-green-700" : "text-red-700"}>
                  {short(c.url)} {c.inCache ? "✓" : "✗"}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* IndexedDB 健檢 */}
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">IndexedDB 健檢</h2>
        <div className="text-sm text-gray-600">測：開庫 → 造一筆 dummy set → 讀回來。</div>
        <div className="flex gap-2">
          <button onClick={idbSmoke} className="px-4 py-2 rounded-xl border hover:bg-gray-50">執行健檢</button>
          <div className={`text-sm ${idbOk == null ? "" : idbOk ? "text-green-700" : "text-red-700"}`}>{idbMsg || "（尚未測試）"}</div>
        </div>
      </section>
    </main>
  );
}