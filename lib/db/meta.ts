// lib/db/meta.ts
import type { Meta } from "@/lib/models/types";
import { getDB } from "./index";

/** 取得 meta（一定會有，因為在 getDB 時就建立了 deviceId） */
export async function getMeta(): Promise<Meta> {
  const db = await getDB();
  let meta = (await db.get("meta", "app")) as Meta | undefined;
  if (!meta) {
    meta = { id: "app", deviceId: crypto.randomUUID() };
    await db.put("meta", meta);
  }
  return meta;
}

/** 更新 meta（部分更新即可） */
export async function updateMeta(patch: Partial<Meta>): Promise<void> {
  const db = await getDB();
  const cur = (await db.get("meta", "app")) as Meta | undefined;
  const base: Meta = cur ?? ({ id: "app", deviceId: crypto.randomUUID() } as Meta);
  const nextMeta: Meta = { ...base, ...patch } as Meta;
  await db.put("meta", nextMeta);
}

/** 登入：存 userId 與 token */
export async function setAuth(userId: string, token: string): Promise<void> {
  await updateMeta({ userId, token });
}

/** 登出：清掉 userId 與 token */
export async function clearAuth(): Promise<void> {
  await updateMeta({ userId: undefined, token: undefined });
}

/** 取得目前登入資訊（userId, token） */
export async function getAuth(): Promise<{ userId?: string; token?: string }> {
  const meta = await getMeta();
  return { userId: meta.userId, token: meta.token };
}