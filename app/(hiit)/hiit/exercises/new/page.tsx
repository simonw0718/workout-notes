// /app/(hiit)/exercises/new/page.tsx
'use client';
import { useState } from 'react';
import BackButton from '@/components/BackButton';
import ExerciseForm from '@/components/hiit/ExerciseForm';
import { createExercise } from '@/lib/hiit/api';

export default function NewExercise() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="p-4 text-white space-y-4">
      <div className="mb-2"><BackButton/></div>
      <h1 className="text-xl font-semibold">新增動作</h1>
      <ExerciseForm busy={busy} onSubmit={async (v)=>{
        setBusy(true);
        try {
          await createExercise(v);
          location.href = '/hiit/exercises'; // ← 修正導回正確路由
        } catch(e:any){ alert(e?.message ?? e); }
        finally{ setBusy(false); }
      }}/>
    </div>
  );
}