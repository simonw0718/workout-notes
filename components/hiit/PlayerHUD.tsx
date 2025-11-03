// /components/hiit/PlayerHUD.tsx
'use client';
export default function PlayerHUD({title, subtitle}:{title:string; subtitle?:string}) {
  return (
    <div className="text-center my-4">
      <div className="text-3xl font-bold">{title}</div>
      {subtitle && <div className="text-sm opacity-70 mt-1">{subtitle}</div>}
    </div>
  );
}