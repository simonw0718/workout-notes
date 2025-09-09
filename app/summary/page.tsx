"use client";
export const dynamic = "force-static";
export const fetchCache = "force-cache";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exportSessionText } from "@/lib/export/text";
import { startSession } from "@/lib/db";

/** 外層只放 Suspense 邊界，避免 Next.js build 對 useSearchParams 的限制 */
export default function SummaryPage() {
  return (
    <Suspense fallback={<main className="p-6">載入中…</main>}>
      <SummaryPageInner />
    </Suspense>
  );
}

/** 原本的邏輯全部搬到內層，這裡可以安全使用 useSearchParams */
function SummaryPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const sessionId = sp.get("sessionId") ?? "";

  const [text, setText] = useState("產生中...");
  const [copied, setCopied] = useState(false);

  // PR3: 可重複使用的載入函式 + 節流控制
  const lastRefreshRef = useRef<number>(0);
  const busyRef = useRef(false);

  async function loadText(sid: string) {
    if (!sid) return;
    busyRef.current = true;
    try {
      const t = await exportSessionText(sid);
      setText(t);
    } finally {
      busyRef.current = false;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let sid = sessionId;

      // 若沒有 sessionId，就先開一場並導到正確 URL
      if (!sid) {
        const s = await startSession();
        if (cancelled) return;
        sid = s.id;
        router.replace(`/summary?sessionId=${sid}`);
        return; // 等下一輪再載入
      }

      await loadText(sid);
    }

    run();

    // PR3: 回到前景自動刷新（300ms 節流）
    function onVis() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshRef.current < 300) return;
      if (busyRef.current) return;
      lastRefreshRef.current = now;
      const sid = sp.get("sessionId") ?? "";
      if (sid) loadText(sid);
    }

    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sessionId, router, sp]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback：HTTP 或權限被擋時
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:underline"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold">訓練摘要</h1>
        <div className="w-10" />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCopy}
          className="px-4 py-2 rounded-lg bg-black text-white"
        >
          複製
        </button>
        {copied && <span className="text-sm text-green-600">已複製</span>}
      </div>

      <textarea
        value={text}
        readOnly
        className="w-full h-[420px] p-3 border rounded-lg font-mono text-sm"
      />
    </main>
  );
}