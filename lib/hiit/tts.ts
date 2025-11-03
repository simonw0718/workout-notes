// /lib/hiit/tts.ts
// 更穩的 TTS：處理 voices 載入、prime、lang fallback、localStorage 設定

const KEY = 'hiit.tts.enabled';

export function isTtsEnabled(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function setTtsEnabled(v: boolean) {
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch {}
}

let primed = false;
let voicesReady = false;
let voicesCache: SpeechSynthesisVoice[] = [];

function loadVoicesOnce(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve([]);
    const s = window.speechSynthesis;

    const finish = () => {
      voicesCache = s.getVoices() || [];
      voicesReady = true;
      resolve(voicesCache);
    };

    const vs = s.getVoices();
    if (vs && vs.length > 0) { voicesCache = vs; voicesReady = true; resolve(vs); return; }
    const onChange = () => { s.removeEventListener('voiceschanged', onChange); finish(); };
    s.addEventListener('voiceschanged', onChange);
    // 保底 timeout：有些瀏覽器不會觸發 voiceschanged
    setTimeout(() => {
      if (!voicesReady) { try { s.removeEventListener('voiceschanged', onChange); } catch {} ; finish(); }
    }, 1500);
  });
}

/** 需在使用者互動後呼叫一次；或重複呼叫也安全 */
export async function primeTTS() {
  if (primed) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const s = window.speechSynthesis;
  try {
    await loadVoicesOnce();
    // 丟一段無聲字元，解除 iOS 靜音限制
    const u = new SpeechSynthesisUtterance('\u200B'); // zero-width space
    u.volume = 0; u.rate = 1; u.pitch = 1;
    // 不指定 voice，避免某些瀏覽器崩
    s.speak(u);
    // 立即清空隊列，避免殘留
    s.cancel();
    s.resume?.();
    primed = true;
  } catch {
    // ignore
  }
}

/** 取消所有排程中的發聲 */
export function cancelSpeak() {
  try { window.speechSynthesis?.cancel(); } catch {}
}

/** 安全選聲音：優先 zh-TW，其次 zh-*，再來 en-*，最後第一個 */
function pickVoice(langPref = 'zh-TW'): SpeechSynthesisVoice | null {
  const vs = voicesCache;
  if (!vs || vs.length === 0) return null;
  const tryMatch = (pred: (v: SpeechSynthesisVoice) => boolean) => vs.find(pred) || null;
  return (
    tryMatch(v => v.lang?.toLowerCase() === langPref.toLowerCase()) ||
    tryMatch(v => v.lang?.toLowerCase().startsWith('zh')) ||
    tryMatch(v => v.lang?.toLowerCase().startsWith('en')) ||
    vs[0]
  );
}

/** 說話（會自動等待 voices 準備好；失敗不拋錯、不卡畫面） */
export async function speak(text: string, lang = 'zh-TW', rate = 1, pitch = 1, volume = 1) {
  if (!text || typeof window === 'undefined') return;
  const s = window.speechSynthesis;
  if (!s) return;
  try {
    // 必須：使用者允許且已 prime
    if (!isTtsEnabled() || !primed) return;
    await loadVoicesOnce();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;

    const v = pickVoice(lang);
    if (v) u.voice = v;

    // 某些瀏覽器若背景 → 可能被暫停
    s.resume?.();
    s.speak(u);
  } catch {
    // ignore
  }
}