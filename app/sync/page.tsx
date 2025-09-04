// app/sync/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeta, getAuth, setAuth, clearAuth } from "@/lib/db/meta";
import { getDB } from "@/lib/db";
import syncNow from "@/lib/sync/sync";

export default function CloudSyncPage() {
  const [deviceId, setDeviceId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // 本機資料統計
  const [countSessions, setCountSessions] = useState<number>(0);
  const [countExercises, setCountExercises] = useState<number>(0);
  const [countSets, setCountSets] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const meta = await getMeta();
      setDeviceId(meta.deviceId);

      const auth = await getAuth();
      setUserId(auth.userId ?? "");
      setToken(auth.token ?? "");

      const db = await getDB();
      const [cs, ce, ct] = await Promise.all([
        db.count("sessions"),
        db.count("exercises"),
        db.count("sets"),
      ]);
      setCountSessions(cs);
      setCountExercises(ce);
      setCountSets(ct);
    })();
  }, []);

  const genLocalAccount = () => {
    const newUserId = `u_${crypto.randomUUID().slice(0, 8)}`;
    const newToken = crypto.randomUUID();
    setUserId(newUserId);
    setToken(newToken);
    setMsg("已產生本機帳號（尚未儲存）。");
  };

  const handleSaveToken = async () => {
    setBusy(true);
    setMsg("");
    try {
      const uid = userId.trim();
      const t = token.trim();
      if (!uid || !t) {
        setMsg("請輸入 userId 與 token");
        return;
      }
      await setAuth(uid, t);
      setMsg("已儲存 userId / token（僅本機）。");
    } catch (e) {
      console.error(e);
      setMsg("儲存失敗。");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setMsg("");
    try {
      await clearAuth();
      setUserId("");
      setToken("");
      setMsg("已登出（已清除本機 userId / token）。");
    } catch (e) {
      console.error(e);
      setMsg("登出失敗。");
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await syncNow();
      setMsg(`同步完成。serverVersion=${r.serverVersion}`);
      // 重新載入統計
      const db = await getDB();
      const [cs, ce, ct] = await Promise.all([
        db.count("sessions"),
        db.count("exercises"),
        db.count("sets"),
      ]);
      setCountSessions(cs);
      setCountExercises(ce);
      setCountSets(ct);
    } catch (e) {
      console.error(e);
      setMsg("同步失敗。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-6 space-y-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">雲端同步（實驗性 / Step 2）</h1>
        <Link href="/" className="underline">
          回首頁
        </Link>
      </header>

      {/* 裝置資訊 */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">裝置資訊</h2>
        <div className="text-sm text-gray-600">Device ID</div>
        <div className="font-mono text-sm break-all">{deviceId || "..."}</div>
      </section>

      {/* 登入 / Token */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">登入 / Token</h2>
          <button
            type="button"
            onClick={genLocalAccount}
            className="rounded-lg border px-3 py-1 text-sm"
          >
            一鍵建立本機帳號
          </button>
        </div>

        <div className="grid gap-3">
          <label className="text-sm text-gray-600">User ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="本機登入使用者（Step3 會用 API 換回 /me）"
            className="rounded-xl border px-3 py-2"
          />

          <label className="text-sm text-gray-600">API Token</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="請貼上 API Token / JWT"
            className="rounded-xl border px-3 py-2"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSaveToken}
            disabled={busy}
            className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-40"
          >
            儲存
          </button>
          <button
            onClick={handleLogout}
            disabled={busy}
            className="rounded-xl border px-4 py-2 disabled:opacity-40"
          >
            登出（清除本機）
          </button>
        </div>

        <p className="text-xs text-gray-500">
          小提醒：目前只做「本機儲存」。之後 Step 3 會串接後端（FastAPI），把本機資料依帳號上傳同步。
        </p>
      </section>

      {/* 手動同步 */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">手動同步</h2>
        <div className="flex gap-3">
          <button
            onClick={handleSyncNow}
            disabled={busy}
            className="rounded-xl bg-blue-600 text-white px-4 py-2 disabled:opacity-40"
          >
            立即同步
          </button>
        </div>
      </section>

      {/* 本機資料統計 */}
      <section className="rounded-2xl border p-4 space-y-2">
        <h2 className="text-lg font-semibold">本機資料統計</h2>
        <div className="text-sm text-gray-700">
          <div>Sessions：{countSessions}</div>
          <div>Exercises：{countExercises}</div>
          <div>Sets：{countSets}</div>
        </div>
      </section>

      {!!msg && <p className="text-sm text-gray-700">{msg}</p>}
    </main>
  );
}