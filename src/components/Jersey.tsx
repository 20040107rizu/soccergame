import { useId } from 'react';

const SHIRT = 'M22 6 L12 10 L3 22 L11 29 L16 24 L16 58 L48 58 L48 24 L53 29 L61 22 L52 10 L42 6 C40 11 36 13 32 13 C28 13 24 11 22 6 Z';

/** 背番号入りのユニフォーム（図鑑・殿堂・フレンドの画面用）。pattern でユニフォームの柄 */
export function Jersey({ color, color2, number, size = 56, unknown, pattern = 'plain' }: { color: string; color2: string; number?: number | string; size?: number; unknown?: boolean; pattern?: string }) {
  const id = useId().replace(/:/g, '');
  const gold = pattern === 'gold' && !unknown;
  const body = unknown ? '#2a3d33' : gold ? `url(#g${id})` : color;
  const trim = unknown ? '#3b5246' : gold ? '#fff3b0' : color2;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={gold ? 'jersey-gold' : undefined}>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={SHIRT} />
        </clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#ffc400" />
          <stop offset="1" stopColor="#a87400" />
        </linearGradient>
      </defs>
      <path d={SHIRT} fill={body} />
      {!unknown && !gold && pattern !== 'plain' && (
        <g clipPath={`url(#c${id})`} fill={color2} opacity="0.85">
          {pattern === 'stripes' && [10, 22, 34, 46].map((x) => <rect key={x} x={x} y="0" width="6" height="64" />)}
          {pattern === 'hoops' && [16, 30, 44].map((y) => <rect key={y} x="0" y={y} width="64" height="7" />)}
          {pattern === 'sash' && <path d="M8 4 L22 4 L58 60 L44 60 Z" />}
          {pattern === 'halves' && <rect x="32" y="0" width="32" height="64" />}
        </g>
      )}
      <path d={SHIRT} fill="none" stroke={trim} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 6 C24 11 28 13 32 13 C36 13 40 11 42 6" fill="none" stroke={trim} strokeWidth="3" />
      <text
        x="32"
        y="45"
        textAnchor="middle"
        fontSize={String(number ?? '').length > 2 ? 15 : 21}
        fontWeight="900"
        fill={unknown ? '#5e7a6b' : gold ? '#5a3c00' : pattern === 'halves' || pattern === 'stripes' ? '#fff' : trim}
        stroke="#0008"
        strokeWidth="0.8"
        fontFamily="-apple-system, 'Hiragino Sans', sans-serif"
      >
        {unknown ? '?' : number}
      </text>
    </svg>
  );
}
