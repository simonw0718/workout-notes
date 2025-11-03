// /components/hiit/RingCountdown.tsx
'use client';
import React from 'react';

type Props = {
  progress: number;                 // 0~1
  className?: string;
  size?: number;                    // 直徑
  stroke?: number;                  // 線寬
  color?: string;                   // 直接指定顏色（iOS 安全）
  children?: React.ReactNode;       // 放中間的內容
};

export default function RingCountdown({
  progress,
  className,
  size = 160,
  stroke = 10,
  color,            // 若未指定則用 currentColor
  children,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(progress, 0), 1);
  const offset = c * (1 - pct);
  const strokeColor = color || 'currentColor';

  return (
    <div className={`relative ${className || ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {/* 背景圈（淡） */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeOpacity={0.15}
          stroke={strokeColor}
          fill="none"
        />
        {/* 進度圈 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={strokeColor}
          fill="none"
          style={{
            strokeDasharray: c,
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 100ms linear',
          }}
        />
      </svg>

      {/* 中央內容 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {children}
      </div>
    </div>
  );
}