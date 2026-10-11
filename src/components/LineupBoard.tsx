import { useState } from 'react';
import type { Loc } from '../game/lineup';
import { FORMATIONS } from '../game/positions';
import { overall, ratingAt } from '../game/stats';
import type { Formation, Player, Team } from '../game/types';
import { CondArrow, PlayerIcon, PosTag, statColor } from './ui';


const same = (a: Loc, b: Loc) => a.kind === b.kind && (a.kind === 'pitch' ? a.i === (b as { i: number }).i : (a as { id: string }).id === (b as { id: string }).id);

/**
 * チーム編成ボード。チーム画面・試合前・試合中で共通。
 * 選手をタップ→入れ替え先をタップで入れ替え。選択中の選手をもう一度タップで詳細。
 */
export function LineupBoard(props: {
  team: Team;
  formation: Formation;
  lineup: string[];
  bench: string[];
  reserves?: string[];
  players: Record<string, Player>;
  energy?: Record<string, number>;
  injured?: string[];
  onMove: (a: Loc, b: Loc) => void;
  onDetail: (id: string) => void;
  benchLabel?: string;
}) {
  const { team, formation, lineup, bench, reserves, players, energy, injured, onMove, onDetail } = props;
  const [sel, setSel] = useState<Loc | null>(null);
  const slots = FORMATIONS[formation];

  const tap = (loc: Loc, id: string) => {
    if (!sel) return setSel(loc);
    if (same(sel, loc)) {
      setSel(null);
      return onDetail(id);
    }
    onMove(sel, loc);
    setSel(null);
  };
  const selPos = sel?.kind === 'pitch' ? slots[sel.i]?.pos : null;

  return (
    <div className="board">
      <div className="pitch">
        {slots.map((s, i) => {
          const p = players[lineup[i]];
          const isSel = sel?.kind === 'pitch' && sel.i === i;
          if (!p) {
            return (
              <div key={i} className="pitch-player empty" style={{ left: `${s.x}%`, bottom: `${2 + s.y * 0.82}%` }}>
                <span className="pp-pos">{s.pos}</span>
              </div>
            );
          }
          const r = ratingAt(p, s.pos);
          const off = p.position !== s.pos && !p.aptitudes[s.pos];
          const en = energy?.[p.id];
          return (
            <button
              key={i}
              className={'pitch-player' + (isSel ? ' sel' : '')}
              style={{ left: `${s.x}%`, bottom: `${2 + s.y * 0.82}%` }}
              onClick={() => tap({ kind: 'pitch', i }, p.id)}
            >
              <div className="pp-icon">
                <PlayerIcon p={p} team={team} size={34} />
                <span className="pp-cond">
                  <CondArrow c={p.condition} size={15} />
                </span>
                {(p.injury > 0 || injured?.includes(p.id)) && <span className="pp-inj">✚</span>}
              </div>
              <span className="pp-name">{shortName(p)}</span>
              <span className={'pp-pos' + (off ? ' off' : '')}>
                {s.pos} <b style={{ color: statColor(r) }}>{r}</b>
              </span>
              {en !== undefined && (
                <span className="pp-energy">
                  <i style={{ width: `${en}%`, background: en > 60 ? '#3ccb5a' : en > 35 ? '#f2d43d' : '#e5484d' }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {sel && <p className="hint center">入れ替える選手をタップ（同じ選手をもう一度タップで詳細）</p>}

      <h3 className="section-title">{props.benchLabel ?? 'ベンチ'}（{bench.length}）</h3>
      <div className="list compact">
        {bench.map((id) => {
          const p = players[id];
          if (!p) return null;
          return (
            <BenchRow
              key={id}
              p={p}
              team={team}
              sel={sel?.kind === 'bench' && sel.id === id}
              hl={!!sel && !(sel.kind === 'bench' && sel.id === id)}
              rating={selPos ? ratingAt(p, selPos) : undefined}
              ratingPos={selPos ?? undefined}
              energy={energy?.[id]}
              onClick={() => tap({ kind: 'bench', id }, id)}
            />
          );
        })}
      </div>
      {reserves && (
        <>
          <h3 className="section-title">ベンチ外（{reserves.length}）</h3>
          <div className="list compact">
            {reserves.map((id) => {
              const p = players[id];
              if (!p) return null;
              return (
                <BenchRow
                  key={id}
                  p={p}
                  team={team}
                  sel={sel?.kind === 'res' && sel.id === id}
                  hl={!!sel && !(sel.kind === 'res' && sel.id === id)}
                  rating={selPos ? ratingAt(p, selPos) : undefined}
                  ratingPos={selPos ?? undefined}
                  onClick={() => tap({ kind: 'res', id }, id)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function BenchRow(props: { p: Player; team: Team; sel: boolean; hl: boolean; rating?: number; ratingPos?: string; energy?: number; onClick: () => void }) {
  const { p, team, sel, hl, rating, ratingPos, energy, onClick } = props;
  const ovr = overall(p);
  return (
    <button className={'bench-row' + (sel ? ' sel' : '') + (hl ? ' hl' : '')} onClick={onClick}>
      <PlayerIcon p={p} team={team} size={30} />
      <PosTag pos={p.position} />
      <span className="bench-name">
        {p.name}
        {p.injury > 0 && <span className="badge-inj">✚{p.injury}</span>}
        {p.suspension > 0 && <span className="badge-sus">停</span>}
      </span>
      {energy !== undefined && <span className="muted small">体力{Math.round(energy)}</span>}
      <CondArrow c={p.condition} size={18} />
      <span className="bench-ovr" style={{ color: statColor(rating ?? ovr) }}>
        {ratingPos ? <small>{ratingPos} </small> : null}
        {rating ?? ovr}
      </span>
    </button>
  );
}

export function shortName(p: Player): string {
  const parts = p.name.split('・');
  const n = parts[parts.length - 1];
  return n.length > 7 ? n.slice(0, 7) : n;
}
