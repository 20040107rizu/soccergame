import type { ReactNode } from 'react';

/** クラブの全景（スタジアム・施設・銅像・博物館）。レベルが上がるほど豪華になる */
export interface ClubSceneData {
  stadium: number;
  stadiumName?: string;
  fac: { training: number; scout: number; academy: number; medical: number; science: number; analysis: number };
  statues: { name: string; number?: number }[];
  museum?: boolean;
  colors: [string, string];
}

const KINDS = [
  { id: 'training', label: '練習場' },
  { id: 'scout', label: 'スカウト網' },
  { id: 'academy', label: 'ユース' },
  { id: 'medical', label: '医療' },
  { id: 'science', label: '科学' },
  { id: 'analysis', label: '分析室' },
] as const;

type Kind = (typeof KINDS)[number]['id'];

/** 見た目の段階：0 空き地 / 1 プレハブ / 2 普通 / 3 近代的 / 4 黄金 / 5 宮殿 / 6 神域 */
export function tierOf(lv: number): number {
  return lv <= 0 ? 0 : lv <= 3 ? 1 : lv <= 6 ? 2 : lv <= 10 ? 3 : lv <= 14 ? 4 : lv < 20 ? 5 : 6;
}

const W = 360;

export function ClubScene({ d }: { d: ClubSceneData }) {
  const levels = [d.stadium, ...KINDS.map((k) => d.fac[k.id])];
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  const night = avg >= 8;
  const statues = d.statues.slice(0, 10);
  const H = 750;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="club-scene" role="img" aria-label="クラブの全景">
      <defs>
        <linearGradient id="cs-sky-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fb3ff" />
          <stop offset="1" stopColor="#cfeaff" />
        </linearGradient>
        <linearGradient id="cs-sky-dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2a6b" />
          <stop offset="0.6" stopColor="#c0587e" />
          <stop offset="1" stopColor="#ffb36b" />
        </linearGradient>
        <linearGradient id="cs-sky-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050818" />
          <stop offset="1" stopColor="#1b2350" />
        </linearGradient>
        <linearGradient id="cs-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#ffd34d" />
          <stop offset="1" stopColor="#b8860b" />
        </linearGradient>
        <linearGradient id="cs-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9ecff" />
          <stop offset="1" stopColor="#3a7bd5" />
        </linearGradient>
        <linearGradient id="cs-bronze" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2a96b" />
          <stop offset="1" stopColor="#7a4a22" />
        </linearGradient>
        <linearGradient id="cs-rainbow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5c8a" />
          <stop offset="0.2" stopColor="#ffa53d" />
          <stop offset="0.4" stopColor="#ffd84d" />
          <stop offset="0.6" stopColor="#7ddc6f" />
          <stop offset="0.8" stopColor="#74b9ff" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
        <radialGradient id="cs-glow">
          <stop offset="0" stopColor="#fff7c2" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd34d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cs-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff7c2" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff7c2" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 空 */}
      <rect width={W} height={300} fill={avg >= 14 ? 'url(#cs-sky-night)' : night ? 'url(#cs-sky-dusk)' : 'url(#cs-sky-day)'} />
      {avg >= 14 && <Stars />}
      {avg >= 18 && <Aurora />}
      {!night && <circle cx={310} cy={40} r={16} fill="#fff6c8" />}
      {night && avg < 14 && <circle cx={310} cy={40} r={12} fill="#fff2d0" opacity={0.8} />}

      {/* 地面 */}
      <rect y={215} width={W} height={H - 215} fill={avg >= 14 ? '#13301f' : '#3f8f4a'} />
      <rect y={632} width={W} height={H - 632} fill={avg >= 11 ? '#2a2418' : '#b9b2a2'} />
      {avg >= 11 && <rect y={632} width={W} height={3} fill="url(#cs-gold)" />}

      <Stadium lv={d.stadium} colors={d.colors} name={d.stadiumName} />

      {KINDS.map((k, i) => (
        <Facility key={k.id} kind={k.id} label={k.label} lv={d.fac[k.id]} x={(i % 3) * 120} y={318 + Math.floor(i / 3) * 155} colors={d.colors} />
      ))}

      {/* 広場：銅像と博物館 */}
      {d.museum && <Museum x={d.statues.length > 7 ? 282 : 250} y={662} rich={avg >= 11} />}
      {statues.map((s, i) => (
        <Statue key={i} x={18 + i * (statues.length > 7 ? 26 : 34)} y={732} s={s} gold={avg >= 20} />
      ))}
      {!statues.length && !d.museum && (
        <text x={W / 2} y={700} textAnchor="middle" className="cs-note">
          銅像や博物館を建てると、この広場に並びます
        </text>
      )}
    </svg>
  );
}

