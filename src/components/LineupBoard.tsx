import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Loc } from '../game/lineup';
import { POS_ZONE, posFromXY } from '../game/positions';
import { overall, ratingAt, styleActive } from '../game/stats';
import type { Player, Team } from '../game/types';
import { POSITIONS } from '../game/types';
import { CondArrow, PlayerIcon, PosTag, statColor } from './ui';

const toBottom = (y: number) => 2 + y * 0.86;
const fromBottom = (b: number) => (b - 2) / 0.86;

/** この時間押さえるとドラッグできる（それより早く縦に動かすと画面スクロール） */
const HOLD_MS = 200;
/** 長押しで選手詳細 */
const LONG_MS = 550;

type Press = {
  i: number;
  id: string;
  pointerId: number;
  cx: number;
  cy: number;
  armed: boolean;
  moved: boolean;
  long: boolean;
  timers: number[];
  /** 指の位置と選手の基準点（足元）のずれ */
  off: { x: number; y: number };
};

const APT_COLOR = ['rgba(255,255,255,0.05)', 'rgba(47,158,106,0.55)', 'rgba(242,179,61,0.6)', 'rgba(229,72,77,0.65)'];

/**
 * チーム編成ボード（チーム画面・試合前・試合中で共通）。
 * - タップ：選択してピッチ上に適性ヒートマップを表示（同じ選手をもう一度タップで解除）
 * - 長押し：選手詳細
 * - 少し押さえてからスライド：好きな位置へ移動（他の選手に重ねて離すと位置を入れ替え）
 *   すぐに縦へスライドした場合は画面のスクロールになる
 * - ピッチの選手を選択中にベンチの選手をタップで交代
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
  /** 見るだけ（フレンドのチームなど）：移動・入れ替えはできない */
  readOnly?: boolean;
}) {
  const { team, slots, lineup, bench, reserves, players, energy, injured, onMove, onSlotMove, onDetail } = props;
  const [sel, setSel] = useState<Loc | null>(null);
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null);
  const [armedI, setArmedI] = useState<number | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);

  // ドラッグ中だけ画面のスクロールを止める（非 passive で登録する必要がある）
  useEffect(() => {
    const el = pitchRef.current;
    if (!el) return;
    const h = (e: TouchEvent) => {
      if (press.current?.armed) e.preventDefault();
    };
    el.addEventListener('touchmove', h, { passive: false });
    return () => el.removeEventListener('touchmove', h);
  }, []);

  const tap = (loc: Loc) => {
    if (!sel) return setSel(loc);
    // 同じ選手をもう一度タップで解除
    if (sameLoc(sel, loc)) return setSel(null);
    // ピッチ同士は表示する選手の切り替え（入れ替えはドラッグで）
    if (sel.kind === 'pitch' && loc.kind === 'pitch') return setSel(loc);
    if (props.readOnly) return setSel(loc);
    onMove(sel, loc);
    setSel(null);
  };

  const anchorAt = (cx: number, cy: number, pr: Press) => {
    const pt = toPitch(cx, cy);
    return { x: Math.max(0, Math.min(100, pt.x - pr.off.x)), y: Math.max(0, Math.min(100, pt.y - pr.off.y)) };
  };

  const endPress = () => {
    const pr = press.current;
    if (pr) pr.timers.forEach((t) => clearTimeout(t));
    press.current = null;
    setArmedI(null);
    return pr;
  };

  /** ドロップ位置に重なっている他の選手 */
  const swapTargetAt = (pt: { x: number; y: number }, i: number): number => {
    let best = -1;
    let bestD = Infinity;
    slots.forEach((s, j) => {
      if (j === i || !players[lineup[j]]) return;
      const dx = Math.abs(s.x - pt.x);
      const dy = Math.abs(s.y - pt.y);
      if (dx < 9 && dy < 7 && dx + dy < bestD) {
        best = j;
        bestD = dx + dy;
      }
    });
    return best;
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>, i: number, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    endPress();
    const mouse = e.pointerType === 'mouse';
    const at = toPitch(e.clientX, e.clientY);
    const off = { x: at.x - slots[i].x, y: at.y - slots[i].y };
    const pr: Press = { i, id, pointerId: e.pointerId, cx: e.clientX, cy: e.clientY, armed: mouse, moved: false, long: false, timers: [], off };
    if (mouse) e.currentTarget.setPointerCapture?.(e.pointerId);
    pr.timers.push(
      window.setTimeout(() => {
        if (press.current !== pr || pr.moved) return;
        pr.armed = true;
        setArmedI(i);
      }, HOLD_MS),
      window.setTimeout(() => {
        if (press.current !== pr || pr.moved) return;
        pr.long = true;
        endPress();
        setSel(null);
        onDetail(id);
      }, LONG_MS),
    );
    press.current = pr;
  };

  const onMoveP = (e: RPointerEvent<HTMLDivElement>) => {
    const pr = press.current;
    if (!pr || pr.pointerId !== e.pointerId) return;
    const dx = e.clientX - pr.cx;
    const dy = e.clientY - pr.cy;
    if (!pr.moved && Math.hypot(dx, dy) < 8) return;
    if (props.readOnly) {
      endPress();
      return;
    }
    if (!pr.armed) {
      // 押してすぐ縦に動かした → 画面スクロール。横方向ならドラッグ
      if (Math.abs(dx) > Math.abs(dy) * 1.5) pr.armed = true;
      else {
        endPress();
        return;
      }
    }
    if (!pr.moved) {
      pr.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setDrag({ i: pr.i, ...anchorAt(e.clientX, e.clientY, pr) });
  };

  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const pr = press.current;
    if (!pr || pr.pointerId !== e.pointerId) return;
    endPress();
    if (pr.long) return;
    if (pr.moved) {
      const pt = anchorAt(e.clientX, e.clientY, pr);
      setDrag(null);
      setSel(null);
      const j = swapTargetAt(pt, pr.i);
      if (j >= 0) onMove({ kind: 'pitch', i: pr.i }, { kind: 'pitch', i: j });
      else onSlotMove(pr.i, pt.x, pt.y);
      return;
    }
    tap({ kind: 'pitch', i: pr.i });
  };

  const onCancel = () => {
    endPress();
    setDrag(null);
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
  const swapJ = drag ? swapTargetAt(drag, drag.i) : -1;
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
              className={'pitch-player' + (isSel ? ' sel' : '') + (isDrag ? ' dragging' : armedI === i ? ' armed' : '') + (swapJ === i ? ' swap-target' : '')}
              style={{ left: `${x}%`, bottom: `${toBottom(y)}%` }}
              onPointerDown={(e) => onDown(e, i, p.id)}
              onPointerMove={onMoveP}
              onPointerUp={onUp}
              onPointerCancel={onCancel}
              onContextMenu={(e) => e.preventDefault()}
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
        {sel
          ? props.readOnly
            ? '同じ選手をもう一度タップで解除 · 長押しで詳細'
            : 'ベンチの選手をタップで交代 · 同じ選手をもう一度タップで解除'
          : props.hint ?? 'タップで適性表示 · 長押しで詳細 · 少し押さえてからスライドで移動（他の選手に重ねると入れ替え）'}
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
              onClick={() => tap({ kind: 'bench', id })}
              onLong={() => onDetail(id)}
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
                  onClick={() => tap({ kind: 'res', id })}
                  onLong={() => onDetail(id)}
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

function BenchRow(props: { p: Player; team: Team; sel: boolean; hl: boolean; rating?: number; ratingPos?: string; energy?: number; onClick: () => void; onLong: () => void }) {
  const { p, team, sel, hl, rating, ratingPos, energy, onClick, onLong } = props;
  const ovr = overall(p);
  const lp = useLongPress(onLong, onClick);
  return (
    <button className={'bench-row' + (sel ? ' sel' : '') + (hl ? ' hl' : '')} {...lp}>
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

/** 長押しとタップを区別する（長押しで詳細） */
function useLongPress(onLong: () => void, onTap: () => void) {
  const st = useRef<{ t: number; x: number; y: number; fired: boolean } | null>(null);
  const clear = () => {
    if (st.current) clearTimeout(st.current.t);
  };
  return {
    onPointerDown: (e: RPointerEvent) => {
      clear();
      const s = { t: 0, x: e.clientX, y: e.clientY, fired: false };
      s.t = window.setTimeout(() => {
        s.fired = true;
        onLong();
      }, LONG_MS);
      st.current = s;
    },
    onPointerMove: (e: RPointerEvent) => {
      const s = st.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onClick: () => {
      const s = st.current;
      st.current = null;
      if (s?.fired) return;
      onTap();
    },
  };
}
