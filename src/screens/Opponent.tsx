import { useState } from 'react';
import { LineupBoard } from '../components/LineupBoard';
import { Crest, Sheet, SpiritGauge } from '../components/ui';
import { plTable } from '../game/competitions';
import { createMatch, sideRoles, type SideState } from '../game/engine';
import { teamById, userFixture } from '../game/season';
import { ratingAt } from '../game/stats';
import type { GameState, Player, Position } from '../game/types';
import { FriendPlayer } from './Ranking';
import { TACTIC_OPTIONS } from './Squad';

/** 対戦相手のゲームプランとスカッド（スタメン〜控え） */
export function OpponentSheet({ state, side, comp, phase, onClose }: { state: GameState; side: SideState; comp: 'PL' | 'CL' | 'friendly'; phase: string; onClose: () => void }) {
  const [detail, setDetail] = useState<string | null>(null);
  const team = teamById(state, side.teamId);
  const roles = sideRoles(side);
  const xi = side.lineup.map((id, i) => (id ? { p: state.players[id], pos: roles[i] } : null)).filter((x) => x && x.p) as { p: Player; pos: Position }[];
  const avg = xi.length ? Math.round(xi.reduce((a, x) => a + ratingAt(x.p, x.pos), 0) / xi.length) : 0;
  const tactic = TACTIC_OPTIONS.find((t) => t.v === side.tactic)?.label ?? side.tactic;
  const row = comp !== 'friendly' ? plTable(state).findIndex((r) => r.teamId === team.id) : -1;
  const rec = row >= 0 ? plTable(state)[row] : null;
  const p = detail ? state.players[detail] : null;
  return (
    <Sheet title="相手チーム" onClose={onClose} full>
      <div className="friend-plan card">
        <div className="row gap">
          <Crest team={team} size={40} />
          <div className="grow">
            <b>{team.name}</b>
            <div className="small muted">
              {rec ? `プレミアリーグ ${row + 1}位（${rec.win}勝${rec.draw}分${rec.loss}敗・勝ち点${rec.points}）` : comp === 'friendly' ? '親善試合' : comp === 'CL' ? 'チャンピオンズリーグ' : ''}
              {' · '}
              {phase}
            </div>
          </div>
        </div>
        <div className="plan-grid">
          <div>
            <small>フォーメーション</small>
            <b>{side.formation}</b>
          </div>
          <div>
            <small>作戦</small>
            <b>{tactic}</b>
          </div>
          <div>
            <small>スタメン平均</small>
            <b>{avg}</b>
          </div>
        </div>
        <SpiritGauge v={side.spirit} />
        {side.subsUsed > 0 && <p className="hint">交代 {side.subsUsed}人（ピッチには今出ている選手を表示）</p>}
      </div>
      <LineupBoard
        team={team}
        slots={side.slots}
        lineup={side.lineup}
        bench={side.bench}
        players={state.players}
        energy={side.energy}
        injured={side.injured}
        onMove={() => {}}
        onSlotMove={() => {}}
        onDetail={setDetail}
        benchLabel="控え"
        hint="タップで適性表示 · 長押しで選手詳細"
        readOnly
      />
      {p && <FriendPlayer p={p} team={team} onClose={() => setDetail(null)} />}
    </Sheet>
  );
}


/** 試合前：相手の予想スタメン（自分のセーブには書き込まない） */
export function PrematchOpponent({ state, onClose }: { state: GameState; onClose: () => void }) {
  const [preview] = useState(() => {
    const fx = userFixture(state);
    if (!fx) return null;
    const temp: GameState = structuredClone(state);
    const m = createMatch(temp, fx.id);
    return { temp, side: m.home.teamId === temp.userTeamId ? m.away : m.home, comp: m.comp };
  });
  if (!preview) return null;
  return <OpponentSheet state={preview.temp} side={preview.side} comp={preview.comp} phase="予想スタメン" onClose={onClose} />;
}
