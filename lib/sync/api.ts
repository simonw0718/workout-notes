// lib/sync/api.ts
import type { SyncRequest, SyncResponse } from "./types";

const BASE =
  process.env.NEXT_PUBLIC_SYNC_BASE?.replace(/\/$/, "") ||
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