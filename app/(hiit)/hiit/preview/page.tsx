///app/(hiit)/hiit/preview/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getWorkout, listHiitExercises, type HiitExerciseDto } from '@/lib/hiit/api';
import { computeStepMs, computeWorkoutMs, formatHMS } from '@/lib/hiit/time';

type Step = {
  order: number;
  title: string;
  work_sec: number;
  rest_sec: number;
  rounds: number;
  sets: number;
  inter_set_rest_sec: number;
};

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}
function splitNameParts(name?: string | null): string[] {
  if (!name) return [];
  const parts = String(name).split(/\n+/).map(x => norm(x)).filter(Boolean);
  return parts.length > 0 ? parts : [norm(name)];
}
function findExerciseForStep(title: string, all: HiitExerciseDto[]): HiitExerciseDto | null {
  if (!title) return null;
  const keys = splitNameParts(title);
  if (keys.length === 0) return null;
  const pool: Array<{ ex: HiitExerciseDto; key: string }> = [];
  for (const ex of all) for (const p of splitNameParts(ex.name)) pool.push({ ex, key: p });

  for (const k of keys) {
    const hit = pool.find(it => it.key === k);
    if (hit) return hit.ex;
  }
  for (const k of keys) {
    const hit = pool.find(it => it.key.includes(k) || k.includes(it.key));
    if (hit) return hit.ex;
  }
  return null;
}

function stepStructureText(s: Step) {
  const r = Math.max(1, s.rounds ?? 1);
  const sets = Math.max(1, s.sets ?? 1);
  const w = Math.max(0, s.work_sec ?? 0);
  const rest = Math.max(0, s.rest_sec ?? 0);
  const inter = Math.max(0, s.inter_set_rest_sec ?? 0);
  const parts: string[] = [];
  parts.push(`Work ${w}s / Rest ${rest}s`);
  parts.push(`Rounds × ${r}`);
  parts.push(`Sets × ${sets}`);
  if (sets > 1 && inter > 0) parts.push(`組間休 ${inter}s`);
  return parts.join(' · ');
}

