// /app/(hiit)/hiit/play/page.tsx
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import RingCountdown from '@/components/hiit/RingCountdown';
import PlayerHUD from '@/components/hiit/PlayerHUD';
import BackButton from '@/components/BackButton';
import { buildTimeline, type TimelineItem } from '@/lib/hiit/timeline';
import {
  getWorkout,
  createHistory,
  type HiitWorkoutDto,
  listHiitExercises,
} from '@/lib/hiit/api';
import { isTtsEnabled, setTtsEnabled } from '@/lib/hiit/tts';
import {
  playVoice,
  playWorkoutStart,
  playFinishRandom,
  playWorkStart,
  primeVoices,
} from '@/lib/hiit/voice';

// 從 label 裡只取英文（第一行），給畫面顯示用
function getEnglishName(label?: string | null): string {
  if (!label) return '';
  return label.split('\n')[0]?.trim() || '';
}

// label -> slug，跟影片檔名一樣
function getSlugFromLabel(label?: string | null): string {
  const english = getEnglishName(label);
  return english
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function PlayInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const wid = sp.get('wid') || '';

  // ── state ───────────────────────────────────────────────────────────────────
  const [workout, setWorkout] = useState<HiitWorkoutDto | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [msLeft, setMsLeft] = useState(0);
  const [paused, setPaused] = useState(false);

  // 是否已按下真正的「開始」鍵
  const [started, setStarted] = useState(false);

  // 語音（mp3）開關：沿用原本 TTS 的 localStorage key
  const [ttsOn, setTtsOn] = useState(isTtsEnabled());

  // 目前步驟的提示（cue）
  const [cueText, setCueText] = useState<string>('');

  // 動圖是否可播放（載入成功才顯示）
  const [videoOk, setVideoOk] = useState(false);

  // refs
  const raf = useRef<number | null>(null);
  const beepCtx = useRef<AudioContext | null>(null);
  const lastCountdownSpokenRef = useRef<number | null>(null); // 倒數用（10、3、2、1）
  const spokenSegmentRef = useRef<string | null>(null); // 段落播報去重

  // ====== 歷史紀錄：開始/結束/保護旗標 ======
  const startedAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const savingRef = useRef(false);

  // ── 資料載入（方案） ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wid) return;
    let alive = true;
    (async () => {
      const w = await getWorkout(wid);
      if (!alive) return;
      setWorkout(w);
      const tl = buildTimeline(w);
      setTimeline(tl);
      setIdx(0);
      setMsLeft(0);
      startedAtRef.current = Date.now();
    })().catch(console.error);
    return () => {
      alive = false;
    };
  }, [wid]);

  // ── 取得「目前段落」對應動作的 cue（用名稱查動作庫） ─────────────────────────
  useEffect(() => {
    const cur = timeline[idx];
    const label = cur?.label?.trim();
    if (!label || cur?.kind !== 'work') {
      setCueText('');
      return;
    }

    let abort = false;
    (async () => {
      try {
        const arr = await listHiitExercises({ q: label, limit: 1, status: 'no' });
        if (!abort) setCueText(Array.isArray(arr) && arr[0]?.cue ? arr[0].cue : '');
      } catch {
        if (!abort) setCueText('');
      }
    })();

    return () => {
      abort = true;
    };
  }, [timeline, idx]);

  // ── 每次換段落就先把影片顯示狀態重置 ─────────────────────────────────────────
  useEffect(() => {
    setVideoOk(false);
  }, [idx]);

  // ── 建立 / 取得 beep 用的 AudioContext ──────────────────────────────────────
  const ensureBeepContext = () => {
    if (typeof window === 'undefined') return;
    if (!beepCtx.current) {
      // @ts-ignore
      const AC = window.AudioContext || window.webkitAudioContext;
      beepCtx.current = new AC();
    }
    beepCtx.current?.resume?.();
  };

  // ── 段落切換：beep + 語音（mp3） ───────────────────────────────────────────
  useEffect(() => {
    if (!timeline.length) return;
    if (!started) return;

    const cur = timeline[idx];
    if (!cur) return;

    // 把 ttsOn 狀態也納入 key：
    // 這樣「同一段，但之前是關、現在打開」時會再播一次語音
    const segKey = `${idx}-${cur.kind}-${ttsOn ? 'on' : 'off'}`;
    if (spokenSegmentRef.current === segKey) {
      return;
    }
    spokenSegmentRef.current = segKey;

    // beep
    (async () => {
      try {
        ensureBeepContext();
        const ctx = beepCtx.current;
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.21);
      } catch { }
    })();

    // 段落切換時，也順便 reset 倒數紀錄
    lastCountdownSpokenRef.current = null;

    if (!ttsOn) return;

    if (cur.kind === 'work') {
      const slug = getSlugFromLabel(cur.label);
      playWorkStart(slug);
    } else if (cur.kind === 'rest' || cur.kind === 'interset') {
      playVoice('rest-normal');
    } else if (cur.kind === 'warmup') {
      playVoice('warmup-start');
    } else if (cur.kind === 'cooldown') {
      playVoice('cooldown-start');
    }
  }, [idx, timeline, started, ttsOn]);

  // ── 計時主迴圈 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timeline.length) return;
    if (!started) return;

    let start = performance.now();
    let duration = timeline[idx]?.ms ?? 0;

    const loop = (t: number) => {
      if (paused) {
        raf.current = requestAnimationFrame(loop);
        return;
      }
      const elapsed = t - start;
      const left = Math.max(duration - elapsed, 0);
      setMsLeft(left);

      if (left <= 0) {
        if (idx + 1 < timeline.length) {
          setIdx((i) => i + 1);
          start = t;
          duration = timeline[idx + 1]?.ms ?? 0;
          raf.current = requestAnimationFrame(loop);
        } else {
          // 完成
          if (raf.current !== null) cancelAnimationFrame(raf.current);
          raf.current = null;

          // 完成語音（隨機一句）
          if (ttsOn) {
            playFinishRandom();
          }

          void safeSaveHistory('completed');
          finishedRef.current = true;
          // 完成後 1 秒自動返回上一頁（保留簡單體驗）
          setTimeout(() => {
            try {
              router.back();
            } catch { }
          }, 1000);
        }
      } else {
        raf.current = requestAnimationFrame(loop);
      }
    };

    setMsLeft(duration);
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [timeline, idx, paused, router, started, ttsOn]);

  // ── 倒數語音：10 秒 + 最後 3 秒（mp3 版） ───────────────────────────────────
  useEffect(() => {
    if (!ttsOn) return;
    if (!timeline.length) return;
    if (!started) return;
    if (paused) return;

    const next = timeline[idx + 1];

    const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
    console.log('[hiit] countdown secLeft =', secLeft);

    // 範圍外直接 reset
    if (secLeft <= 0 || secLeft > 10) {
      if (secLeft > 10) lastCountdownSpokenRef.current = null;
      return;
    }

    // 只在 10、3、2、1 說話
    if (secLeft !== 10 && secLeft !== 3 && secLeft !== 2 && secLeft !== 1) return;

    if (lastCountdownSpokenRef.current === secLeft) return;
    lastCountdownSpokenRef.current = secLeft;

    if (secLeft === 10) {
      playVoice('countdown-10');
    } else if (secLeft === 3) {
      playVoice('countdown-3');
    } else if (secLeft === 2) {
      playVoice('countdown-2');
    } else if (secLeft === 1) {
      if (next && next.kind === 'work') {
        playVoice('countdown-1-work');
      } else {
        playVoice('countdown-1-rest');
      }
    }
  }, [msLeft, paused, ttsOn, timeline, idx, started]);

  // ── 離開頁面：若尚未完成，記錄為 interrupted ────────────────────────────────
  useEffect(() => {
    return () => {
      if (!finishedRef.current) {
        void safeSaveHistory('interrupted');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function safeSaveHistory(status: 'completed' | 'interrupted') {
    if (!workout || savingRef.current) return;
    savingRef.current = true;
    try {
      const startedAt = startedAtRef.current ?? Date.now();
      const endedAt = Date.now();

      // 粗略統計（依目前 timeline）
      let totalWorkMs = 0;
      let totalRestMs = 0;
      for (const it of timeline) {
        if (it.kind === 'work') totalWorkMs += it.ms;
        else if (
          it.kind === 'rest' ||
          it.kind === 'interset' ||
          it.kind === 'warmup' ||
          it.kind === 'cooldown'
        ) {
          totalRestMs += it.ms;
        }
      }

      await createHistory({
        workoutId: workout.id,
        workoutName: workout.name,
        startedAt,
        endedAt,
        status,
        totalWorkSec: Math.round(totalWorkMs / 1000),
        totalRestSec: Math.round(totalRestMs / 1000),
        roundsDone:
          workout.steps?.reduce((acc, s) => acc + (s.rounds ?? 1), 0) ?? null,
        setsDone:
          workout.steps?.reduce((acc, s) => acc + (s.sets ?? 1), 0) ?? null,
        skippedSteps: null,
        notes: null,
        snapshot: {
          name: workout.name,
          description: workout.description,
          warmup_sec: workout.warmup_sec,
          cooldown_sec: workout.cooldown_sec,
          steps: workout.steps,
        },
        deletedAt: null,
      });
    } catch (e) {
      console.error('[history] save failed:', e);
    } finally {
      savingRef.current = false;
    }
  }

  // ── guard 畫面（注意：所有 hooks 都已在上面宣告完） ────────────────────────
  if (!wid) {
    return (
      <div className="p-4 text-sm opacity-70">
        <BackButton /> 缺少參數 wid。
      </div>
    );
  }
  if (!workout || !timeline.length) {
    return (
      <div className="p-4">
        <BackButton /> Loading…
      </div>
    );
  }

  // ── 目前/下一段資訊 ─────────────────────────────────────────────────────────
  const cur = timeline[idx];
  const next = timeline[idx + 1];

  const title =
    cur.kind === 'work'
      ? cur.label || 'WORK'
      : cur.kind === 'rest'
        ? 'REST'
        : cur.kind === 'interset'
          ? 'REST'
          : cur.kind === 'warmup'
            ? 'PREPARE'
            : 'COOLDOWN';

  const nextText = next
    ? next.kind === 'work'
      ? `下一個：${next.label}`
      : next.kind === 'rest' || next.kind === 'interset'
        ? '下一個：REST'
        : next.kind === 'warmup'
          ? '下一個：WARMUP'
          : '下一個：COOLDOWN'
    : '完成';

  const total = Math.max(1, cur.ms);
  const progress = started ? 1 - msLeft / total : 0; // 未開始就顯示 0%
  const secondsLeft = started
    ? Math.max(0, Math.ceil(msLeft / 1000))
    : Math.round(total / 1000);

  // ── 依標籤推導影片路徑（僅 work 顯示） ─────────────────────────────────────
  const slug = getSlugFromLabel(cur.label);
  const base = cur.kind === 'work' && slug ? `/hiit/media/${slug}` : '';

  // 找下一個需要顯示影片的動作 (預載用)
  const nextWorkItem = timeline.slice(idx + 1).find((it) => it.kind === 'work');
  const nextSlug = nextWorkItem ? getSlugFromLabel(nextWorkItem.label) : '';
  const nextBase = nextSlug ? `/hiit/media/${nextSlug}` : '';

  // ── UI helper：開始訓練 ─────────────────────────────────────────────────────
  const handleStartClick = () => {
    if (!started) {
      // 1) 先解鎖 WebAudio（beep）
      ensureBeepContext();
      // 2) 再解鎖 HTMLAudio 聲音檔（特別是 iOS）
      primeVoices();

      // 不強迫改變使用者的語音設定，只是開始計時
      startedAtRef.current = Date.now();
      setStarted(true);
      setPaused(false);

      // 如果使用者有開啟語音，就播「開始訓練」那句
      if (ttsOn) {
        playWorkoutStart();
      }
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 flex flex-col items-center text-white relative">
      {/* 隱藏的預載區域：在背景加載下一個動作的影片以避免延遲 */}
      <div style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
        {nextBase && (
          <video key={`preload-${nextBase}`} preload="auto" muted playsInline>
            <source src={`${nextBase}.mp4`} type="video/mp4" />
            <source src={`${nextBase}.webm`} type="video/webm" />
          </video>
        )}
        {/* 如果還沒開始，預載第一個動作 */}
        {!started && base && (
          <video key={`preload-${base}`} preload="auto" muted playsInline>
            <source src={`${base}.mp4`} type="video/mp4" />
            <source src={`${base}.webm`} type="video/webm" />
          </video>
        )}
      </div>

      <div className="self-start mb-2 flex items-center gap-2 w-full">
        <BackButton />
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm opacity-80">語音播報</label>
          <button
            onClick={() => {
              const nv = !ttsOn;
              setTtsOn(nv);
              setTtsEnabled(nv);
            }}
            className={`px-2 py-1 rounded-lg border ${ttsOn
              ? 'border-green-400 text-green-400'
              : 'border-white/40 text-white/60'
              }`}
            aria-pressed={ttsOn}
          >
            {ttsOn ? '開' : '關'}
          </button>
        </div>
      </div>

      <PlayerHUD title={title} subtitle={workout?.name || cur.label} />

      {/* 尚未開始：中央大按鈕取代圓環 */}
      {!started && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={handleStartClick}
            className="px-8 py-3 rounded-full bg-white text-black font-semibold text-lg shadow border border-white/80"
          >
            開始訓練
          </button>
          <div className="text-xs text-white/70">
            第一個動作：{getEnglishName(cur.label) || 'Work'} ·{' '}
            {Math.round(cur.ms / 1000)}s
          </div>
          {!ttsOn && (
            <div className="text-[11px] text-white/60">
              建議開啟語音播報，會有動作名稱與倒數提示。
            </div>
          )}
        </div>
      )}

      {/* 已開始才顯示圓環＋影片＋提示 */}
      {started && (
        <>
          {/* 圓環：中間放下一個 + 倒數秒數 */}
          <RingCountdown
            progress={progress}
            size={240}
            stroke={16}
            color={
              cur.kind === 'work'
                ? '#f43f5e'
                : cur.kind === 'rest' || cur.kind === 'interset'
                  ? '#22d3ee'
                  : cur.kind === 'warmup'
                    ? '#facc15'
                    : '#9ca3af'
            }
          >
            <div className="flex flex-col items-center justify-center leading-tight">
              <div className="text-[11px] sm:text-xs opacity-75">{nextText}</div>
              <div className="text-5xl sm:text-6xl font-semibold tabular-nums mt-1">
                {secondsLeft}s
              </div>
            </div>
          </RingCountdown>

          {/* 圓環下方：若為 work 才顯示；MP4 優先，WebM 後備 */}
          {base && (
            <div className="mt-3 relative">
              <video
                key={base}
                width={180}
                height={180}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onCanPlay={() => setVideoOk(true)}
                onLoadedData={() => setVideoOk(true)}
                onError={() => setVideoOk(false)}
                className={`transition-opacity duration-300 ${videoOk ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                style={{ borderRadius: 12, display: videoOk ? 'block' : 'none' }}
              >
                <source src={`${base}.mp4`} type="video/mp4" />
                <source src={`${base}.webm`} type="video/webm" />
              </video>

              {/* WebP Fallback / Placeholder */}
              {!videoOk && (
                <img
                  src={`${base}.webp`}
                  alt={getEnglishName(cur.label)}
                  width={180}
                  height={180}
                  className="rounded-xl object-cover"
                />
              )}
            </div>
          )}

          {/* 圓環下方：提示（若查得到） */}
          {cueText && (
            <div className="mt-3 text-sm sm:text-base text-white/80 text-center max-w-md">
              {cueText}
            </div>
          )}
        </>
      )
      }

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          className="px-3 py-2 rounded-xl border border-white disabled:opacity-40"
          disabled={!started}
        >
          上一段
        </button>
        <button
          onClick={() =>
            setIdx((i) => Math.min(i + 1, timeline.length - 1))
          }
          className="px-3 py-2 rounded-xl border border-white disabled:opacity-40"
          disabled={!started}
        >
          跳過
        </button>
        <button
          onClick={() => {
            if (!started) {
              handleStartClick();
            } else {
              setPaused((p) => !p);
            }
          }}
          className="px-3 py-2 rounded-xl border border-white"
        >
          {!started ? '開始' : paused ? '繼續' : '暫停'}
        </button>
      </div>
    </div >
  );
}

export default function Play() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-white">
          <BackButton /> Loading…
        </div>
      }
    >
      <PlayInner />
    </Suspense>
  );
}