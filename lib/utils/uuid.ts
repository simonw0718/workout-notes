// lib/utils/uuid.ts
export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;

  // Safari 15.4+ 有 randomUUID
  if (c?.randomUUID) return c.randomUUID();

  // 產生 UUID v4：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const bytes = new Uint8Array(16);

  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    // 退而求其次（熵較弱，但能跑）
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // 設定 version / variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
// lib/utils/uuid.ts
export function safeUUID(): string {
  const g: any = globalThis as any;
  const cryptoObj: any = g.crypto || g.msCrypto;

  // 1) 支援度最好：原生 randomUUID
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();

  // 2) 次佳：用 getRandomValues 自己組 v4
  const getRandomValues = cryptoObj?.getRandomValues?.bind(cryptoObj);
  if (getRandomValues) {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    // v4 + variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  // 3) 最後手段（無加密強度）：Math.random
  const rnd = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-${(8 + Math.floor(Math.random()*4)).toString(16)}${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}