// /lib/hiit/tts.ts
// 更穩的 TTS（瀏覽器內建）：聲音挑選、prime、分段播報、隊列防抖

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
let speakNonce = 0; // 競態防抖：新一輪說話會讓舊的失效

function getSynth(): SpeechSynthesis | null {
  try { return typeof window !== 'undefined' ? window.speechSynthesis : null; } catch { return null; }
}

/** 一次載入 voices（含保底 timeout），結果快取 */
function loadVoicesOnce(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const s = getSynth();
    if (!s) return resolve([]);
    const finish = () => {
      voicesCache = s.getVoices() || [];
      voicesReady = true;
      resolve(voicesCache);
    };
    const vs = s.getVoices();
    if (vs && vs.length > 0) { voicesCache = vs; voicesReady = true; return resolve(vs); }
    const onChange = () => { try { s.removeEventListener('voiceschanged', onChange); } catch {} ; finish(); };
    s.addEventListener('voiceschanged', onChange);
    setTimeout(() => { if (!voicesReady) { try { s.removeEventListener('voiceschanged', onChange); } catch {} ; finish(); } }, 1500);
  });
}

/** 需在使用者互動後呼叫；重複呼叫安全 */
export async function primeTTS() {
  if (primed) return;
  const s = getSynth();
  if (!s) return;
  try {
    await loadVoicesOnce();
    // 丟一段無聲字元以解鎖 iOS
    const u = new SpeechSynthesisUtterance('\u200B');
    u.volume = 0; u.rate = 1; u.pitch = 1;
    s.speak(u);
    s.cancel();      // 立即清空
    s.resume?.();    // 背景恢復
    primed = true;
  } catch { /* ignore */ }
}

/** 取消所有排程中的發聲（並使進行中的序列失效） */
export function cancelSpeak() {
  speakNonce++;
  try { getSynth()?.cancel(); } catch {}
}

/** 更嚴格的 voice 選擇：en-US → en-* → 名稱含 English → 其他 */
function pickVoice(langPref = 'en-US'): SpeechSynthesisVoice | null {
  const vs = voicesCache || [];
  if (!vs.length) return null;
  const L = (s?: string) => s?.toLowerCase() ?? '';
  const tryFind = (fn: (v: SpeechSynthesisVoice) => boolean) => vs.find(fn) || null;

  return (
    tryFind(v => L(v.lang) === L(langPref)) ||
    tryFind(v => L(v.lang).startsWith('en')) ||
    tryFind(v => /english/i.test(v.name)) ||
    vs[0]
  );
}

/** 把長句切片，iOS 會比較穩定（盡量在標點切） */
function chunkText(text: string, maxLen = 70): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned ? [cleaned] : [];

  const pieces: string[] = [];
  let buf = '';
  for (const ch of cleaned) {
    buf += ch;
    const isStop = /[，。；、,.!?？！]/.test(ch);
    if ((isStop && buf.length >= Math.min(20, maxLen)) || buf.length >= maxLen) {
      pieces.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) pieces.push(buf.trim());
  return pieces;
}

type SpeakOptions = {
  rate?: number;   // 語速，預設 0.9（比 1.0 穩）
  pitch?: number;  // 音高
  volume?: number; // 音量
  lang?: string;   // 語系
  flush?: boolean; // true: 先 cancel 再說，避免排隊
};

/** 說話（分段 + 防抖）。若使用者未開啟或未 prime，直接返回 */
export async function speak(
  text: string,
  lang = 'en-US',
  rateOrOpts?: number | SpeakOptions,
  pitch?: number,
  volume?: number,
) {
  if (!text || typeof window === 'undefined') return;
  const s = getSynth();
  if (!s) return;
  if (!isTtsEnabled() || !primed) return;

  // 參數解析（向後相容）
  let opts: SpeakOptions;
  if (typeof rateOrOpts === 'number') {
    opts = { rate: rateOrOpts, pitch: pitch ?? 1, volume: volume ?? 1, lang, flush: true };
  } else {
    opts = { lang, rate: 0.9, pitch: 1, volume: 1, flush: true, ...(rateOrOpts || {}) };
  }

  try {
    await loadVoicesOnce();
    if (opts.flush) s.cancel(); // 先清空，效果更乾淨
    s.resume?.();

    const voice = pickVoice(opts.lang);
    const parts = chunkText(text);

    // 用 nonce 確保序列不被下一輪干擾
    const myNonce = ++speakNonce;

    for (const part of parts) {
      if (myNonce !== speakNonce) break; // 被取消或有新播報
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(part);
        u.lang   = opts.lang ?? 'en-US';
        u.rate   = opts.rate ?? 0.9;
        u.pitch  = opts.pitch ?? 1;
        u.volume = opts.volume ?? 1;
        if (voice) u.voice = voice;

        const onEnd = () => { cleanup(); resolve(); };
        const onErr = () => { cleanup(); resolve(); };
        const cleanup = () => {
          try {
            u.removeEventListener('end', onEnd);
            // @ts-ignore
            u.removeEventListener?.('error', onErr);
          } catch {}
        };

        u.addEventListener('end', onEnd);
        // @ts-ignore
        u.addEventListener?.('error', onErr);

        try { s.speak(u); } catch { resolve(); }
      });
    }
  } catch { /* ignore */ }
}