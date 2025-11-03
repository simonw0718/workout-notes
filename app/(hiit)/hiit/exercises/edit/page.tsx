'use client';

import { Suspense, useEffect, useState } from 'react';
import type React from 'react';
import { useSearchParams } from 'next/navigation';
import BackButton from '@/components/BackButton';
import ExerciseForm from '@/components/hiit/ExerciseForm';
import { getExercise, updateExercise, deleteExercise, type HiitExerciseDto } from '@/lib/hiit/api';

function EditExerciseInner() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<HiitExerciseDto | null>(null);
  const [err, setErr] = useState<string>('');

  // 兩段式刪除
  const [armed, setArmed] = useState(false);
  const ARM_MS = 2500;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const d = await getExercise(id);
        if (alive) setData(d as HiitExerciseDto);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const save = async (v: Omit<HiitExerciseDto,'id'|'deletedAt'>) => {
    if (!id) return;
    setBusy(true);
    try {
      await updateExercise(id, v);
      location.href = '/hiit/exercises';
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await deleteExercise(id, false);
      location.href = '/hiit/exercises';
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDeleteClick = () => {
    if (busy) return;
    if (armed) {
      setArmed(false);
      void doDelete();
    } else {
      setArmed(true);
      window.setTimeout(() => setArmed(false), ARM_MS);
    }
  };

  const onDeleteCapture: React.EventHandler<React.SyntheticEvent> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteClick();
  };

  if (!id) {
    return (
      <div className="p-4 text-white">
        <BackButton /> 缺少 id。
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-white">
        <BackButton /> 載入中…
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-4 text-white space-y-2">
        <div><BackButton /></div>
        <div className="text-red-400 text-sm">載入失敗：{err}</div>
      </div>
    );
  }

  return (
    <div className="p-4 text-white space-y-4">
      <div className="mb-2"><BackButton/></div>
      <h1 className="text-xl font-semibold">編輯動作</h1>

      <ExerciseForm value={data ?? undefined} busy={busy} onSubmit={save} />

      <div className="pt-2 relative z-10 pointer-events-auto">
        <button
          type="button"
          onClickCapture={onDeleteCapture}
          onPointerUp={onDeleteCapture as any}
          disabled={busy}
          className={`px-4 py-2 rounded-xl border ${
            armed ? 'border-red-500 text-red-200' : 'border-red-400 text-red-300'
          } disabled:opacity-50`}
          title={armed ? '再按一次確認刪除' : '刪除此動作'}
          aria-label="刪除此動作"
        >
          {armed ? '確定？' : '刪除此動作'}
        </button>
      </div>
    </div>
  );
}

export default function EditExercisePage() {
  return (
    <Suspense fallback={<div className="p-4 text-white"><BackButton /> 載入中…</div>}>
      <EditExerciseInner />
    </Suspense>
  );
}