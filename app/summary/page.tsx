"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exportSessionText } from "@/lib/export/text";
import { startSession } from "@/lib/db";

export default function SummaryPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const sessionId = sp.get("sessionId") ?? "";

  const [text, setText] = useState("產生中...");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      let sid = sessionId;
      if (!sid) {
        const s = await startSession();
        if (cancelled) return;
        sid = s.id;
        router.replace(`/summary?sessionId=${sid}`);
        return; // 等下一輪再載入
      }
      const t = await exportSessionText(sid);
      if (!cancelled) setText(t);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback（非 HTTPS 或權限被擋時）
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
