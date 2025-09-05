// lib/db/meta.ts
import { getDB } from "@/lib/db";
import type { Meta } from "@/lib/models/types";
import { safeUUID } from "@/lib/utils/uuid";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

/** 讀取/建立 meta（確保 id="app" 與 deviceId 存在） */
export async function getMeta(): Promise<Meta> {
  const db = await getDB();
  let meta = await db.get("meta", "app");
  if (!meta) {
    meta = { id: "app", deviceId: safeUUID() } as Meta;
    await db.put("meta", meta);
  } else if (!meta.deviceId) {
    meta.deviceId = safeUUID();
    await db.put("meta", meta);
  }
  return meta;
}

/** 覆寫/合併 meta */
export async function setMeta(patch: Partial<Meta>): Promise<Meta> {
  const db = await getDB();
  const cur = (await db.get("meta", "app")) ?? ({ id: "app", deviceId: safeUUID() } as Meta);
  const next = { ...cur, ...patch, id: "app" } as Meta;
  await db.put("meta", next);
  return next;
}

/** 清掉身分（userId / token / lastServerVersion） */
export async function clearAuth(): Promise<Meta> {
  const meta = await getMeta();
  delete (meta as any).userId;
  delete (meta as any).token;
  delete (meta as any).lastServerVersion;
  await setMeta(meta);
  return meta;
}

/** 回傳目前身分資訊（方便前端顯示） */
export async function getAuth(): Promise<{ deviceId: string; userId?: string; token?: string; lastServerVersion?: number }> {
  const m = await getMeta();
  return {
    deviceId: m.deviceId,
    userId: m.userId,
    token: m.token,
    lastServerVersion: m.lastServerVersion,
  };
}

/** 註冊裝置（冪等）：POST /auth/register-device */
export async function registerDevice(explicitDeviceId?: string): Promise<{ userId: string; deviceId: string; token: string }> {
  const meta = await getMeta();
  const deviceId = explicitDeviceId || meta.deviceId || safeUUID();

  const res = await fetch(`${API}/auth/register-device`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`register-device failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { userId: string; deviceId: string; token: string };
  // 寫回 meta
  await setMeta({
    deviceId: data.deviceId,
    userId: data.userId,
    token: data.token,
  });
  return data;
}

/**
 * 附掛裝置到既有使用者（需要後端有 /auth/attach-device）
 * 若後端尚未提供此路由，前端不會編譯壞掉，但執行時會回錯誤訊息
 */
export async function attachDevice(userId: string, deviceId: string): Promise<{ userId: string; deviceId: string; token: string }> {
  const res = await fetch(`${API}/auth/attach-device`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, deviceId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`attach-device failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { userId: string; deviceId: string; token: string };
  await setMeta({
    deviceId: data.deviceId,
    userId: data.userId,
    token: data.token,
  });
  return data;
}

export const updateMeta = setMeta;