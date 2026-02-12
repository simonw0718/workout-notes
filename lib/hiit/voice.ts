// /lib/hiit/voice.ts
// 播放 HIIT 語音用的 helper：支援單一檔案 & A/B/C 變體隨機
// 重點：所有播放都共用同一個 <audio> 元素，才能在 iOS 上穩定運作

// public/voices/*.mp3 → /voices/*.mp3
const VOICE_BASE = '/voices';

// 共用的 <audio> 元素（prime + 之後所有播放都用這一支）
let sharedAudio: HTMLAudioElement | null = null;
let voicesPrimed = false;

function audioPath(name: string) {
  // name 不含 .mp3，例如 "rest_normal"
  return `${VOICE_BASE}/${name}.mp3`;
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

/** 必須在使用者互動（click / tap）中呼叫一次，用來解鎖 iOS 上的 HTMLAudio */
export function primeVoices() {
  if (voicesPrimed) return;
  const audio = getSharedAudio();
  if (!audio) return;

  try {
    const src = audioPath('rest-normal'); // 用一個一定存在的短檔
    audio.src = src;
    audio.volume = 0; // 🔇 靜音解鎖
    voicesPrimed = true;

    void audio.play().catch((e) => {
      console.warn('[voice] prime failed:', e);
      voicesPrimed = false; // 解鎖失敗，下次再試
    });
  } catch (e) {
    console.error('[voice] primeVoices exception:', e);
  }
}

export function playVoice(name: string) {
  try {
    const audio = getSharedAudio();
    if (!audio) return;

    const src = audioPath(name);

    // 小小 debug：要的話可以先保留，之後再刪
    console.log('[voice] playVoice:', src);

    // 停掉前一段，從頭播新的
    audio.pause();
    audio.currentTime = 0;

    // 避免重設同個 src 觸發不了 load
    const fullSrc = typeof window !== 'undefined'
      ? new URL(src, window.location.origin).toString()
      : src;

    if (audio.src !== fullSrc) {
      audio.src = src;
    }

    audio.volume = 1.0;
    void audio.play().catch((e) => {
      console.warn('[voice] play failed:', src, e);
    });
  } catch (e) {
    console.error('[voice] playVoice failed:', e);
  }
}

// ---- 變體快取：workout-start- / finish- / work-start-<slug>-A/B/... ----

// 目前你有 workout_start_A/B/C & finish_A/B/C
// 保留到 F，未來要加 D/E/F 直接丟檔案即可
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const variantCache: Record<string, string[]> = {};

/**
 * 以 prefix + A~F 掃描實際存在的檔案，結果快取起來。
 * 例如 prefix = "workout-start-" → workout-start-A/B/C...
 */
async function discoverVariants(prefix: string): Promise<string[]> {
  if (variantCache[prefix]) return variantCache[prefix];

  const found: string[] = [];

  await Promise.all(
    LETTERS.map(async (ch) => {
      const name = `${prefix}${ch}`;
      try {
        const res = await fetch(audioPath(name), { method: 'HEAD' });
        if (res.ok) {
          found.push(name);
        }
      } catch {
        // ignore
      }
    }),
  );

  variantCache[prefix] = found;
  console.log('[voice] variants for', prefix, '→', found);
  return found;
}

/** 隨機播放 prefix_A ~ prefix_F 中存在的檔案；若找不到，且有 fallbackName 就改播 fallbackName */
export async function playRandomVariant(prefix: string, fallbackName?: string) {
  const variants = await discoverVariants(prefix);

  if (variants.length > 0) {
    const name = variants[Math.floor(Math.random() * variants.length)];
    playVoice(name);
    return;
  }

  if (fallbackName) {
    playVoice(fallbackName);
  }
}

// ---- 專用語音封裝：給 play/page.tsx 呼叫 ----

/** 開始訓練：workout-start-A/B/C...（未來加 D/E/F 會自動吃到） */
export function playWorkoutStart() {
  void playRandomVariant('workout-start-');
}

/** 結束訓練：finish-A/B/C...（未來加 D/E/F 會自動吃到） */
export function playFinishRandom() {
  void playRandomVariant('finish-');
}

/** 某個動作開始：work-start-<slug> 或 work-start-<slug>-A/B/... */
export function playWorkStart(slug: string) {
  if (!slug) return;

  const variantPrefix = `work-start-${slug}-`;   // 預留未來 A/B/C... 用
  const singleName = `work-start-${slug}`;       // 目前實際存在的檔名

  void playRandomVariant(variantPrefix, singleName);
}