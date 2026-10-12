/** 背番号入りのユニフォーム（図鑑・殿堂用） */
export function Jersey({ color, color2, number, size = 56, unknown }: { color: string; color2: string; number?: number | string; size?: number; unknown?: boolean }) {
  const body = unknown ? '#2a3d33' : color;
  const trim = unknown ? '#3b5246' : color2;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M22 6 L12 10 L3 22 L11 29 L16 24 L16 58 L48 58 L48 24 L53 29 L61 22 L52 10 L42 6 C40 11 36 13 32 13 C28 13 24 11 22 6 Z" fill={body} stroke={trim} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 6 C24 11 28 13 32 13 C36 13 40 11 42 6" fill="none" stroke={trim} strokeWidth="3" />
      <text x="32" y="45" textAnchor="middle" fontSize={String(number ?? '').length > 2 ? 15 : 21} fontWeight="900" fill={unknown ? '#5e7a6b' : trim} stroke="#0006" strokeWidth="0.6" fontFamily="-apple-system, 'Hiragino Sans', sans-serif">
        {unknown ? '?' : number}
      </text>
    </svg>
  );
}