function toSlug(englishHead: string) {
  return englishHead
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function PreviewInner() {
  const sp = useSearchParams();
  const wid = sp.get('wid') || '';

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<any | null>(null);
  const [exercises, setExercises] = useState<HiitExerciseDto[]>([]);
  const [err, setErr] = useState<string>('');

  // 載入 workout + 動作庫
  useEffect(() => {
    if (!wid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const [w, exs] = await Promise.all([
          getWorkout(wid),
          listHiitExercises({ status: 'no', limit: 500, sort: 'name' }),
        ]);
        if (!alive) return;
        setWorkout(w);
        setExercises(Array.isArray(exs) ? exs : []);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [wid]);

  const steps: Step[] = useMemo(
    () => (workout?.steps ?? []).map((s: any) => ({
      order: s.order, title: s.title, work_sec: s.work_sec, rest_sec: s.rest_sec,
      rounds: s.rounds, sets: s.sets, inter_set_rest_sec: s.inter_set_rest_sec,
    })),
    [workout],
  );

  // 依步驟推導本次會用到的影片 URL 清單（去重）
  const videoUrls = useMemo(() => {
    const slugs = steps
      .map(s => (s.title || '').split('\n')[0]?.trim() || '')
      .map(head => toSlug(head))
      .filter(Boolean);
    return Array.from(new Set(slugs)).map(x => `/hiit/media/${x}.webm`);
  }, [steps]);

  // —— 隱藏 video：逐支 play→pause 喚醒 iOS/Safari 的 WebM 解碼器 ——
  const warmRef = useRef<HTMLVideoElement | null>(null);
  const warmedOnceRef = useRef(false); // 同一份 preview 只暖一次

  useEffect(() => {
    let cancelled = false;
    if (warmedOnceRef.current) return; // 已經暖過就不重複
    if (!videoUrls.length) return;

    const v = warmRef.current;
    if (!v) return;

    const waitFor = (el: HTMLMediaElement, timeout = 1500) =>
      new Promise<void>((resolve) => {
        let done = false;
        const onOK = () => { if (!done) { done = true; cleanup(); resolve(); } };
        const timer = window.setTimeout(onOK, timeout);
        const cleanup = () => {
          el.removeEventListener('canplay', onOK);
          el.removeEventListener('loadeddata', onOK);
          window.clearTimeout(timer);
        };
        el.addEventListener('canplay', onOK, { once: true });
        el.addEventListener('loadeddata', onOK, { once: true });
      });

    (async () => {
      try {
        v.muted = true;
        // @ts-ignore
        v.playsInline = true;
        v.preload = 'auto';
        for (const u of videoUrls) {
          if (cancelled) break;
          v.src = u;
          v.load();                          // 觸發載入
          try { await v.play(); } catch { }   // iOS 靜音可自動播，失敗就算了
          await waitFor(v, 1500);            // 等到能播或超時
          try { v.pause(); } catch { }
          // 釋放來源（避免保留太多解碼緩衝）
          v.removeAttribute('src');
          v.load();
        }
        if (!cancelled) warmedOnceRef.current = true;
      } catch {
        // 安靜失敗，不阻擋 UI
      }
    })();

    return () => { cancelled = true; try { warmRef.current?.pause(); } catch { } };
  }, [videoUrls]);

  // —— Preload WebP images ——
  useEffect(() => {
    if (!videoUrls.length) return;
    for (const u of videoUrls) {
      const img = new Image();
      img.src = u.replace('.webm', '.webp');
    }
  }, [videoUrls]);

  const totalText = useMemo(() => {
    if (!workout) return '—';
    try { return formatHMS(computeWorkoutMs(workout)); }
    catch { return '—'; }
  }, [workout]);

  if (!wid) {
    return (
      <div className="p-4 text-sm text-white/80">
        缺少 wid。<Link className="underline ml-2" href="/hiit">回 HIIT</Link>
      </div>
    );
  }
  if (loading) return <div className="p-4 text-white">載入中…</div>;
  if (err) {
    return (
      <div className="p-4 text-white">
        <div className="text-red-400 text-sm">載入失敗：{err}</div>
        <div className="mt-2"><Link className="underline" href="/hiit">回 HIIT</Link></div>
      </div>
    );
  }

  return (
    <div className="p-4 text-white">
      {/* 隱藏喚醒用 video（不佔版面，不影響可達性） */}
      <video
        ref={warmRef}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      <div className="flex items-center justify-between gap-2">
        <Link href="/hiit" className="text-sm text-white/70 hover:text-white">← HIIT</Link>
        <div className="text-sm opacity-80">總時長：{totalText}</div>
      </div>

      <h1 className="mt-2 text-xl font-semibold break-words">{workout?.name ?? '方案'}</h1>
      <p className="text-sm opacity-80 mt-1">開始前預覽本次所有步驟與重點</p>

      <ul className="mt-4 space-y-2">
        {steps.map((s) => {
          const ex = findExerciseForStep(s.title ?? '', exercises);
          const coach = ex?.coachNote?.trim();
          const ms = computeStepMs(s);
          return (
            <li key={s.order} className="p-3 rounded-xl border border-white/20">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm opacity-70">Step {s.order}</div>
                  <div className="text-base sm:text-lg font-medium break-words">
                    {s.title || '(未命名步驟)'}
                  </div>
                </div>
                <div className="text-sm opacity-70 whitespace-nowrap ml-2">
                  {formatHMS(ms)}
                </div>
              </div>

              <div className="mt-1 text-sm text-white/80">{stepStructureText(s)}</div>

              {coach && (
                <div className="mt-2 text-sm text-white/70 leading-relaxed">
                  {coach}
                </div>
              )}
            </li>
          );
        })}
        {steps.length === 0 && (
          <li className="p-3 rounded-xl border border-white/20 text-sm opacity-80">
            這個方案沒有任何步驟。
          </li>
        )}
      </ul>

      <div className="h-16" />
      <div className="fixed left-0 right-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-black/0 pb-3 pt-6">
        <div className="px-4">
          <button
            onClick={() => { location.href = `/hiit/play?wid=${encodeURIComponent(wid)}`; }}
            className="w-full px-4 py-3 rounded-2xl border border-white text-white text-base font-medium"
          >
            開始
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Preview() {
  return (
    <Suspense fallback={<div className="p-4 text-white">載入中…</div>}>
      <PreviewInner />
    </Suspense>
  );
}