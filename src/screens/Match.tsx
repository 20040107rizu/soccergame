import { useEffect, useRef, useState } from 'react';
import { LineupBoard } from '../components/LineupBoard';
import { Crest, PosTag, Seg, Sheet, SpiritGauge } from '../components/ui';
import { createMatch, MAX_SUBS, moveSideSlot, setFormation, setTactic, sideRoles, startSecondHalf, stepMinute, substitute, swapSlots, type LiveMatch, type MatchEvent, type SideKey } from '../game/engine';
import { fmtMoney } from '../game/economy';
import { FORMATION_LIST } from '../game/positions';
import { playDay, teamById, userFixture } from '../game/season';
import type { Formation, GameState, Tactic } from '../game/types';
import { useGame } from '../store';
import { TACTIC_OPTIONS } from './Squad';
import { OpponentSheet } from './Opponent';

const SPEEDS = [
  { label: '×1', ms: 420 },
  { label: '×2', ms: 190 },
  { label: '×4', ms: 70 },
];

/** friendly：フレンドとの親善試合（一時的な状態で行い、セーブには書き込まない） */
export function Match({ onExit, friendly }: { onExit: () => void; friendly?: { state: GameState; match: LiveMatch; onEnd?: (gf: number, ga: number, m: LiveMatch) => void } }) {
  const { state: storeState, update, toast, openPlayer } = useGame();
  const state = friendly?.state ?? storeState;
  const mRef = useRef<LiveMatch>(friendly ? friendly.match : createMatch(state, userFixture(state)!.id));
  const m = mRef.current;
  const [, setTick] = useState(0);
  const rerender = () => setTick((x) => x + 1);
  const [speed, setSpeed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manage, setManage] = useState(false);
  const [ball, setBall] = useState({ x: 50, y: 50 });
  const [flash, setFlash] = useState<MatchEvent | null>(null);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [scout, setScout] = useState(false);
  const userKey: SideKey = m.home.teamId === state.userTeamId ? 'home' : 'away';
  const home = teamById(state, m.home.teamId);
  const away = teamById(state, m.away.teamId);

  useEffect(() => {
    if (!started || m.finished || m.halfTime || paused || manage || flash) return;
    const t = setTimeout(() => {
      const evs = stepMinute(state, m);
      const key = evs.find((e) => e.type === 'goal') ?? evs.find((e) => e.side && e.shotY !== undefined);
      if (key) {
        const toRight = key.side === 'home';
        if (key.type === 'goal') {
          setBall({ x: toRight ? 98 : 2, y: 50 });
          setFlash(key);
          setTimeout(() => setFlash(null), 1300);
        } else setBall({ x: toRight ? 86 : 14, y: key.shotY ?? 50 });
      } else {
        setBall((b) => ({ x: clampN(b.x + (Math.random() - 0.5) * 30, 15, 85), y: clampN(b.y + (Math.random() - 0.5) * 30, 10, 90) }));
      }
      if (m.attention || m.halfTime) setManage(true);
      rerender();
    }, SPEEDS[speed].ms);
    return () => clearTimeout(t);
  });

  const commit = () => {
    if (done) return;
    setDone(true);
    if (friendly) {
      const my = m.score[userKey];
      const opp = m.score[userKey === 'home' ? 'away' : 'home'];
      if (friendly.onEnd) friendly.onEnd(my, opp, m);
      else toast(`親善試合 ${my}-${opp} ${my > opp ? '勝利！' : my === opp ? '引き分け' : '敗戦…'}`);
      onExit();
      return;
    }
    const rep = update((d) => playDay(d, m));
    if (rep.userResult) toast(`試合終了 賞金 +${fmtMoney(rep.userResult.prize)}`);
    onExit();
  };

  const side = m[userKey];
  const visible = [...m.events].reverse();

  return (
    <div className="match">
      <div className="scoreboard">
        <div className="sb-team">
          <Crest team={home} size={30} />
          <span className="sb-name">{home.name}</span>
        </div>
        <div className="sb-score">
          <b>
            {m.score.home} - {m.score.away}
          </b>
          <small>{m.finished ? '試合終了' : !started ? 'キックオフ前' : m.halfTime ? 'ハーフタイム' : m.minute <= 45 ? `前半 ${m.minute}'` : `後半 ${m.minute}'`}</small>
        </div>
        <div className="sb-team right">
          <span className="sb-name">{away.name}</span>
          <Crest team={away} size={30} />
        </div>
      </div>

      <div className="mini-pitch">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none">
          <rect x="0" y="0" width="100" height="60" fill="#1f7a45" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={i * 20} y="0" width="10" height="60" fill="#23854c" />
          ))}
          <g stroke="#e8fff0" strokeWidth="0.5" fill="none" opacity="0.8">
            <rect x="1" y="1" width="98" height="58" />
            <line x1="50" y1="1" x2="50" y2="59" />
            <circle cx="50" cy="30" r="8" />
            <rect x="1" y="16" width="14" height="28" />
            <rect x="85" y="16" width="14" height="28" />
          </g>
          <rect x="0" y="25" width="1.5" height="10" fill={home.color} />
          <rect x="98.5" y="25" width="1.5" height="10" fill={away.color} />
        </svg>
        <div className="ball" style={{ left: `${ball.x}%`, top: `${ball.y}%`, transitionDuration: `${SPEEDS[speed].ms}ms` }} />
        {flash && (
          <div className="goal-flash" style={{ color: flash.side === 'home' ? home.color2 : away.color2, background: flash.side === 'home' ? home.color : away.color }}>
            GOAL!!
          </div>
        )}
      </div>

      {!started && (
        <div className="half-start">
          <button className="btn primary big" onClick={() => setStarted(true)}>
            前半キックオフ ▶
          </button>
          <button className="btn ghost" onClick={() => setManage(true)}>
            キックオフ前に采配を確認
          </button>
          <button className="btn ghost" onClick={() => setScout(true)}>
            🔍 相手チームを見る
          </button>
        </div>
      )}
      {m.halfTime && !manage && (
        <div className="half-start">
          <button
            className="btn primary big"
            onClick={() => {
              startSecondHalf(m);
              rerender();
            }}
          >
            後半キックオフ ▶
          </button>
          <button className="btn ghost" onClick={() => setManage(true)}>
            ハーフタイムの采配
          </button>
        </div>
      )}

      <div className="match-controls">
        {SPEEDS.map((s, i) => (
          <button key={s.label} className={'chip' + (speed === i ? ' on' : '')} onClick={() => setSpeed(i)}>
            {s.label}
          </button>
        ))}
        <button className="chip" onClick={() => setPaused((p) => !p)} disabled={m.finished}>
          {paused ? '▶ 再開' : '❚❚'}
        </button>
        <button className="chip" onClick={() => setScout(true)}>
          🔍 相手
        </button>
        <button className="chip accent" onClick={() => setManage(true)} disabled={m.finished}>
          采配（交代 {side.subsUsed}/{MAX_SUBS}）
        </button>
      </div>

      <div className="commentary">
        {visible.map((e, i) => (
          <div key={i} className={`cm cm-${e.type}`}>
            <span className="cm-min">{e.minute}'</span>
            {e.side && <span className="cm-dot" style={{ background: e.side === 'home' ? home.color : away.color }} />}
            <span>{e.text}</span>
          </div>
        ))}
      </div>

      {m.finished && (
        <div className="match-footer">
          <Ratings m={m} userKey={userKey} onDetail={openPlayer} />
          <button className="btn ghost" onClick={() => setScout(true)}>
            🔍 相手チームを見る
          </button>
          <button className="btn primary big" onClick={commit} disabled={done}>
            {friendly ? "親善試合を終える" : "結果を確定して戻る"}
          </button>
        </div>
      )}

      {scout && (
        <OpponentSheet
          state={state}
          side={m[userKey === 'home' ? 'away' : 'home']}
          comp={friendly ? 'friendly' : m.comp}
          phase={m.finished ? '試合終了時' : !started ? 'キックオフ前' : m.halfTime ? 'ハーフタイム' : `${m.minute}分時点`}
          onClose={() => setScout(false)}
        />
      )}

      {manage && !m.finished && (
        <Sheet
          title={`${m.halfTime ? 'ハーフタイム' : !started ? 'キックオフ前' : `${m.minute}'`} 采配（交代 残り${MAX_SUBS - side.subsUsed}）`}
          onClose={() => {
            m.attention = undefined;
            setManage(false);
          }}
          full
        >
          {m.attention && <div className="warn-box">{m.attention}</div>}
          <Seg
            scroll
            value={side.formation as Formation}
            options={[...FORMATION_LIST.map((f) => ({ v: f, label: f })), ...(side.formation === 'カスタム' ? [{ v: 'カスタム' as Formation, label: 'カスタム' }] : [])]}
            onChange={(f: Formation) => {
              if ((f as string) === 'カスタム') return;
              setFormation(m, userKey, f);
              rerender();
            }}
          />
          <SpiritGauge v={side.spirit} />
          <div className="row gap">
            <span className="muted small">作戦</span>
            <Seg
              small
              value={side.tactic}
              options={TACTIC_OPTIONS}
              onChange={(v: Tactic) => {
                setTactic(m, userKey, v);
                rerender();
              }}
            />
          </div>
          <p className="hint">ピッチ上の選手同士をタップでポジション入れ替え（交代枠は使いません）。ピッチの選手 → ベンチの選手で交代。</p>
          <LineupBoard
            team={teamById(state, side.teamId)}
            slots={side.slots}
            lineup={side.lineup}
            bench={side.bench}
            players={state.players}
            energy={side.energy}
            injured={side.injured}
            benchLabel="交代要員"
            onMove={(a, b) => {
              if (a.kind === 'pitch' && b.kind === 'pitch') swapSlots(m, userKey, a.i, b.i);
              else {
                const pitch = a.kind === 'pitch' ? a : b.kind === 'pitch' ? b : null;
                const bench = a.kind === 'bench' ? a : b.kind === 'bench' ? b : null;
                if (pitch && bench) {
                  const outId = side.lineup[pitch.i];
                  if (!outId) return toast('退場者の枠には入れられません');
                  const isGkSlot = sideRoles(side)[pitch.i] === 'GK';
                  if (isGkSlot && state.players[bench.id].position !== 'GK' && !confirm('GK の枠に GK 以外の選手を入れますか？')) return;
                  if (!substitute(state, m, userKey, outId, bench.id)) toast('これ以上交代できません');
                }
              }
              rerender();
            }}
            onSlotMove={(i, x, y) => {
              moveSideSlot(m, userKey, i, x, y);
              rerender();
            }}
            hint="ドラッグで位置を変更・タップで適性表示。ピッチの選手 → 交代要員で交代（交代した選手は戻れません）"
            onDetail={openPlayer}
          />
          <button
            className="btn primary big"
            onClick={() => {
              m.attention = undefined;
              if (!started) setStarted(true);
              if (m.halfTime) startSecondHalf(m);
              setManage(false);
              setPaused(false);
            }}
          >
            {!started ? '前半キックオフ ▶' : m.halfTime ? '後半キックオフ ▶' : '試合再開 ▶'}
          </button>
        </Sheet>
      )}
    </div>
  );
}

