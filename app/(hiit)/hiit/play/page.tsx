// /app/(hiit)/hiit/play/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RingCountdown from '@/components/hiit/RingCountdown';
import PlayerHUD from '@/components/hiit/PlayerHUD';
import BackButton from '@/components/BackButton';
import { buildTimeline, type TimelineItem } from '@/lib/hiit/timeline';
import { getWorkout } from '@/lib/hiit/api';
import { speak, isTtsEnabled, setTtsEnabled, cancelSpeak, primeTTS } from '@/lib/hiit/tts';

export default function Play() {
  const sp = useSearchParams();
  const wid = sp.get('wid') || '';

  // ── state ───────────────────────────────────────────────────────────────────
  const [workout, setWorkout] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [msLeft, setMsLeft] = useState(0);
  const [paused, setPaused] = useState(false);

  // TTS 狀態
  const [ttsOn, setTtsOn] = useState(isTtsEnabled());
  const [voicesReady, setVoicesReady] = useState(false);
  const [ttsPrimed, setTtsPrimed] = useState(false);

  // iOS: 顏色直接指定
  const colorOf = (k: TimelineItem['kind']) =>
    k === 'work' ? '#f43f5e' : k === 'rest' || k === 'interset' ? '#22d3ee' : k === 'warmup' ? '#facc15' : '#9ca3af';

  // 目前步驟的提示（cue）
  const [cueText, setCueText] = useState<string>('');

  // 動圖是否可播放（載入成功才顯示）
  const [videoOk, setVideoOk] = useState(false);

  // refs
  const raf = useRef<number | null>(null);
  const beepCtx = useRef<AudioContext | null>(null);

  // ── 資料載入（方案） ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wid) return;
    let alive = true;
    (async () => {
      const w = await getWorkout(wid);
      if (!alive) return;
      setWorkout(w);
      setTimeline(buildTimeline(w));
      setIdx(0);
      setMsLeft(0);
    })().catch(console.error);
    return () => { alive = false; };
  }, [wid]);

  // ── 取得「目前段落」對應動作的 cue（用名稱查動作庫） ─────────────────────────
  useEffect(() => {
    const cur = timeline[idx];
    const label = cur?.label?.trim();
    if (!label || cur?.kind !== 'work') { setCueText(''); return; }

    let abort = false;
    (async () => {
      try {
        const res = await fetch(`/api/hiit/exercises?q=${encodeURIComponent(label)}&limit=1`);
        if (!res.ok) throw new Error('fetch exercises failed');
        const arr = (await res.json()) as Array<{ name: string; cue?: string }>;
        if (!abort) setCueText(arr?.[0]?.cue || '');
      } catch { if (!abort) setCueText(''); }
    })();
    return () => { abort = true; };
  }, [timeline, idx]);

  // ── 每次換段落就先把影片顯示狀態重置 ─────────────────────────────────────────
  useEffect(() => { setVideoOk(false); }, [idx]);

  // ── TTS voices 載入 & 可見度恢復 ───────────────────────────────────────────
  useEffect(() => {
    const setReady = () => setVoicesReady(true);
    if (typeof window !== 'undefined') {
      try {
        const s = window.speechSynthesis;
        if (s) {
          if (s.getVoices().length > 0) setReady();
          else s.addEventListener('voiceschanged', setReady, { once: true });
          const onVis = () => { try { s.resume?.(); } catch {} };
          document.addEventListener('visibilitychange', onVis);
          return () => {
            document.removeEventListener('visibilitychange', onVis);
            // @ts-ignore
            s.removeEventListener?.('voiceschanged', setReady);
          };
        }
      } catch {}
    }
  }, []);

  // ── 任一互動 -> 解鎖 audio / tts（iOS） ────────────────────────────────────
  useEffect(() => {
    const onUserGesture = () => { primeTTS(); primeAudioAndTTS(); };
    window.addEventListener('pointerdown', onUserGesture, { once: true, capture: true });
    window.addEventListener('keydown', onUserGesture, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', onUserGesture, { capture: true } as any);
      window.removeEventListener('keydown', onUserGesture, { capture: true } as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primeAudioAndTTS = () => {
    try {
      if (!beepCtx.current) {
        // @ts-ignore
        const AC = window.AudioContext || window.webkitAudioContext;
        beepCtx.current = new AC();
      }
      beepCtx.current?.resume?.();
      // @ts-ignore
      const s: SpeechSynthesis = window.speechSynthesis;
      if (s) {
        s.resume?.();
        const u = new SpeechSynthesisUtterance('\u200B'); // 無聲
        u.volume = 0; u.rate = 1; u.pitch = 1; u.lang = 'zh-TW';
        s.speak(u);
        s.cancel();
      }
      setTtsPrimed(true);
    } catch {}
  };

  // ── 段落切換：beep + TTS ───────────────────────────────────────────────────
  useEffect(() => {
    if (!timeline.length) return;

    (async () => {
      try {
        if (!beepCtx.current) {
          // @ts-ignore
          const AC = window.AudioContext || window.webkitAudioContext;
          beepCtx.current = new AC();
        }
        await beepCtx.current.resume?.();
        const ctx = beepCtx.current!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.21);
      } catch {}
    })();

    const cur = timeline[idx];
    const next = timeline[idx + 1];

    if (ttsOn && voicesReady && ttsPrimed && cur) {
      const curText =
        cur.kind === 'work'     ? `開始，${cur.label ?? '動作'}`
      : cur.kind === 'rest'     ? '休息'
      : cur.kind === 'interset' ? '休息'
      : cur.kind === 'warmup'   ? '準備開始'
      : cur.kind === 'cooldown' ? '收操'
      : '';

      if (curText) {
        speak(curText, 'zh-TW');
        if (next) {
          setTimeout(() => {
            const tip =
              next.kind === 'work'     ? `下一個：${next.label}`
            : next.kind === 'rest'     ? '下一個：休息'
            : next.kind === 'interset' ? '下一個：休息'
            : next.kind === 'warmup'   ? '下一個：準備'
            : next.kind === 'cooldown' ? '下一個：收操'
            : '';
            if (tip && isTtsEnabled()) speak(tip, 'zh-TW');
          }, 500);
        }
      }
    }
    return () => cancelSpeak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, timeline, ttsOn, voicesReady, ttsPrimed]);

  // ── 計時主迴圈 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timeline.length) return;
    let start = performance.now();
    let duration = timeline[idx]?.ms ?? 0;

    const loop = (t: number) => {
      if (paused) { raf.current = requestAnimationFrame(loop); return; }
      const elapsed = t - start;
      const left = Math.max(duration - elapsed, 0);
      setMsLeft(left);

      if (left <= 0) {
        if (idx + 1 < timeline.length) {
          setIdx(i => i + 1);
          start = t;
          duration = timeline[idx + 1]?.ms ?? 0;
          raf.current = requestAnimationFrame(loop);
        } else {
          if (raf.current !== null) cancelAnimationFrame(raf.current);
          raf.current = null;
        }
      } else {
        raf.current = requestAnimationFrame(loop);
      }
    };

    setMsLeft(duration);
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; };
  }, [timeline, idx, paused]);

  // ── guard 畫面 ─────────────────────────────────────────────────────────────
  if (!wid) {
    return <div className="p-4 text-sm opacity-70"><BackButton /> 缺少參數 wid。</div>;
  }
  if (!workout || !timeline.length) {
    return <div className="p-4"><BackButton /> Loading…</div>;
  }

  // ── 目前/下一段資訊 ─────────────────────────────────────────────────────────
  const cur = timeline[idx];
  const next = timeline[idx + 1];

  const title =
    cur.kind === 'work'     ? (cur.label || 'WORK')
  : cur.kind === 'rest'     ? 'REST'
  : cur.kind === 'interset' ? 'REST'
  : cur.kind === 'warmup'   ? 'PREPARE'
  : 'COOLDOWN';

  const nextText = next
    ? (next.kind === 'work'
        ? `下一個：${next.label}`
        : next.kind === 'rest' || next.kind === 'interset'
          ? '下一個：REST'
          : next.kind === 'warmup'
            ? '下一個：WARMUP'
            : '下一個：COOLDOWN')
    : '完成';

  const total = Math.max(1, cur.ms);
  const progress = 1 - (msLeft / total);
  const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));

  // ── 依標籤推導影片路徑（僅 work 顯示） ─────────────────────────────────────
  const rawLabel = cur?.label || '';
  const englishHead = rawLabel.split('\n')[0]?.trim() || '';
  const slug =
    englishHead
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const base = cur.kind === 'work' && slug ? `/hiit/media/${slug}` : '';

  // ── UI ─────────────────────────────────────────────────────────────────────
  const withPrime = <T extends (...args: any[]) => any>(fn: T) =>
    (...args: Parameters<T>) => { primeTTS(); primeAudioAndTTS(); return fn(...args); };

  return (
    <div className="p-6 flex flex-col items-center text-white relative">
      <div className="self-start mb-2 flex items-center gap-2 w-full">
        <BackButton />
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm opacity-80">語音播報</label>
          <button
            onClick={() => {
              primeTTS();
              primeAudioAndTTS();
              const nv = !ttsOn;
              setTtsOn(nv);
              setTtsEnabled(nv);
            }}
            className={`px-2 py-1 rounded-lg border ${ttsOn ? 'border-green-400 text-green-400' : 'border-white/40 text-white/60'}`}
            aria-pressed={ttsOn}
            title={voicesReady ? '' : '語音載入中'}
          >
            {ttsOn ? '開' : '關'}
          </button>
        </div>
      </div>

      <PlayerHUD title={title} subtitle={workout?.name || cur.label} />

      {/* 圓環：中間放下一個 + 倒數秒數 */}
      <RingCountdown progress={progress} size={240} stroke={16} color={colorOf(cur.kind)}>
        <div className="flex flex-col items-center justify-center leading-tight">
          <div className="text-[11px] sm:text-xs opacity-75">{nextText}</div>
          <div className="text-5xl sm:text-6xl font-semibold tabular-nums mt-1">{secondsLeft}s</div>
        </div>
      </RingCountdown>

      {/* 圓環下方：若為 work 才顯示；MP4 優先，WebM 後備 */}
      {base && (
        <div className="mt-3">
          <video
            key={base}
            width={180}
            height={180}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoOk(true)}
            onLoadedData={() => setVideoOk(true)}
            onError={() => setVideoOk(false)}
            style={{ display: videoOk ? 'block' : 'none', borderRadius: 12 }}
          >
            <source src={`${base}.mp4`}  type="video/mp4" />
            <source src={`${base}.webm`} type="video/webm" />
          </video>
        </div>
      )}

      {/* 圓環下方：提示（若查得到） */}
      {cueText && (
        <div className="mt-3 text-sm sm:text-base text-white/80 text-center max-w-md">
          {cueText}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button onClick={withPrime(() => setIdx(i => Math.max(i - 1, 0)))} className="px-3 py-2 rounded-xl border border-white">上一段</button>
        <button onClick={withPrime(() => setIdx(i => Math.min(i + 1, timeline.length - 1)))} className="px-3 py-2 rounded-xl border border-white">跳過</button>
        <button onClick={withPrime(() => setPaused(p => !p))} className="px-3 py-2 rounded-xl border border-white">{paused ? '繼續' : '暫停'}</button>
      </div>
    </div>
  );
}