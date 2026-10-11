import { useState } from 'react';
import { Crest } from '../components/ui';
import { standings, totalRounds } from '../game/season';
import { useGame } from '../store';

export function League() {
  const { state, openPlayer } = useGame();
  const [tab, setTab] = useState<'table' | 'fixtures' | 'scorers' | 'history'>('table');
  const teams = Object.fromEntries(state.teams.map((t) => [t.id, t]));
  const [round, setRound] = useState(Math.min(state.round, totalRounds(state) - 1));

  return (
    <div className="screen">
      <h2 className="screen-title">リーグ · シーズン{state.season}</h2>
      <div className="seg">
        <button className={tab === 'table' ? 'on' : ''} onClick={() => setTab('table')}>
          順位表
        </button>
        <button className={tab === 'fixtures' ? 'on' : ''} onClick={() => setTab('fixtures')}>
          日程
        </button>
        <button className={tab === 'scorers' ? 'on' : ''} onClick={() => setTab('scorers')}>
          得点王
        </button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          歴代
        </button>
      </div>

      {tab === 'table' && (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th className="left">クラブ</th>
              <th>試</th>
              <th>勝</th>
              <th>分</th>
              <th>敗</th>
              <th>差</th>
              <th>点</th>
            </tr>
          </thead>
          <tbody>
            {standings(state).map((r, i) => {
              const t = teams[r.teamId];
              return (
                <tr key={r.teamId} className={r.teamId === state.userTeamId ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td className="left">
                    <span className="tcell">
                      <Crest team={t} size={20} /> {t.short}
                    </span>
                  </td>
                  <td>{r.played}</td>
                  <td>{r.win}</td>
                  <td>{r.draw}</td>
                  <td>{r.loss}</td>
                  <td>{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
                  <td>
                    <b>{r.points}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {tab === 'fixtures' && (
        <>
          <div className="row between">
            <button className="btn small" disabled={round <= 0} onClick={() => setRound(round - 1)}>
              ◀
            </button>
            <b>第{round + 1}節</b>
            <button className="btn small" disabled={round >= totalRounds(state) - 1} onClick={() => setRound(round + 1)}>
              ▶
            </button>
          </div>
          <div className="card">
            {state.fixtures
              .filter((f) => f.round === round)
              .map((f, i) => (
                <div key={i} className={'fixture' + (f.home === state.userTeamId || f.away === state.userTeamId ? ' me' : '')}>
                  <span className="tcell right">
                    {teams[f.home].short} <Crest team={teams[f.home]} size={20} />
                  </span>
                  <b>{f.result ? `${f.result.home} - ${f.result.away}` : 'vs'}</b>
                  <span className="tcell">
                    <Crest team={teams[f.away]} size={20} /> {teams[f.away].short}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {tab === 'scorers' && (
        <div className="card">
          {Object.values(state.players)
            .filter((p) => p.season.goals > 0)
            .sort((a, b) => b.season.goals - a.season.goals || b.season.assists - a.season.assists)
            .slice(0, 20)
            .map((p, i) => (
              <button key={p.id} className="scorer" onClick={() => openPlayer(p.id)}>
                <span>{i + 1}</span>
                <span className="grow left">
                  {p.name} <small className="muted">{p.teamId ? teams[p.teamId]?.short : ''}</small>
                </span>
                <b>{p.season.goals}G</b>
                <small>{p.season.assists}A</small>
              </button>
            ))}
          {!Object.values(state.players).some((p) => p.season.goals > 0) && <p className="muted center">まだ得点がありません</p>}
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          {state.history.length === 0 && <p className="muted center">シーズンを終えると記録されます</p>}
          {[...state.history].reverse().map((h) => (
            <div key={h.season} className="fixture">
              <span>シーズン{h.season}</span>
              <b>{h.rank}位</b>
              <span className="muted">優勝 {h.champion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
