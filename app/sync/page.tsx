// app/sync/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeta } from "@/lib/db/meta";
import { registerDevice, attachDevice, syncNow } from "@/lib/sync/sync";

type MetaLite = {
  deviceId?: string;
  userId?: string | null;
  token?: string | null;
  lastServerVersion?: number;
};

export default function SyncPage() {
  const [meta, setMeta] = useState<MetaLite | null>(null);
  const [userIdInput, setUserIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => setMeta(await getMeta()))();
  }, []);

  const reloadMeta = async () => setMeta(await getMeta());

  const handleRegister = async () => {
    setMsg(null);
    setLoading(true);
    const r = await registerDevice();
    setLoading(false);
    if (!r.ok) return setMsg(`註冊失敗：${r.error}`);
    await reloadMeta();
    setMsg("註冊成功");
  };

  const handleAttach = async () => {
    setMsg(null);
    if (!userIdInput.trim()) return setMsg("請先輸入 userId");
    setLoading(true);
    const r = await attachDevice(userIdInput.trim());
    setLoading(false);
    if (!r.ok) return setMsg(`附掛失敗：${r.error}`);
    await reloadMeta();
    setMsg("附掛成功");
  };

  const handleSync = async () => {
    setMsg(null);
    setLoading(true);
    const r = await syncNow();
    setLoading(false);
    if (!r.ok) return setMsg(`同步失敗：${r.error}`);
    await reloadMeta();
    setMsg("同步完成");
  };

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">同步（多裝置配對）</h1>
        <div className="flex items-center gap-2">
          {/* 顯眼的偵錯入口（桌面 / 大螢幕） */}
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

      {/* 🚨 顯眼的偵錯入口（手機 / 小螢幕） */}
      <div className="sm:hidden">
        <Link
          href="/diagnostics"
          className="block w-full py-3 rounded-2xl bg-red-600 text-white text-center font-bold text-lg shadow"
        >
          🚨 偵錯
        </Link>
      </div>

      {/* 目前本機 */}
      <section className="space-y-3">
        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-600">目前本機</div>
          <div className="mt-1 text-sm">
            <div>
              deviceId: <code>{meta?.deviceId ?? "-"}</code>
            </div>
            <div>
              userId: <code>{meta?.userId ?? "-"}</code>
            </div>
            <div className="break-all">
              token: <code>{meta?.token ?? "-"}</code>
            </div>
            <div>
              lastServerVersion: <code>{meta?.lastServerVersion ?? 0}</code>
            </div>
          </div>
        </div>
      </section>

      {/* ① 註冊本機（新帳號或取回已有 token） */}
      <div className="flex gap-3">
        <button
          onClick={handleRegister}
          disabled={loading}
          className="px-4 py-2 rounded-xl border hover:bg-gray-50"
        >
          ① 註冊本機（新帳號或取回已有 token）
        </button>

        {/* ③ 同步 */}
        <button
          onClick={handleSync}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-black text-white"
        >
          ③ 同步
        </button>
      </div>

      {/* ② 使用既有 userId 配對 */}
      <section className="space-y-3">
        <div className="text-sm text-gray-600">或：使用既有 userId 配對</div>
        <div className="flex gap-3">
          <input
            className="border rounded-lg p-2 flex-1"
            placeholder="輸入既有 userId"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
          />
          <button
            onClick={handleAttach}
            disabled={loading}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50"
          >
            ② 以 userId 附掛本機
          </button>
        </div>
      </section>

      {/* 訊息 */}
      {msg && (
        <div
          className={`p-3 rounded-lg text-sm ${
            /成功/.test(msg) ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}
    </main>
  );
}