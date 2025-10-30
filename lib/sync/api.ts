// File: lib/sync/api.ts
// 說明：保留既有 callSync，新增「最近使用」與「接續紀錄」兩個前端 helper

import type { SyncRequest, SyncResponse } from "./types";
import { ensureRegistered } from "./auth";

const BASE =
  process.env.NEXT_PUBLIC_SYNC_BASE?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
  }
  return (await res.json()) as T;
}

export function callSync(payload: SyncRequest) {
  return postJson<SyncResponse>("/sync", payload);
}

// === New: 最近使用 ===
export async function getRecentExercises(limitSessions = 5) {
  const { deviceId, token } = await ensureRegistered();
  const url = new URL(`${BASE}/exercises/recent`);
  url.searchParams.set("deviceId", deviceId);
  url.searchParams.set("token", token);
  url.searchParams.set("limitSessions", String(limitSessions));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`recent failed: ${res.status}`);
  const json = await res.json();
  return (json?.items ?? []) as Array<{
    id: string;
    name: string;
    defaultUnit?: string | null;
    category?: "upper" | "lower" | "core" | "other" | null;
  }>;
}

// === New: 接續紀錄 ===
export async function continueSession() {
  const { deviceId, token } = await ensureRegistered();
  return await postJson<{ ok: true; session: any }>("/sessions/continue", {
    deviceId,
    token,
  });
}