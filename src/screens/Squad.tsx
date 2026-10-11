import { LineupBoard } from '../components/LineupBoard';
import { Crest, Seg } from '../components/ui';
import { available, moveInTeam, repairLineup, setAutoLineup, squadOf } from '../game/lineup';
import { FORMATION_LIST } from '../game/positions';
import { teamById, today, userFixture } from '../game/season';
import { overall } from '../game/stats';
import type { Formation, Tactic } from '../game/types';
import { useGame } from '../store';

export const TACTIC_OPTIONS: { v: Tactic; label: string }[] = [
  { v: 'defense', label: '守備的' },
  { v: 'balance', label: 'バランス' },
  { v: 'attack', label: '攻撃的' },
];

/** チーム画面と試合前画面で共通の編成画面 */
export function Squad(props: { mode?: 'squad' | 'prematch'; onKickoff?: () => void; onQuick?: () => void; onBack?: () => void }) {
  const { state, update, openPlayer } = useGame();
  const team = teamById(state, state.userTeamId);
  const squad = squadOf(state, team.id);
  const reserves = squad
    .filter((p) => !team.lineup.includes(p.id) && !team.bench.includes(p.id))
    .sort((a, b) => overall(b) - overall(a))
    .map((p) => p.id);
  const prematch = props.mode === 'prematch';
  const fx = prematch ? userFixture(state) : undefined;
  const opp = fx ? teamById(state, fx.home === team.id ? fx.away : fx.home) : undefined;
  const unavailable = team.lineup.filter((id) => state.players[id] && !available(state.players[id]));

  return (
    <div className="screen">
      {prematch && fx && opp ? (
        <div className="prematch-head">
          <button className="icon-btn" onClick={props.onBack} aria-label="戻る">
            ←
          </button>
          <div className="grow">
            <small className="muted">{today(state).label}</small>
            <div className="row gap">
              <Crest team={team} size={26} /> <b>{team.short}</b> <span className="muted">vs</span> <Crest team={opp} size={26} /> <b>{opp.short}</b>
            </div>
          </div>
        </div>
      ) : (
        <div className="row between">
          <h2 className="screen-title">チーム編成</h2>
          <button className="btn small" onClick={() => update((d) => setAutoLineup(d, teamById(d, d.userTeamId)))}>
            おまかせ
          </button>
        </div>
      )}

      <Seg
        scroll
        value={team.formation}
        options={FORMATION_LIST.map((f) => ({ v: f, label: f }))}
        onChange={(f: Formation) =>
          update((d) => {
            const t = teamById(d, d.userTeamId);
            t.formation = f;
            repairLineup(d, t);
          })
        }
      />
      <div className="row gap">
        <span className="muted small">作戦</span>
        <Seg
          small
          value={team.tactic}
          options={TACTIC_OPTIONS}
          onChange={(v) =>
            update((d) => {
              teamById(d, d.userTeamId).tactic = v;
            })
          }
        />
      </div>

      {unavailable.length > 0 && (
        <div className="warn-box">
          出場できない選手（負傷・出場停止）がスタメンにいます。
          <button className="btn small" onClick={() => update((d) => repairLineup(d, teamById(d, d.userTeamId), true))}>
            自動で入れ替え
          </button>
        </div>
      )}

      <LineupBoard
        team={team}
        formation={team.formation}
        lineup={team.lineup}
        bench={team.bench}
        reserves={reserves}
        players={state.players}
        onMove={(a, b) => update((d) => moveInTeam(teamById(d, d.userTeamId), a, b))}
        onDetail={openPlayer}
      />

      {prematch && (
        <div className="prematch-actions">
          {prematch && (
            <button className="btn small ghost" onClick={() => update((d) => setAutoLineup(d, teamById(d, d.userTeamId)))}>
              おまかせ
            </button>
          )}
          <button className="btn ghost" onClick={props.onQuick}>
            結果のみ
          </button>
          <button className="btn primary grow" onClick={props.onKickoff}>
            キックオフ ▶
          </button>
        </div>
      )}
    </div>
  );
}
