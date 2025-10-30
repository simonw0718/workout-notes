// lib/sync/auth.ts
import { getMeta, updateMeta } from "@/lib/db/meta";
import { API_BASE } from "./config";

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

  const base = API_BASE.replace(/\/+$/, "");
  const res = await fetch(`${base}/auth/register-device`, {
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

  await updateMeta({
    userId: data.userId,
    deviceId: data.deviceId,
    token: data.token,
  });

  return data;
}