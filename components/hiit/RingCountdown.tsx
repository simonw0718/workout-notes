// /components/hiit/RingCountdown.tsx
'use client';
import React from 'react';

export default function RingCountdown({progress, className}:{progress:number; className?: string}) {
  const size=160, stroke=10, r=(size-stroke)/2, c=2*Math.PI*r;
  const offset = c*(1-Math.min(Math.max(progress,0),1));
  return (
    <svg width={size} height={size} className={`mx-auto ${className??''}`}>
      <circle cx={size/2} cy={size/2} r={r} strokeWidth={stroke} strokeOpacity={0.15} stroke="currentColor" fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} strokeWidth={stroke} strokeLinecap="round"
              stroke="currentColor" fill="none" style={{strokeDasharray:c, strokeDashoffset:offset, transition:'stroke-dashoffset 100ms linear'}}/>
    </svg>
  );
}