// /components/BackButton.tsx
'use client';
import { useRouter } from 'next/navigation';

export default function BackButton({ label = '上一頁' }: { label?: string }) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      // 沒有可返回的歷史時，回首頁避免卡住
      router.push('/');
    }
  }

  return (
    <button
      onClick={goBack}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white text-white hover:opacity-80"
      aria-label="返回上一頁"
    >
      ← {label}
    </button>
  );
}