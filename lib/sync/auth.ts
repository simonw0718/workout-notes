// lib/sync/auth.ts
import { getMeta, updateMeta } from "@/lib/db/meta";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "http://127.0.0.1:8000";

/**
 * 確保本機已註冊（若無 token 則向後端註冊）
 * 回傳目前的 { userId, deviceId, token }
 */
export async function ensureRegistered(): Promise<{
  userId: string;
  deviceId: string;
  token: string;
}> {
  const meta = await getMeta();

  // 若已經有 token，視為完成
  if (meta.token && meta.userId && meta.deviceId) {
    return { userId: meta.userId, deviceId: meta.deviceId, token: meta.token };
  }

  // 沒 token：去註冊；若已有 deviceId 會一併帶上（冪等）
  const res = await fetch(`${API_BASE}/auth/register-device`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: meta.deviceId }),
  });
  if (!res.ok) {
    throw new Error(`register-device failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    userId: string;
    deviceId: string;
    token: string;
  };

  // 存回 meta
  await updateMeta({
    userId: data.userId,
    deviceId: data.deviceId,
    token: data.token,
  });

  return data;
}