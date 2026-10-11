import type { ReactNode } from 'react';
import { overall } from '../game/rating';
import type { Player, Team } from '../game/types';
import { Avatar } from './Avatar';

export function ovrClass(v: number): string {
  if (v >= 85) return 'ovr ovr-s';
  if (v >= 75) return 'ovr ovr-a';
  if (v >= 65) return 'ovr ovr-b';
  if (v >= 55) return 'ovr ovr-c';
  return 'ovr ovr-d';
}

export function Ovr({ v }: { v: number }) {
  return <span className={ovrClass(v)}>{v}</span>;
}

export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="statbar">
      <span className="statbar-label">{label}</span>
      <div className="statbar-track">
        <div className={'statbar-fill ' + ovrClass(value).split(' ')[1]} style={{ width: `${value}%` }} />
      </div>
      <span className="statbar-val">{value}</span>
    </div>
  );
}

export function fmtP(v: number): string {
  return v.toLocaleString('ja-JP') + 'P';
}

export function PosTag({ pos }: { pos: string }) {
  return <span className={`pos pos-${pos}`}>{pos}</span>;
}

export function PlayerRow(props: { p: Player; team?: Team; right?: ReactNode; onClick?: () => void; highlight?: boolean }) {
  const { p, team, right, onClick, highlight } = props;
  return (
    <button className={'player-row' + (highlight ? ' is-hl' : '')} onClick={onClick}>
      <Avatar a={p.appearance} color={team?.color ?? '#475569'} color2={team?.color2 ?? '#fff'} size={40} />
      <div className="player-row-main">
        <div className="player-row-name">
          <PosTag pos={p.position} /> {p.name}
        </div>
        <div className="player-row-sub">
          {p.age}歳 · {p.nationality}
          {team ? ` · ${team.short}` : ' · フリー'}
        </div>
      </div>
      <div className="player-row-right">{right ?? <Ovr v={overall(p)} />}</div>
    </button>
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
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
