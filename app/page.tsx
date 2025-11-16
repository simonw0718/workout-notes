"use client";

import Image from "next/image";
import Link from "next/link";

export default function EntryPage() {
  return (
    <main className="min-h-dvh bg-black text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex flex-col gap-10">

        {/* Workout 入口 */}
        <Link
          href="/workout"
          className="group block rounded-3xl border border-white/10 bg-black/60 shadow-xl shadow-black/50 overflow-hidden active:scale-95 transition-transform"
        >
          <div className="p-6 flex items-center justify-center">
            <Image
              src="/entry/workout.png"
              alt="Workout 模式"
              width={1024}
              height={1024}   // ← 修正成正方形
              className="w-full h-auto max-h-64 object-contain group-hover:opacity-95 transition-opacity"
              priority
            />
          </div>
        </Link>

        {/* HIIT 入口 */}
        <Link
          href="/hiit"
          className="group block rounded-3xl border border-white/10 bg-black/60 shadow-xl shadow-black/50 overflow-hidden active:scale-95 transition-transform"
        >
          <div className="p-6 flex items-center justify-center">
            <Image
              src="/entry/hiit.png"
              alt="HIIT 模式"
              width={1024}
              height={1024}   // ← 修正成正方形
              className="w-full h-auto max-h-64 object-contain group-hover:opacity-95 transition-opacity"
            />
          </div>
        </Link>
      </div>
    </main>
  );
}