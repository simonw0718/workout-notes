"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { getDB, listSetsBySession, deleteSessionWithSets } from "@/lib/db";
import type { Session, SetRecord, Exercise } from "@/lib/models/types";

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ sessionId?: string | string[] }>();
  const pathname = usePathname();

  // 盡可能從 params / path 解析出 sessionId
  const sessionId = (() => {
    const p = params?.sessionId;
    if (typeof p === "string" && p) return p;
    if (Array.isArray(p) && p.length) return p[0];
    return pathname?.split("/").pop() ?? "";
  })();

  const [session, setSession] = useState<Session | null>(null);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [exMap, setExMap] = useState<Record<string, Exercise>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // 刪除/匯出等操作時的防連點

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (!sessionId) {
        setSession(null);
        setSets([]);
        setExMap({});
        return;
      }

      const db = await getDB();

      const s = (await db.get("sessions", sessionId)) as Session | undefined;
      const ss = await listSetsBySession(sessionId);

      const allEx = (await db.getAll("exercises")) as Exercise[];
      const map: Record<string, Exercise> = {};
      for (const ex of allEx) map[ex.id] = ex;

      setSession(s ?? null);
      setSets(ss ?? []);
      setExMap(map);
    } catch (e) {
      console.error("[HistoryDetail] load failed:", e);
      setSession(null);
      setSets([]);
      setExMap({});
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const agg = useMemo(() => {
    const exIdSet = new Set<string>();
    let total = 0;
    for (const r of sets) {
      exIdSet.add(r.exerciseId);
      total += r.weight * r.reps;
    }
    return { total, exerciseCount: exIdSet.size, setsCount: sets.length };
  }, [sets]);

  const handleDelete = useCallback(async () => {
    if (!sessionId || busy) return;
    const ok = window.confirm(
      "確定要刪除此場次以及其所有紀錄嗎？此動作無法復原。",
    );
    if (!ok) return;

    try {
      setBusy(true);
      await deleteSessionWithSets(sessionId);
      // 刪除成功，回列表
      router.push("/history");
    } catch (e) {
      console.error("[deleteSessionWithSets] failed:", e);
      alert("刪除失敗，請稍後再試。詳見 Console。");
    } finally {
      setBusy(false);
    }
  }, [sessionId, busy, router]);

  const handleExport = useCallback(() => {
    if (!session) return;

    // 封裝導出資料
    const payload = {
      session,
      sets,
      exercises: exMap,
      summary: agg,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date(session.startedAt ?? Date.now())
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
    a.download = `workout-${stamp}-${session.id.slice(0, 8)}.json`;
    a.click();

    // 釋放 URL
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [session, sets, exMap, agg]);

  const handleCopyId = useCallback(async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      alert("已複製 sessionId 到剪貼簿。");
    } catch {
      alert("複製失敗，可能瀏覽器限制。");
    }
  }, [sessionId]);

  if (loading) {
    return (
      <main className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">歷史詳情</h1>
          <Link href="/history" className="underline">
            回歷史列表
          </Link>
        </header>
        <p className="text-gray-500">載入中…（sessionId: {sessionId}）</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">歷史詳情</h1>
          <Link href="/history" className="underline">
            回歷史列表
          </Link>
        </header>
        <p className="text-gray-500">
          找不到此場次，或資料已不存在。（sessionId: {sessionId}）
        </p>
      </main>
    );
  }

  const status = session.endedAt ? "已結束" : "進行中";
  const started = session.startedAt
    ? new Date(session.startedAt).toLocaleString()
    : "(未知開始時間)";

  return (
    <main className="p-6 space-y-6">
      {/* Header + 管理功能 */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">歷史詳情</h1>
        <div className="flex items-center gap-3">
          <Link href="/history" className="underline">
            回歷史列表
          </Link>

          <button
            onClick={handleExport}
            disabled={busy}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            title="匯出 JSON"
          >
            匯出
          </button>

          <button
            onClick={handleCopyId}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
            title="複製 sessionId"
          >
            複製 ID
          </button>

          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-xl border px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            title="刪除此場次（含所有組）"
          >
            刪除
          </button>
        </div>
      </header>

      {/* 場次摘要 */}
      <section className="space-y-1">
        <div>場次：{started}</div>
        <div>狀態：{status}</div>
        <div className="text-sm text-gray-600 break-all">
          sessionId：{session.id}
        </div>
        <div>
          動作：{agg.exerciseCount}　組數：{agg.setsCount}　總量：{agg.total}
        </div>
      </section>

      {/* 分組明細 */}
      <section className="space-y-4">
        {sets.length === 0 && (
          <p className="text-gray-500">此場次尚無任何紀錄。</p>
        )}
        {sets.map((r) => {
          const ex = exMap[r.exerciseId];
          return (
            <div key={r.id} className="rounded-xl border p-3">
              <div className="font-medium">{ex?.name ?? "(未知動作)"}</div>
              <div className="text-sm text-gray-600">
                {r.weight} {r.unit ?? "kg"} × {r.reps}
                {r.rpe ? `，RPE ${r.rpe}` : ""}　@{" "}
                {new Date(r.createdAt).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
