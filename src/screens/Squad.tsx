import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Ovr, PlayerRow, PosTag, fmtP } from '../components/ui';
import { autoLineup, FORMATIONS, overall, ratingAt } from '../game/rating';
import { fixUserLineup, squadOf } from '../game/season';
import type { Formation } from '../game/types';
import { useGame } from '../store';

export function Squad() {
  const { state, update, openPlayer } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  const squad = squadOf(state, team.id);
  const slots = FORMATIONS[team.formation];
  const [sel, setSel] = useState<number | null>(null);
  const bench = squad.filter((p) => !team.lineup.includes(p.id)).sort((a, b) => overall(b) - overall(a));

  const setFormation = (f: Formation) =>
    update((d) => {
      const t = d.teams.find((x) => x.id === d.userTeamId)!;
      t.formation = f;
      fixUserLineup(d);
    });

  const swap = (slotIdx: number, playerId: string) =>
    update((d) => {
      const t = d.teams.find((x) => x.id === d.userTeamId)!;
      const other = t.lineup.indexOf(playerId);
      if (other >= 0) t.lineup[other] = t.lineup[slotIdx];
      t.lineup[slotIdx] = playerId;
    });

  return (
    <div className="screen">
      <div className="row between">
        <h2 className="screen-title">チーム編成</h2>
        <button
          className="btn small"
          onClick={() =>
            update((d) => {
              const t = d.teams.find((x) => x.id === d.userTeamId)!;
              t.lineup = autoLineup(squadOf(d, t.id), t.formation);
            })
          }
        >
          おまかせ
        </button>
      </div>
      <div className="seg scroll">
        {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
          <button key={f} className={team.formation === f ? 'on' : ''} onClick={() => setFormation(f)}>
            {f}
          </button>
        ))}
      </div>
      <p className="hint">選手をタップして選択 → 入れ替えたい選手をタップ。選択中にもう一度タップで詳細。</p>

      <div className="pitch">
        {slots.map((s, i) => {
          const p = state.players[team.lineup[i]];
          if (!p) return null;
          const r = ratingAt(p, s.pos);
          const off = p.position !== s.pos;
          return (
            <button
              key={i}
              className={'pitch-player' + (sel === i ? ' sel' : '')}
              style={{ left: `${s.x}%`, bottom: `${1 + s.y * 0.82}%` }}
              onClick={() => {
                if (sel === null) setSel(i);
                else if (sel === i) {
                  openPlayer(p.id);
                  setSel(null);
                } else {
                  swap(sel, p.id);
                  setSel(null);
                }
              }}
            >
              <Avatar a={p.appearance} color={team.color} color2={team.color2} number={p.number} size={38} />
              <span className="pp-name">{p.name.split('・').pop()}</span>
              <span className={'pp-pos' + (off ? ' off' : '')}>
                {s.pos} {r}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="section-title">
        控え（{bench.length}人） · 全{squad.length}人 · 年俸計 {fmtP(squad.reduce((a, p) => a + p.salary, 0))}
      </h3>
      <div className="list">
        {bench.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            team={team}
            highlight={sel !== null}
            onClick={() => {
              if (sel !== null) {
                swap(sel, p.id);
                setSel(null);
              } else openPlayer(p.id);
            }}
            right={
              <div className="right-stack">
                <Ovr v={overall(p)} />
                {sel !== null && (
                  <small>
                    <PosTag pos={slots[sel].pos} /> {ratingAt(p, slots[sel].pos)}
                  </small>
                )}
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
