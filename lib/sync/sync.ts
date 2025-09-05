// lib/sync/sync.ts
import { getMeta, updateMeta } from "@/lib/db/meta";

type SyncResult = { ok: true } | { ok: false; error: string };

export async function registerDevice(): Promise<SyncResult> {
  try {
    const meta = await getMeta();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register-device`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: meta.deviceId }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    const json = await res.json();
    await updateMeta({ userId: json.userId, token: json.token });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export async function attachDevice(userId: string): Promise<SyncResult> {
  try {
    const meta = await getMeta();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/attach-device`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, deviceId: meta.deviceId }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    const json = await res.json();
    await updateMeta({ userId: json.userId, token: json.token });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export async function syncNow(): Promise<SyncResult> {
  try {
    const meta = await getMeta();
    // 這裡依你的既有結構把 local 變更打包
    const changes = { sessions: [], exercises: [], sets: [] }; // <- 請接你現有的打包程式
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: meta.deviceId,
        token: meta.token,
        lastVersion: meta.lastServerVersion ?? 0,
        changes,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    const json = await res.json();
    // 依回傳更新 lastServerVersion 等
    await updateMeta({ lastServerVersion: json.serverVersion ?? 0 });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}