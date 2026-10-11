import type { ReactNode } from 'react';
import { posGroup } from '../game/positions';
import { overall } from '../game/stats';
import type { Condition, Player, Position, Team } from '../game/types';
import { Avatar } from './Avatar';

/** 能力値の色（eFootball 風の段階表示） */
export function statColor(v: number): string {
  if (v >= 90) return 'var(--s90)';
  if (v >= 80) return 'var(--s80)';
  if (v >= 70) return 'var(--s70)';
  if (v >= 60) return 'var(--s60)';
  return 'var(--s50)';
}

export function Ovr({ v, big }: { v: number; big?: boolean }) {
  return (
    <span className={'ovr' + (big ? ' big' : '')} style={{ background: statColor(v) }}>
      {v}
    </span>
  );
}

export function PosTag({ pos }: { pos: Position }) {
  return <span className={`pos pos-${posGroup(pos)}`}>{pos}</span>;
}

/** 調子の矢印：⬆(ターコイズ) ↖(緑) ⬅(黄) ↙(オレンジ) ⬇(赤) */
export const COND_STYLE: Record<Condition, { color: string; rot: number; label: string }> = {
  5: { color: '#19d3c5', rot: 0, label: '絶好調' },
  4: { color: '#3ccb5a', rot: -45, label: '好調' },
  3: { color: '#f2d43d', rot: -90, label: '普通' },
  2: { color: '#f28c28', rot: -135, label: '不調' },
  1: { color: '#e5484d', rot: 180, label: '絶不調' },
};

export function CondArrow({ c, size = 20 }: { c: Condition; size?: number }) {
  const s = COND_STYLE[c];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="cond" aria-label={`調子：${s.label}`}>
      <circle cx="12" cy="12" r="11" fill={s.color} />
      <g transform={`rotate(${s.rot} 12 12)`}>
        <path d="M12 4.5 L18 11 H14 V19 H10 V11 H6 Z" fill="#0b0f0d" />
      </g>
    </svg>
  );
}

/** 実在選手はユニフォーム、オリジナル選手は顔 */
export function PlayerIcon({ p, team, size = 40 }: { p: Player; team?: Team; size?: number }) {
  const c1 = team?.color ?? '#475569';
  const c2 = team?.color2 ?? '#ffffff';
  if (p.appearance) return <Avatar a={p.appearance} color={c1} color2={c2} number={p.number} size={size} />;
  return <Jersey color={c1} color2={c2} number={p.number} size={size} />;
}

export function Jersey({ color, color2, number, size = 40 }: { color: string; color2: string; number?: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d="M20 6 L10 10 L2 24 L12 30 L14 26 V58 H50 V26 L52 30 L62 24 L54 10 L44 6 C42 12 36 14 32 14 C28 14 22 12 20 6 Z" fill={color} stroke={color2} strokeWidth="2" />
      <path d="M24 7 C26 11 29 12 32 12 C35 12 38 11 40 7" fill="none" stroke={color2} strokeWidth="2.5" />
      {number !== undefined && (
        <text x="32" y="45" textAnchor="middle" fontSize="20" fontWeight="900" fill={color2} fontFamily="system-ui">
          {number}
        </text>
      )}
    </svg>
  );
}

export function Crest({ team, size = 32 }: { team: Team; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M4 3 H28 V15 C28 23 22 28 16 30 C10 28 4 23 4 15 Z" fill={team.color} stroke={team.color2} strokeWidth="2" />
      <text x="16" y="19" textAnchor="middle" fontSize="8" fontWeight="900" fill={team.color2}>
        {team.short}
      </text>
    </svg>
  );
}

export function PlayerRow(props: {
  p: Player;
  team?: Team;
  right?: ReactNode;
  onClick?: () => void;
  highlight?: boolean;
  sub?: ReactNode;
}) {
  const { p, team, right, onClick, highlight, sub } = props;
  return (
    <button className={'player-row' + (highlight ? ' is-hl' : '')} onClick={onClick}>
      <PlayerIcon p={p} team={team} size={38} />
      <div className="player-row-main">
        <div className="player-row-name">
          <PosTag pos={p.position} /> {p.name}
          {p.injury > 0 && <span className="badge-inj">✚{p.injury}</span>}
          {p.suspension > 0 && <span className="badge-sus">停</span>}
        </div>
        <div className="player-row-sub">{sub ?? `${p.age}歳 · ${p.nationality}${team ? ` · ${team.short}` : ' · フリー'}`}</div>
      </div>
      <div className="player-row-right">
        {right ?? (
          <>
            <CondArrow c={p.condition} size={18} />
            <Ovr v={overall(p)} />
          </>
        )}
      </div>
    </button>
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className={'sheet' + (props.full ? ' full' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{props.title}</h2>
          <button className="icon-btn" onClick={props.onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function Seg<T extends string>(props: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; scroll?: boolean; small?: boolean }) {
  return (
    <div className={'seg' + (props.scroll ? ' scroll' : '') + (props.small ? ' small' : '')}>
      {props.options.map((o) => (
        <button key={o.v} className={props.value === o.v ? 'on' : ''} onClick={() => props.onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RepStars({ rep }: { rep: number }) {
  const n = Math.max(1, Math.min(5, Math.round((rep - 40) / 12)));
  return (
    <span className="stars" aria-label={`クラブの格 ${n}`}>
      {'★'.repeat(n)}
      <span className="muted">{'★'.repeat(5 - n)}</span>
    </span>
  );
}
