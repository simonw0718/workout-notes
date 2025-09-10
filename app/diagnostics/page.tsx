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

  const [online, setOnline] = useState<boolean | null>(null);
  const [swControlled, setSwControlled] = useState<boolean | null>(null);

  const short = (u: string) => {
    try { return new URL(u, typeof window !== "undefined" ? window.location.origin : "http://x").pathname || "/"; } catch { return u; }
  };

  const autoPick = useMemo(() => {
    const pref = cacheNames.filter((n) => n.startsWith("workout-shell-"));
    if (pref.length) return pref.sort().slice(-1)[0];
    return cacheNames[0] ?? "";
  }, [cacheNames]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => setCacheNames(await caches.keys()))();
    setOnline(navigator.onLine);
    setSwControlled(!!navigator.serviceWorker?.controller);
  }, []);

  useEffect(() => {
    if (!selectedCache && autoPick) setSelectedCache(autoPick);
  }, [autoPick, selectedCache]);

  async function refreshCacheEntries() {
    if (!selectedCache || typeof window === "undefined") return;
    setBusy(true);
    try {
      const c = await caches.open(selectedCache);
      const reqs = await c.keys();
      setCacheEntries(reqs.map((r) => { try { return new URL(r.url).pathname || "/"; } catch { return r.url; } }));
      setMsg(`已載入 ${selectedCache} 內的 ${reqs.length} 個條目`);
    } finally { setBusy(false); }
  }

  async function loadPrecacheList() {
    if (typeof window === "undefined") return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/precache-assets.json", { cache: "no-cache" });
      if (!res.ok) { setMsg(`[錯誤] 讀取 precache-assets.json 失敗：${res.status}`); setPrecacheList([]); return; }
      const json = await res.json();
      const arr: string[] = Array.isArray(json) ? json : (Array.isArray(json.assets) ? json.assets : []);
      const origin = window.location.origin;
      setPrecacheList(arr.map((p) => (p.startsWith("http") ? p : origin + p)));
      setMsg(`已讀取 precache 清單，共 ${arr.length} 筆`);
    } catch { setMsg("[錯誤] 讀取 precache-assets.json 發生例外"); setPrecacheList([]); }
    finally { setBusy(false); }
  }

  async function comparePrecacheCoverage() {
    if (!selectedCache || typeof window === "undefined") return;
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
    if (typeof window === "undefined") return;
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
      <div className="sticky top-0 -mx-4 md:-mx-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <Link href="/" className="text-sm">← 回首頁</Link>
          <span className="text-xs text-gray-500">online: {online === null ? "?" : String(online)}</span>
        </div>
      </div>

      <h1 className="text-2xl font-semibold">Diagnostics</h1>

      <section className="rounded-xl border p-3 text-sm">
        <div className="mb-2">
          <b>SW 狀態：</b>
          <span className={swControlled ? "text-green-600" : "text-red-600"}>
            {swControlled ? "controlled" : "not controlled"}
          </span>
          <span className="ml-2 text-gray-500">· online: {online === null ? "?" : String(online)}</span>
        </div>
        <button
          className="rounded border px-3 py-1"
          onClick={async () => {
            if (typeof window === "undefined") return;
            const regs = await navigator.serviceWorker.getRegistrations();
            alert(`registrations: ${regs.length}`);
          }}
        >
          重新整理
        </button>
      </section>

      {/* 下面邏輯維持不變 */}
      {/* ... 保留你的 Cache / Coverage / IndexedDB 測試區塊 ... */}
    </main>
  );
}