/* ---------------- スタジアム ---------------- */

function Stadium({ lv, colors, name }: { lv: number; colors: [string, string]; name?: string }) {
  const t = tierOf(lv);
  const cx = W / 2;
  const cy = 190;
  const rx = 80 + Math.min(lv, 10) * 5 + Math.max(0, lv - 10) * 1.5;
  const ry = rx * 0.42;
  const wall = t >= 4 ? 'url(#cs-gold)' : t === 3 ? '#e8edf2' : t === 2 ? '#c9ccd1' : '#9aa0a6';
  const standH = 12 + Math.min(lv, 10) * 1.6 + Math.max(0, lv - 10) * 0.8;
  const out: ReactNode[] = [];
  // 光の柱（宮殿以上）
  if (t >= 5)
    for (let i = 0; i < 5; i++)
      out.push(<polygon key={'b' + i} className="cs-sweep" style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${cx - rx + (i * rx) / 2}px ${cy - 10}px` }} points={`${cx - rx + (i * rx) / 2 - 6},${cy - 10} ${cx - rx + (i * rx) / 2 + 6},${cy - 10} ${cx - rx + (i * rx) / 2 + 30},0 ${cx - rx + (i * rx) / 2 - 30},0`} fill="url(#cs-beam)" />);
  // 照明塔
  if (t >= 3)
    for (const sx of [-1, 1]) {
      const x = cx + sx * (rx + 6);
      out.push(
        <g key={'tw' + sx}>
          <rect x={x - 2} y={cy - 40 - lv * 1.5} width={4} height={50 + lv * 1.5} fill={t >= 4 ? 'url(#cs-gold)' : '#d0d4da'} />
          <rect x={x - 9} y={cy - 46 - lv * 1.5} width={18} height={8} rx={2} fill="#fffbe0" className={t >= 4 ? 'cs-blink' : ''} />
        </g>,
      );
    }
  return (
    <g>
      {t >= 6 && <ellipse cx={cx} cy={cy - 20} rx={rx + 40} ry={ry + 40} fill="url(#cs-glow)" className="cs-pulse" />}
      {out}
      {/* 外壁 */}
      <path d={`M${cx - rx},${cy} L${cx - rx},${cy + standH} A${rx},${ry} 0 0 0 ${cx + rx},${cy + standH} L${cx + rx},${cy} Z`} fill={wall} />
      {/* クラブカラーの帯 */}
      {t >= 2 && <path d={`M${cx - rx},${cy + standH * 0.45} A${rx},${ry} 0 0 0 ${cx + rx},${cy + standH * 0.45}`} stroke={colors[0]} strokeWidth={5} fill="none" />}
      {t >= 3 && <path className={t >= 4 ? 'cs-led' : ''} d={`M${cx - rx},${cy + standH * 0.75} A${rx},${ry} 0 0 0 ${cx + rx},${cy + standH * 0.75}`} stroke={t >= 4 ? 'url(#cs-rainbow)' : colors[1]} strokeWidth={3} fill="none" />}
      {/* 客席とピッチ */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={t >= 4 ? '#3a2b10' : '#555b63'} />
      <ellipse cx={cx} cy={cy} rx={rx * 0.86} ry={ry * 0.82} fill={colors[0]} opacity={0.85} />
      {lv >= 2 && <ellipse cx={cx} cy={cy} rx={rx * 0.76} ry={ry * 0.68} fill={colors[1]} opacity={0.35} />}
      <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={ry * 0.5} fill="#2f9e44" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={ry * 0.5} fill="none" stroke="#e9ffe9" strokeWidth={0.8} opacity={0.7} />
      <line x1={cx} y1={cy - ry * 0.5} x2={cx} y2={cy + ry * 0.5} stroke="#e9ffe9" strokeWidth={0.8} opacity={0.7} />
      {/* 屋根 */}
      {t >= 3 && <ellipse cx={cx} cy={cy - 2} rx={rx + 2} ry={ry + 1} fill="none" stroke={t >= 4 ? 'url(#cs-gold)' : '#f2f4f7'} strokeWidth={t >= 4 ? 7 : 5} />}
      {t >= 5 && <ellipse cx={cx} cy={cy - 30 - lv} rx={rx * 0.7} ry={ry * 0.35} fill="none" stroke="url(#cs-gold)" strokeWidth={3} className="cs-float" />}
      {t >= 6 && <Fireworks cx={cx} cy={60} />}
      {t === 0 && <text x={cx} y={cy + 4} textAnchor="middle" className="cs-note">ホームスタジアム</text>}
      <text x={cx} y={cy + standH + ry + 16} textAnchor="middle" className="cs-label">
        🏟 {name || 'ホームスタジアム'} Lv.{lv}
      </text>
    </g>
  );
}

/* ---------------- 施設 ---------------- */

function Facility({ kind, label, lv, x, y, colors }: { kind: Kind; label: string; lv: number; x: number; y: number; colors: [string, string] }) {
  const t = tierOf(lv);
  const ground = y + 122;
  const cx = x + 60;
  const bw = 40 + Math.min(lv, 10) * 3.4 + Math.max(0, lv - 10) * 1.6;
  const bh = 18 + Math.min(lv, 10) * 4 + Math.max(0, lv - 10) * 2.2;
  const bx = cx - bw / 2;
  const by = ground - bh;
  const wall = t >= 5 ? 'url(#cs-gold)' : t === 4 ? 'url(#cs-glass)' : t === 3 ? 'url(#cs-glass)' : t === 2 ? '#e3ddd0' : '#a8a196';
  const trim = t >= 4 ? 'url(#cs-gold)' : t === 3 ? '#ffffff' : '#6b5a48';
  const floors = Math.max(1, Math.round(bh / 13));
  const cols = Math.max(2, Math.round(bw / 13));
  const win: ReactNode[] = [];
  if (t >= 1)
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < cols; c++)
        win.push(
          <rect
            key={f + '-' + c}
            x={bx + 4 + c * ((bw - 8) / cols)}
            y={by + 5 + f * ((bh - 8) / floors)}
            width={(bw - 8) / cols - 3}
            height={(bh - 8) / floors - 4}
            fill={t >= 5 ? '#fff7d6' : t >= 3 ? 'rgba(255,255,255,0.55)' : '#8fb7d9'}
            opacity={t >= 4 && (f + c) % 3 === 0 ? 1 : 0.85}
            className={t >= 4 && (f * 7 + c) % 5 === 0 ? 'cs-twinkle' : ''}
            style={{ animationDelay: `${((f * 3 + c) % 7) * 0.3}s` }}
          />,
        );
  return (
    <g>
      {/* 敷地 */}
      <rect x={x + 6} y={y + 8} width={108} height={122} rx={8} fill={t >= 4 ? 'rgba(255,211,77,0.12)' : 'rgba(0,0,0,0.12)'} stroke={t >= 4 ? '#ffd34d' : 'none'} strokeOpacity={0.5} />
      {t >= 6 && <ellipse cx={cx} cy={ground - bh / 2} rx={bw * 0.9} ry={bh * 0.9} fill="url(#cs-glow)" className="cs-pulse" />}
      {t >= 5 && <Beams cx={cx} y={by} />}
      {t === 0 ? (
        <g>
          <rect x={cx - 30} y={ground - 12} width={60} height={12} fill="none" stroke="#c9a46a" strokeDasharray="3 2" />
          <text x={cx} y={ground - 18} textAnchor="middle" className="cs-note">
            建設予定地
          </text>
        </g>
      ) : (
        <g>
          {/* 練習場はピッチ付き */}
          {kind === 'training' && <TrainingPitch x={x + 10} y={ground - 2} lv={lv} />}
          {/* 本体 */}
          <rect x={bx} y={by} width={bw} height={bh} fill={wall} stroke={trim} strokeWidth={t >= 4 ? 2 : 1} rx={t >= 3 ? 2 : 0} />
          {win}
          {/* 屋根 */}
          {t <= 2 ? (
            <polygon points={`${bx - 3},${by} ${cx},${by - 10 - lv} ${bx + bw + 3},${by}`} fill={t === 1 ? '#7a5b44' : '#4a6b8a'} />
          ) : (
            <rect x={bx - 2} y={by - 4} width={bw + 4} height={4} fill={trim} />
          )}
          {/* 宮殿の柱 */}
          {t >= 5 &&
            [0, 1, 2, 3].map((i) => <rect key={i} x={bx + 2 + i * ((bw - 8) / 3)} y={by + bh * 0.55} width={4} height={bh * 0.45} fill="#fff3b0" />)}
          {/* 入口とクラブカラー */}
          <rect x={cx - 5} y={ground - 10} width={10} height={10} fill={t >= 4 ? '#3a2b10' : '#3d3d3d'} />
          {t >= 2 && <rect x={bx} y={by + bh - 16} width={bw} height={3} fill={colors[0]} />}
          {/* 施設ごとの目印 */}
          <Mark kind={kind} cx={cx} y={by - (t <= 2 ? 10 + lv : 4)} t={t} />
          {/* 旗 */}
          {t >= 2 && (
            <g>
              <line x1={bx + bw - 4} y1={by - 4} x2={bx + bw - 4} y2={by - 22} stroke="#ddd" />
              <rect x={bx + bw - 4} y={by - 22} width={10} height={6} fill={colors[0]} className="cs-flag" />
            </g>
          )}
          {t >= 6 && <Crown cx={cx} y={by - 34} />}
        </g>
      )}
      <text x={cx} y={y + 146} textAnchor="middle" className={'cs-label' + (t >= 4 ? ' gold' : '')}>
        {label} Lv.{lv}
      </text>
    </g>
  );
}

function TrainingPitch({ x, y, lv }: { x: number; y: number; lv: number }) {
  if (lv < 4) return null;
  return <rect x={x} y={y - 6} width={100} height={6} fill="#2f9e44" stroke="#e9ffe9" strokeWidth={0.5} />;
}

function Mark({ kind, cx, y, t }: { kind: Kind; cx: number; y: number; t: number }) {
  const c = t >= 4 ? 'url(#cs-gold)' : '#e6e6e6';
  switch (kind) {
    case 'training':
      return <text x={cx} y={y - 2} textAnchor="middle" fontSize={12}>⚽</text>;
    case 'scout':
      return (
        <g>
          <line x1={cx} y1={y} x2={cx} y2={y - 16} stroke={c} strokeWidth={2} />
          <circle cx={cx} cy={y - 18} r={4} fill="none" stroke={c} strokeWidth={2} className={t >= 3 ? 'cs-spin' : ''} style={{ transformOrigin: `${cx}px ${y - 18}px` }} />
        </g>
      );
    case 'academy':
      return (
        <g>
          <circle cx={cx} cy={y - 8} r={6} fill="#fff" stroke={c} strokeWidth={2} />
          <line x1={cx} y1={y - 8} x2={cx} y2={y - 12} stroke="#333" />
          <line x1={cx} y1={y - 8} x2={cx + 3} y2={y - 8} stroke="#333" />
        </g>
      );
    case 'medical':
      return (
        <g>
          <rect x={cx - 2} y={y - 14} width={4} height={12} fill="#e5484d" />
          <rect x={cx - 6} y={y - 10} width={12} height={4} fill="#e5484d" />
        </g>
      );
    case 'science':
      return <path d={`M${cx - 10},${y} A10,10 0 0 1 ${cx + 10},${y} Z`} fill={t >= 4 ? 'url(#cs-gold)' : '#cfd8e3'} />;
    case 'analysis':
      return (
        <g>
          <path d={`M${cx - 8},${y - 12} Q${cx},${y} ${cx + 8},${y - 12}`} fill="none" stroke={c} strokeWidth={2} />
          <line x1={cx} y1={y - 5} x2={cx + 5} y2={y - 14} stroke={c} />
        </g>
      );
  }
}

/* ---------------- 豪華な演出 ---------------- */

function Beams({ cx, y }: { cx: number; y: number }) {
  return (
    <g>
      {[-1, 1].map((s) => (
        <polygon key={s} className="cs-sweep" style={{ transformOrigin: `${cx}px ${y}px`, animationDelay: s > 0 ? '1.2s' : '0s' }} points={`${cx - 3},${y} ${cx + 3},${y} ${cx + s * 22 + 10},${y - 70} ${cx + s * 22 - 10},${y - 70}`} fill="url(#cs-beam)" />
      ))}
    </g>
  );
}

function Crown({ cx, y }: { cx: number; y: number }) {
  return (
    <g className="cs-float">
      <polygon points={`${cx - 10},${y + 8} ${cx - 10},${y} ${cx - 5},${y + 4} ${cx},${y - 4} ${cx + 5},${y + 4} ${cx + 10},${y} ${cx + 10},${y + 8}`} fill="url(#cs-gold)" stroke="#fff3b0" strokeWidth={0.6} />
      <circle cx={cx} cy={y - 5} r={1.6} fill="#ff5c8a" />
    </g>
  );
}

function Fireworks({ cx, cy }: { cx: number; cy: number }) {
  const bursts = [
    [cx - 110, cy + 10, '#ff5c8a', 0],
    [cx + 105, cy - 5, '#74b9ff', 0.7],
    [cx - 20, cy - 25, '#ffd84d', 1.4],
    [cx + 50, cy + 30, '#7ddc6f', 2.1],
  ] as const;
  return (
    <g>
      {bursts.map(([x, y, c, delay], i) => (
        <g key={i} className="cs-firework" style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px` }}>
          {Array.from({ length: 12 }, (_, k) => {
            const a = (k / 12) * Math.PI * 2;
            return <line key={k} x1={x} y1={y} x2={x + Math.cos(a) * 18} y2={y + Math.sin(a) * 18} stroke={c} strokeWidth={1.6} strokeLinecap="round" />;
          })}
        </g>
      ))}
    </g>
  );
}

