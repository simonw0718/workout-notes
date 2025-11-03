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

  const [workout, setWorkout] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [msLeft, setMsLeft] = useState(0);
  const [paused, setPaused] = useState(false);

  // ---- TTS 狀態與啟動底火 ----
  const [ttsOn, setTtsOn] = useState(isTtsEnabled());
  const [voicesReady, setVoicesReady] = useState(false);
  const [ttsPrimed, setTtsPrimed] = useState(false);

  const raf = useRef<number | null>(null);
  const beepCtx = useRef<AudioContext | null>(null);

  // 讀取方案
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

  // ---- TTS：voices 載入、可見度恢復 ----
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

  // ---- 全域一次性：任何互動即 prime（解鎖 iOS 靜音與載入 voices）----
  useEffect(() => {
    const onUserGesture = () => {
      primeTTS();         // 解鎖 SpeechSynthesis
      primeAudioAndTTS(); // 同時解鎖 AudioContext & 本地旗標
    };
    window.addEventListener('pointerdown', onUserGesture, { once: true, capture: true });
    window.addEventListener('keydown', onUserGesture, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', onUserGesture, { capture: true } as any);
      window.removeEventListener('keydown', onUserGesture, { capture: true } as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 共用：啟動 Audio/TTS 底火（需使用者互動觸發）----
  const primeAudioAndTTS = () => {
    try {
      if (!beepCtx.current) {
        // @ts-ignore
        const AC = window.AudioContext || window.webkitAudioContext;
        beepCtx.current = new AC();
      }
      beepCtx.current?.resume?.();
      // 送一段無聲字元解除 iOS 靜音（本地旗標）
      // @ts-ignore
      const s: SpeechSynthesis = window.speechSynthesis;
      if (s) {
        s.resume?.();
        const u = new SpeechSynthesisUtterance('\u200B');
        u.volume = 0; u.rate = 1; u.pitch = 1; u.lang = 'zh-TW';
        s.speak(u);
        s.cancel();
      }
      setTtsPrimed(true);
    } catch {}
  };

  // 段落切換：提示音 + TTS
  useEffect(() => {
    if (!timeline.length) return;

    // 小 beep（確保 context 已 resume）
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

    // ⚠️ iOS：需 voicesReady + ttsPrimed + 使用者開啟
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

  // 計時主迴圈
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

  const ringColor =
    cur.kind === 'work'   ? 'text-rose-500'
  : cur.kind === 'rest'   ? 'text-cyan-400'
  : cur.kind === 'warmup' ? 'text-yellow-400'
  : 'text-neutral-400';

  // 事件：任何互動都順手 prime 一次，避免第一次無聲
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
      <RingCountdown progress={progress} className={ringColor} />
      <div className="mt-2 text-sm opacity-80">{nextText}</div>

      <div className="mt-4 text-4xl font-mono tabular-nums">{Math.ceil(msLeft / 1000)}s</div>

      <div className="mt-6 flex gap-3">
        <button onClick={withPrime(() => setIdx(i => Math.max(i - 1, 0)))} className="px-3 py-2 rounded-xl border border-white">上一段</button>
        <button onClick={withPrime(() => setIdx(i => Math.min(i + 1, timeline.length - 1)))} className="px-3 py-2 rounded-xl border border-white">跳過</button>
        <button onClick={withPrime(() => setPaused(p => !p))} className="px-3 py-2 rounded-xl border border-white">{paused ? '繼續' : '暫停'}</button>
      </div>

      <style jsx>{`
        @keyframes hiit-pop {
          0% { transform: scale(0.8); opacity: 0.4; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}