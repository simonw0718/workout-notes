// lib/sync/sync.ts
import { getMeta, updateMeta } from "@/lib/db/meta";
import { offlineChanged } from "@/lib/bus";

type SyncResult = { ok: true } | { ok: false; error: string };

// ---- 包裝 fetch，加上離線事件 ----
async function safeFetch(input: RequestInfo, init?: RequestInit) {
  try {
    const res = await fetch(input, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 線上成功 → 通知 online
    offlineChanged.dispatchEvent(new CustomEvent("offline", { detail: false }));
    return res;
  } catch (err) {
    // 失敗 → 通知 offline
    offlineChanged.dispatchEvent(new CustomEvent("offline", { detail: true }));
    throw err;
  }
}

// ---- 裝置註冊 ----
export async function registerDevice(): Promise<SyncResult> {
  try {
    const meta = await getMeta();
    const res = await safeFetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register-device`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: meta.deviceId }),
      }
    );
    const json = await res.json();
    await updateMeta({ userId: json.userId, token: json.token });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "registerDevice failed" };
  }
}
// ===== attachDevice：以 userId 掛載目前這台裝置 =====
export async function attachDevice(userId: string): Promise<SyncResult> {
  try {
    const meta = await getMeta();
    const res = await safeFetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/attach-device`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: meta.deviceId, userId }),
      }
    );

    // 這裡用 try/catch 解析主體，與你 registerDevice 的寫法一致
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    const json = await res.json();
    // 後端會回 token；保留現有 meta 欄位
    await updateMeta({ userId: json.userId, token: json.token });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
// ---- 手動同步 ----
export async function manualSync(changes: any, lastVersion: number): Promise<SyncResult> {
  try {
    const meta = await getMeta();
    const res = await safeFetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: meta.deviceId,
        token: meta.token,
        lastVersion,
        changes,
      }),
    });
    const json = await res.json();
    // TODO: 根據後端回應更新本地資料庫（如果有）
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "manualSync failed" };
  }
}

// ===== syncNow：立刻做一次 /sync（空變更，只為了測通/拉遠端）=====
export async function syncNow(): Promise<SyncResult> {
  try {
    const meta = await getMeta();
    const body = {
      deviceId: meta.deviceId,
      token: meta.token,
      lastVersion: meta.lastServerVersion ?? 0,
      changes: { sessions: [], exercises: [], sets: [] },
    };

    const res = await safeFetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/sync`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }

    const json = await res.json().catch(() => null);
    // 若後端有回傳 serverVersion，就存起來；沒有也不強求
    const sv =
      (json && (json.serverVersion as number)) ??
      meta.lastServerVersion ??
      0;
    await updateMeta({ lastServerVersion: sv });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}