function Stars() {
  const pts = Array.from({ length: 40 }, (_, i) => [(i * 97) % W, (i * 53) % 170, (i % 3) * 0.4 + 0.6]);
  return (
    <g>
      {pts.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" className="cs-twinkle" style={{ animationDelay: `${(i % 9) * 0.35}s` }} />
      ))}
    </g>
  );
}

function Aurora() {
  return (
    <g className="cs-aurora" opacity={0.45}>
      <path d={`M0,70 C80,30 160,110 240,60 S340,40 ${W},70 L${W},100 C280,80 200,140 120,100 S40,90 0,110 Z`} fill="url(#cs-rainbow)" />
    </g>
  );
}

function Museum({ x, y, rich }: { x: number; y: number; rich: boolean }) {
  const fill = rich ? 'url(#cs-gold)' : '#ece6d6';
  return (
    <g>
      <polygon points={`${x - 4},${y + 6} ${x + 36},${y - 8} ${x + 76},${y + 6}`} fill={fill} />
      <rect x={x} y={y + 6} width={72} height={30} fill={rich ? '#4a3a18' : '#d8d0bc'} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={x + 4 + i * 14} y={y + 8} width={6} height={26} fill={fill} />
      ))}
      <text x={x + 36} y={y + 48} textAnchor="middle" className="cs-label small">
        🏛 博物館
      </text>
    </g>
  );
}

function Statue({ x, y, s, gold }: { x: number; y: number; s: { name: string; number?: number }; gold: boolean }) {
  const fill = gold ? 'url(#cs-gold)' : 'url(#cs-bronze)';
  return (
    <g>
      <rect x={x - 9} y={y - 14} width={18} height={14} fill="#8d8a84" />
      <rect x={x - 11} y={y - 16} width={22} height={3} fill="#a9a6a0" />
      <circle cx={x} cy={y - 42} r={5} fill={fill} />
      <path d={`M${x - 8},${y - 16} L${x - 6},${y - 36} L${x + 6},${y - 36} L${x + 8},${y - 16} Z`} fill={fill} />
      <line x1={x + 6} y1={y - 34} x2={x + 11} y2={y - 46} stroke={gold ? '#ffd34d' : '#a86b36'} strokeWidth={2.5} strokeLinecap="round" />
      {s.number !== undefined && (
        <text x={x} y={y - 22} textAnchor="middle" className="cs-num">
          {s.number}
        </text>
      )}
      <text x={x} y={y - 4} textAnchor="middle" className="cs-plate">
        {s.name.split('・').pop()!.slice(0, 5)}
      </text>
    </g>
  );
}
