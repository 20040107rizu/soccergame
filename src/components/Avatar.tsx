import type { Appearance } from '../game/types';

export const SKINS = ['#f6d7bf', '#e8b98f', '#c98e62', '#9a6340', '#6a4128'];
export const HAIR_COLORS = ['#1b1b1b', '#4a2f1b', '#8a5a2b', '#d9b45a', '#b5452a', '#d8d8d8'];
export const HAIR_STYLE_LABEL = ['坊主', 'ショート', 'ツーブロック', 'ロング', 'アフロ', 'モヒカン'];
export const SKIN_LABEL = ['明るい', 'やや明るい', '標準', 'やや濃い', '濃い'];
export const HAIR_COLOR_LABEL = ['黒', '茶', '明るい茶', '金', '赤', '銀'];

/** オリジナル選手の顔（SVG） */
export function Avatar(props: { a: Appearance; color: string; color2: string; number?: number; size?: number }) {
  const { a, color, color2, number, size = 56 } = props;
  const skin = SKINS[a.skin] ?? SKINS[0];
  const hair = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d="M8 64 C10 48 20 44 32 44 C44 44 54 48 56 64 Z" fill={color} />
      <path d="M26 44 L32 52 L38 44" fill="none" stroke={color2} strokeWidth="2.5" />
      {number !== undefined && (
        <text x="32" y="62" textAnchor="middle" fontSize="9" fontWeight="800" fill={color2}>
          {number}
        </text>
      )}
      <rect x="27" y="36" width="10" height="9" fill={skin} />
      {a.hairStyle === 3 && <path d="M15 26 C14 44 20 46 22 40 L42 40 C44 46 50 44 49 26 Z" fill={hair} />}
      {a.hairStyle === 4 && <circle cx="32" cy="20" r="17" fill={hair} />}
      <ellipse cx="32" cy="26" rx="12" ry="14" fill={skin} />
      <ellipse cx="20" cy="27" rx="2" ry="3" fill={skin} />
      <ellipse cx="44" cy="27" rx="2" ry="3" fill={skin} />
      <circle cx="27.5" cy="26" r="1.5" fill="#222" />
      <circle cx="36.5" cy="26" r="1.5" fill="#222" />
      <path d="M28 33 Q32 35.5 36 33" stroke="#5a3322" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <Hair style={a.hairStyle} color={hair} />
    </svg>
  );
}

function Hair({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 0:
      return <path d="M20.5 22 C21 12 43 12 43.5 22 C40 17 24 17 20.5 22 Z" fill={color} opacity="0.55" />;
    case 1:
      return <path d="M19.5 24 C18 8 46 8 44.5 24 C42 17 36 15 32 16 C27 15 22 17 19.5 24 Z" fill={color} />;
    case 2:
      return (
        <g>
          <path d="M20.5 24 C21 15 43 15 43.5 24 C40 20 24 20 20.5 24 Z" fill={color} opacity="0.5" />
          <path d="M21 18 C24 7 42 7 44 18 C38 15 28 14 21 18 Z" fill={color} />
        </g>
      );
    case 3:
      return <path d="M19 26 C17 8 47 8 45 26 C42 16 22 16 19 26 Z" fill={color} />;
    case 5:
      return <path d="M28 18 C29 4 35 4 36 18 C34 16 30 16 28 18 Z" fill={color} />;
    default:
      return null;
  }
}
