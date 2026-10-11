import type { Appearance } from '../game/types';

export const SKINS = ['#f6d7bf', '#e8b98f', '#c98e62', '#9a6340', '#6a4128'];
export const HAIR_COLORS = ['#1b1b1b', '#4a2f1b', '#8a5a2b', '#d9b45a', '#b5452a', '#d8d8d8'];
export const HAIR_STYLE_LABEL = ['坊主', 'ショート', 'ツーブロック', 'ロング', 'アフロ', 'モヒカン', 'センター分け', 'ドレッド'];
export const SKIN_LABEL = ['明るい', 'やや明るい', '標準', 'やや濃い', '濃い'];
export const HAIR_COLOR_LABEL = ['黒', '茶', '明るい茶', '金', '赤', '銀'];
export const BEARD_LABEL = ['なし', '無精ひげ', '口ひげ', 'あごひげ', 'フル'];
export const FACE_LABEL = ['卵形', '丸顔', '面長', '角ばり'];
export const BROW_LABEL = ['普通', '太い', '細い'];

/** 選手の顔（SVG）。ユニフォームの襟と背番号つき */
export function Avatar(props: { a: Appearance; color: string; color2: string; number?: number; size?: number }) {
  const { a, color, color2, number, size = 56 } = props;
  const skin = SKINS[a.skin] ?? SKINS[0];
  const hair = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  const face = a.face ?? 0;
  const rx = face === 1 ? 13.5 : face === 2 ? 11 : face === 3 ? 12.5 : 12;
  const ry = face === 1 ? 13.5 : face === 2 ? 15.5 : 14;
  const shade = shadeOf(skin);
  const browW = a.brow === 1 ? 1.8 : a.brow === 2 ? 0.9 : 1.3;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d="M8 64 C10 48 20 44 32 44 C44 44 54 48 56 64 Z" fill={color} />
      <path d="M25 44 L32 51 L39 44" fill="none" stroke={color2} strokeWidth="2.5" />
      {number !== undefined && (
        <text x="32" y="62" textAnchor="middle" fontSize="9" fontWeight="800" fill={color2}>
          {number}
        </text>
      )}
      <rect x="27" y="36" width="10" height="9" fill={shade} />
      {a.hairStyle === 3 && <path d="M15 26 C14 44 20 46 22 40 L42 40 C44 46 50 44 49 26 Z" fill={hair} />}
      {a.hairStyle === 4 && <circle cx="32" cy="20" r="17" fill={hair} />}
      {a.hairStyle === 7 && (
        <g fill={hair}>
          {[17, 21, 25, 39, 43, 47].map((x) => (
            <rect key={x} x={x - 1.6} y="18" width="3.2" height={x < 30 ? 22 : 22} rx="1.6" />
          ))}
        </g>
      )}
      {face === 3 ? (
        <path d={`M${32 - rx} 20 C${32 - rx} 10 ${32 + rx} 10 ${32 + rx} 20 L${32 + rx} 30 C${32 + rx} 37 37 40 32 40 C27 40 ${32 - rx} 37 ${32 - rx} 30 Z`} fill={skin} />
      ) : (
        <ellipse cx="32" cy="26" rx={rx} ry={ry} fill={skin} />
      )}
      <ellipse cx={32 - rx} cy="27" rx="2" ry="3" fill={skin} />
      <ellipse cx={32 + rx} cy="27" rx="2" ry="3" fill={skin} />
      {/* 眉・目・鼻・口 */}
      <path d="M24.5 22.3 Q27.5 21 30 22.3" stroke="#2a1a12" strokeWidth={browW} fill="none" strokeLinecap="round" />
      <path d="M34 22.3 Q36.5 21 39.5 22.3" stroke="#2a1a12" strokeWidth={browW} fill="none" strokeLinecap="round" />
      <ellipse cx="27.5" cy="26" rx="1.5" ry="1.3" fill="#1d1d1d" />
      <ellipse cx="36.5" cy="26" rx="1.5" ry="1.3" fill="#1d1d1d" />
      <path d="M32 27 L31 31 L33 31" stroke={shade} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M28.5 34 Q32 35.8 35.5 34" stroke="#5a3322" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <Beard type={a.beard ?? 0} color={hair} rx={rx} />
      <Hair style={a.hairStyle} color={hair} />
    </svg>
  );
}

function shadeOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 28);
  const g = Math.max(0, ((n >> 8) & 255) - 28);
  const b = Math.max(0, (n & 255) - 28);
  return `rgb(${r},${g},${b})`;
}

function Beard({ type, color, rx }: { type: number; color: string; rx: number }) {
  switch (type) {
    case 1:
      return <path d={`M${32 - rx + 2} 30 C${32 - rx + 3} 38 28 40 32 40 C36 40 ${32 + rx - 3} 38 ${32 + rx - 2} 30 C36 35 28 35 ${32 - rx + 2} 30 Z`} fill={color} opacity="0.35" />;
    case 2:
      return <path d="M27.5 32.6 Q32 30.8 36.5 32.6 L36 33.6 Q32 32.4 28 33.6 Z" fill={color} />;
    case 3:
      return <path d="M28.5 36 Q32 41.5 35.5 36 Q32 37.5 28.5 36 Z" fill={color} />;
    case 4:
      return <path d={`M${32 - rx + 1} 28 C${32 - rx + 2} 40 27 42 32 42 C37 42 ${32 + rx - 2} 40 ${32 + rx - 1} 28 C37 36 27 36 ${32 - rx + 1} 28 Z M28.5 33.8 Q32 36 35.5 33.8 Q32 35 28.5 33.8 Z`} fill={color} fillRule="evenodd" />;
    default:
      return null;
  }
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
      return (
        <g>
          <path d="M20.5 22 C21 14 43 14 43.5 22 C40 18 24 18 20.5 22 Z" fill={color} opacity="0.35" />
          <path d="M28 18 C29 4 35 4 36 18 C34 16 30 16 28 18 Z" fill={color} />
        </g>
      );
    case 6:
      return <path d="M19.5 25 C17 8 47 8 44.5 25 C43 18 38 15 33 14 L32 19 L31 14 C26 15 21 18 19.5 25 Z" fill={color} />;
    case 7:
      return <path d="M19 24 C17 8 47 8 45 24 C42 15 22 15 19 24 Z" fill={color} />;
    default:
      return null;
  }
}