function Ratings({ m, userKey, onDetail }: { m: LiveMatch; userKey: SideKey; onDetail: (id: string) => void }) {
  const { state } = useGame();
  const side = m[userKey];
  const ids = side.usedPlayers;
  const scorers = (id: string) => m.events.filter((e) => e.type === 'goal' && e.playerId === id).length;
  const assists = (id: string) => m.events.filter((e) => e.type === 'goal' && e.assistId === id).length;
  const best = [...ids].sort((a, b) => (m.ratings[b] ?? 6) - (m.ratings[a] ?? 6))[0];
  return (
    <div className="ratings">
      <h4>選手評価</h4>
      <div className="ratings-grid">
        {ids.map((id) => {
          const p = state.players[id];
          if (!p) return null;
          const r = m.ratings[id] ?? 6;
          return (
            <button key={id} className="rating-row" onClick={() => onDetail(id)}>
              <PosTag pos={p.position} />
              <span className="grow left">
                {p.name}
                {id === best && <span className="mom">MOM</span>}
                {scorers(id) > 0 && ` ⚽${scorers(id) > 1 ? '×' + scorers(id) : ''}`}
                {assists(id) > 0 && ` 🅰${assists(id) > 1 ? '×' + assists(id) : ''}`}
              </span>
              <b className={r >= 7 ? 'pos-num' : r < 6 ? 'neg' : ''}>{r.toFixed(1)}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function clampN(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
