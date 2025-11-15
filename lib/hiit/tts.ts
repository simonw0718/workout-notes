// /lib/hiit/tts.ts
// 現在只當「語音播報開關」用（沿用原本的 localStorage key）

const KEY = 'hiit.tts.enabled';

// 第一次使用：預設開啟語音（true）
export function isTtsEnabled(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return true;      // 首次使用 → 視為「開」
    return v === '1';
  } catch {
    return true;                      // 讀不到 localStorage 也當作「開」
  }
}

export function setTtsEnabled(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    // ignore
  }
}