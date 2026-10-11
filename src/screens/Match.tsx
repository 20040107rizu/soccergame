import { useEffect, useMemo, useRef, useState } from 'react';
import { Crest } from '../components/ui';
import { simulateMatch, type MatchEvent, type MatchResult } from '../game/match';
import { playRound, userFixture } from '../game/season';
import { useGame } from '../store';

const SPEEDS = [
  { label: '×1', ms: 450 },
  { label: '×2', ms: 200 },
  { label: '×4', ms: 80 },
];

export function Match({ onExit }: { onExit: () => void }) {
  const { state, update, toast } = useGame();
  const fx = userFixture(state);
  // 試合結果は開始時に一度だけ計算し、時間に合わせて見せていく
  const result = useMemo<MatchResult | null>(() => (fx ? simulateMatch(state, fx.home, fx.away) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [minute, setMinute] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [ball, setBall] = useState({ x: 50, y: 50 });
  const [flash, setFlash] = useState<MatchEvent | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const finished = minute >= 91;

  useEffect(() => {
    if (finished || paused || !result) return;
    const t = setTimeout(() => {
      const next = minute + 1;
      setMinute(next);
      const evs = result.events.filter((e) => e.minute === next && e.side);
      const key = evs.find((e) => e.type === 'goal') ?? evs[0];
      if (key) {
        const toRight = key.side === 'home';
        const y = key.shotX ?? 50;
        if (key.type === 'goal') {
          setBall({ x: toRight ? 98 : 2, y: 50 });
          setFlash(key);
          setTimeout(() => setFlash(null), Math.max(900, SPEEDS[speed].ms * 4));
        } else {
          setBall({ x: toRight ? 86 : 14, y });
        }
      } else {
        setBall((b) => ({ x: clampN(b.x + (Math.random() - 0.5) * 30, 15, 85), y: clampN(b.y + (Math.random() - 0.5) * 30, 10, 90) }));
      }
    }, flash ? SPEEDS[speed].ms * 3 : SPEEDS[speed].ms);
    return () => clearTimeout(t);
  }, [minute, paused, speed, finished, result, flash]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [minute]);

  if (!fx || !result) {
    return (
      <div className="screen">
        <p>今節の試合はありません。</p>
        <button className="btn" onClick={onExit}>
          戻る
        </button>
      </div>
    );
  }

  const home = state.teams.find((t) => t.id === fx.home)!;
  const away = state.teams.find((t) => t.id === fx.away)!;
  const visible = finished ? result.events : result.events.filter((e) => e.minute <= minute && e.type !== 'full');
  const score = {
    home: visible.filter((e) => e.type === 'goal' && e.side === 'home').length,
    away: visible.filter((e) => e.type === 'goal' && e.side === 'away').length,
  };

  const commit = () => {
    if (done) return;
    setDone(true);
    const { income } = update((d) => playRound(d, result));
    toast(`試合収入 +${income}P`);
    onExit();
  };

  return (
    <div className="match">
      <div className="scoreboard">
        <div className="sb-team">
          <Crest team={home} size={34} />
          <span>{home.short}</span>
        </div>
        <div className="sb-score">
          <b>
            {score.home} - {score.away}
          </b>
          <small>{finished ? '試合終了' : minute <= 45 ? `前半 ${minute}'` : `後半 ${minute}'`}</small>
        </div>
        <div className="sb-team">
          <Crest team={away} size={34} />
          <span>{away.short}</span>
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

      <div className="match-controls">
        {SPEEDS.map((s, i) => (
          <button key={s.label} className={'chip' + (speed === i ? ' on' : '')} onClick={() => setSpeed(i)}>
            {s.label}
          </button>
        ))}
        <button className="chip" onClick={() => setPaused((p) => !p)} disabled={finished}>
          {paused ? '▶ 再開' : '❚❚ 一時停止'}
        </button>
        <button className="chip" onClick={() => setMinute(91)} disabled={finished}>
          結果へ ⏭
        </button>
      </div>

      <div className="commentary" ref={logRef}>
        {[...visible].reverse().map((e, i) => (
          <div key={i} className={`cm cm-${e.type} ${e.side ? 'cm-' + e.side : ''}`}>
            <span className="cm-min">{e.minute}'</span>
            {e.side && <span className="cm-dot" style={{ background: e.side === 'home' ? home.color : away.color }} />}
            <span>{e.text}</span>
          </div>
        ))}
      </div>

      {finished && (
        <div className="match-footer">
          <button className="btn primary big" onClick={commit} disabled={done}>
            結果を確定して戻る
          </button>
        </div>
      )}
    </div>
  );
}

function clampN(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
