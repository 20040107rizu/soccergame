import { useRef, useState } from 'react';
import type { Loc } from '../game/lineup';
import { POS_ZONE, posFromXY } from '../game/positions';
import { overall, ratingAt, styleActive } from '../game/stats';
import type { Player, Team } from '../game/types';
import { POSITIONS } from '../game/types';
import { CondArrow, PlayerIcon, PosTag, statColor } from './ui';

const toBottom = (y: number) => 2 + y * 0.86;
const fromBottom = (b: number) => (b - 2) / 0.86;

const APT_COLOR = ['rgba(255,255,255,0.05)', 'rgba(47,158,106,0.55)', 'rgba(242,179,61,0.6)', 'rgba(229,72,77,0.65)'];

/**
 * チーム編成ボード（チーム画面・試合前・試合中で共通）。
 * - 選手をドラッグすると、ピッチ上の好きな位置に配置できる（位置からポジションが決まる）
 * - 選手をタップすると選択され、ピッチ上に適性ポジションのヒートマップが重なる
 * - 選択中に別の選手をタップで入れ替え、同じ選手をもう一度タップで詳細
 */
export function LineupBoard(props: {
  team: Team;
  slots: { x: number; y: number }[];
  lineup: string[];
  bench: string[];
  reserves?: string[];
  players: Record<string, Player>;
  energy?: Record<string, number>;
  injured?: string[];
  onMove: (a: Loc, b: Loc) => void;
  onSlotMove: (i: number, x: number, y: number) => void;
  onDetail: (id: string) => void;
  benchLabel?: string;
  /** 試合中：交代した選手は戻れない旨などの補足 */
  hint?: string;
}) {
  const { team, slots, lineup, bench, reserves, players, energy, injured, onMove, onSlotMove, onDetail } = props;
  const [sel, setSel] = useState<Loc | null>(null);
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const down = useRef<{ i: number; cx: number; cy: number; moved: boolean } | null>(null);

  const tap = (loc: Loc, id: string) => {
    if (!sel) return setSel(loc);
    if (sameLoc(sel, loc)) {
      setSel(null);
      return onDetail(id);
    }
    onMove(sel, loc);
    setSel(null);
  };

  const toPitch = (cx: number, cy: number) => {
    const r = pitchRef.current!.getBoundingClientRect();
    const x = ((cx - r.left) / r.width) * 100;
    const b = ((r.bottom - cy) / r.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, fromBottom(b))) };
  };

  // 選択中（またはドラッグ中）の選手の適性をピッチに重ねる
  const focusId = drag ? lineup[drag.i] : sel?.kind === 'pitch' ? lineup[sel.i] : sel ? sel.id : undefined;
  const focus = focusId ? players[focusId] : undefined;
  const dragRole = drag ? posFromXY(drag.x, drag.y) : null;
  const selRole = sel?.kind === 'pitch' ? posFromXY(slots[sel.i].x, slots[sel.i].y) : null;

  return (
    <div className="board">
      <div className="pitch" ref={pitchRef}>
        {focus && (
          <div className="apt-overlay">
            {POSITIONS.map((pos) => {
              const z = POS_ZONE[pos];
              const lv = pos === focus.position ? 3 : focus.aptitudes[pos] ?? 0;
              const r = ratingAt(focus, pos);
              return (
                <div
                  key={pos}
                  className={'apt-zone' + (dragRole === pos ? ' cur' : '')}
                  style={{ left: `${z.x}%`, width: `${z.w}%`, bottom: `${toBottom(z.y)}%`, height: `${z.h * 0.86}%`, background: APT_COLOR[lv] }}
                >
                  <span>{pos}</span>
                  <b style={{ color: lv ? '#fff' : '#ffffff99' }}>{r}</b>
                </div>
              );
            })}
          </div>
        )}
        {slots.map((s, i) => {
          const p = players[lineup[i]];
          const isDrag = drag?.i === i;
          const pos = isDrag ? posFromXY(drag.x, drag.y) : posFromXY(s.x, s.y);
          const x = isDrag ? drag.x : s.x;
          const y = isDrag ? drag.y : s.y;
          if (!p) {
            return (
              <div key={i} className="pitch-player empty" style={{ left: `${x}%`, bottom: `${toBottom(y)}%` }}>
                <span className="pp-pos">{pos}</span>
              </div>
            );
          }
          const r = ratingAt(p, pos);
          const lv = p.position === pos ? 3 : p.aptitudes[pos] ?? 0;
          const en = energy?.[p.id];
          const isSel = sel?.kind === 'pitch' && sel.i === i;
          return (
            <div
              key={i}
              className={'pitch-player' + (isSel ? ' sel' : '') + (isDrag ? ' dragging' : '')}
              style={{ left: `${x}%`, bottom: `${toBottom(y)}%` }}
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                down.current = { i, cx: e.clientX, cy: e.clientY, moved: false };
              }}
              onPointerMove={(e) => {
                const d = down.current;
                if (!d || d.i !== i) return;
                if (!d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 8) return;
                d.moved = true;
                const pt = toPitch(e.clientX, e.clientY);
                setDrag({ i, ...pt });
              }}
              onPointerUp={(e) => {
                const d = down.current;
                down.current = null;
                if (!d) return;
                if (d.moved) {
                  const pt = toPitch(e.clientX, e.clientY);
                  setDrag(null);
                  setSel(null);
                  onSlotMove(i, pt.x, pt.y);
                } else tap({ kind: 'pitch', i }, p.id);
              }}
              onPointerCancel={() => {
                down.current = null;
                setDrag(null);
              }}
            >
              <div className="pp-icon">
                <PlayerIcon p={p} team={team} size={34} />
                <span className="pp-cond">
                  <CondArrow c={p.condition} size={15} />
                </span>
                {(p.injury > 0 || injured?.includes(p.id)) && <span className="pp-inj">✚</span>}
              </div>
              <span className="pp-name">{p.name}</span>
              <span className={'pp-pos' + (lv === 0 ? ' off' : '')}>
                {pos} <b style={{ color: statColor(r) }}>{r}</b>
                {!styleActive(p.style, pos) && <i className="mujirushi">無印</i>}
              </span>
              {en !== undefined && (
                <span className="pp-energy">
                  <i style={{ width: `${en}%`, background: en > 60 ? '#3ccb5a' : en > 35 ? '#f2d43d' : '#e5484d' }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="hint center">
        {sel ? '入れ替える選手をタップ（同じ選手をもう一度タップで詳細）' : props.hint ?? '選手をドラッグで好きな位置へ。タップで適性ポジションを表示'}
      </p>

      <h3 className="section-title">
        {props.benchLabel ?? 'ベンチ'}（{bench.length}）
      </h3>
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
              rating={selRole ? ratingAt(p, selRole) : undefined}
              ratingPos={selRole ?? undefined}
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
                  rating={selRole ? ratingAt(p, selRole) : undefined}
                  ratingPos={selRole ?? undefined}
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

function sameLoc(a: Loc, b: Loc) {
  if (a.kind !== b.kind) return false;
  return a.kind === 'pitch' ? a.i === (b as { i: number }).i : a.id === (b as { id: string }).id;
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
        {p.skills.includes('superSub') && <span className="badge-supersub">スーパーサブ</span>}
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

export function lastName(p: Player): string {
  const parts = p.name.split('・');
  const n = parts[parts.length - 1];
  return n.length > 8 ? n.slice(0, 8) : n;
}
