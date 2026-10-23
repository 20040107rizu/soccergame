import { useState } from 'react';
import { Crest, Seg } from '../components/ui';
import { clLeagueTable, plTable, STAGE_LABEL, type TableRow } from '../game/competitions';
import type { CLStage, Fixture, Team } from '../game/types';
import { useGame } from '../store';
import { Ranking } from './Ranking';
import { WorldCupView } from './WorldCup';

type Comp = 'PL' | 'CL' | 'wc' | 'history' | 'friends';

export function seasonLabel(season: number): string {
  const y = 2025 + season;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

export function Competitions() {
  const { state } = useGame();
  const [comp, setComp] = useState<Comp>('PL');
  const [tab, setTab] = useState<'table' | 'fixtures' | 'scorers' | 'ko'>('table');
  const teams = Object.fromEntries(state.teams.map((t) => [t.id, t]));

  return (
    <div className="screen">
      <h2 className="screen-title">大会 · {seasonLabel(state.season)}</h2>
      <Seg
        value={comp}
        onChange={(c) => {
          setComp(c);
          setTab('table');
        }}
        options={[
          { v: 'PL', label: 'プレミアリーグ' },
          { v: 'CL', label: 'チャンピオンズL' },
          ...(state.worldCup || state.wcHistory?.length ? [{ v: 'wc' as Comp, label: '🌍 W杯' }] : []),
          { v: 'history', label: '歴代' },
          { v: 'friends', label: 'フレンド' },
        ]}
      />
      {comp === 'friends' && <Ranking />}
      {comp === 'wc' && (
        <>
          {state.worldCup && <WorldCupView wc={state.worldCup} />}
          {!!state.wcHistory?.length && (
            <>
              <h3 className="section-title">歴代のワールドカップ</h3>
              <div className="card">
                {[...state.wcHistory].reverse().map((h) => (
                  <div key={h.season} className="wc-hist">
                    <b>
                      {2026 + h.season} · 🏆 {h.champion}
                    </b>
                    <small className="muted">
                      準優勝 {h.runnerUp}
                      {h.mvp ? ` · MVP ${h.mvp.name}（${h.mvp.nation}）` : ''}
                      {h.topScorer ? ` · 得点王 ${h.topScorer.name}（${h.topScorer.goals}点）` : ''}
                      {h.coach ? ` · あなたの${h.coach}は${h.coachResult}` : ''}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {comp !== 'history' && comp !== 'friends' && comp !== 'wc' && (
        <Seg
          small
          value={tab}
          onChange={setTab}
          options={
            comp === 'PL'
              ? [
                  { v: 'table', label: '順位表' },
                  { v: 'fixtures', label: '日程・結果' },
                  { v: 'scorers', label: '得点ランキング' },
                ]
              : [
                  { v: 'table', label: 'リーグフェーズ' },
                  { v: 'fixtures', label: '日程・結果' },
                  { v: 'ko', label: '決勝トーナメント' },
                  { v: 'scorers', label: '得点' },
                ]
          }
        />
      )}

      {comp === 'PL' && tab === 'table' && <Table rows={plTable(state)} teams={teams} me={state.userTeamId} zones={(i) => (i < 5 ? 'cl' : i >= 17 ? 'rel' : '')} />}
      {comp === 'CL' && tab === 'table' && (
        <>
          {!state.clTeams.includes(state.userTeamId) && <p className="hint">今季、自クラブは CL に出場していません。プレミアリーグで 5 位以内に入ると来季出場できます。</p>}
          <Table rows={clLeagueTable(state)} teams={teams} me={state.userTeamId} zones={(i) => (i < 8 ? 'cl' : i < 24 ? 'po' : 'out')} />
          <p className="hint">1〜8位：ラウンド16へ / 9〜24位：プレーオフ / 25位以下：敗退</p>
        </>
      )}
      {tab === 'fixtures' && (comp === 'PL' || comp === 'CL') && <Fixtures comp={comp} teams={teams} />}
      {tab === 'scorers' && (comp === 'PL' || comp === 'CL') && <Scorers comp={comp} teams={teams} />}
      {comp === 'CL' && tab === 'ko' && <Knockout teams={teams} />}
      {comp === 'history' && (
        <div className="card">
          {state.history.length === 0 && <p className="muted center">シーズンを終えると記録されます</p>}
          {[...state.history].reverse().map((h) => (
            <div key={h.season} className="history-row">
              <b>シーズン{h.season}</b>
              <span>
                リーグ {h.rank}位 · CL {h.userCl ?? '—'}
              </span>
              <small className="muted">
                PL優勝 {h.champion}
                {h.clWinner ? ` / CL優勝 ${h.clWinner}` : ''}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Table({ rows, teams, me, zones }: { rows: TableRow[]; teams: Record<string, Team>; me: string; zones: (i: number) => string }) {
  return (
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
        {rows.map((r, i) => {
          const t = teams[r.teamId];
          if (!t) return null;
          return (
            <tr key={r.teamId} className={(r.teamId === me ? 'me ' : '') + 'z-' + zones(i)}>
              <td>{i + 1}</td>
              <td className="left">
                <span className="tcell">
                  <Crest team={t} size={20} /> <span className="tname">{t.name}</span>
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
  );
}

function Fixtures({ comp, teams }: { comp: 'PL' | 'CL'; teams: Record<string, Team> }) {
  const { state } = useGame();
  const days = state.calendar.map((d, i) => ({ d, i })).filter((x) => x.d.type === comp);
  const firstUnplayed = days.findIndex((x) => x.i >= state.day);
  const [idx, setIdx] = useState(Math.max(0, firstUnplayed === -1 ? days.length - 1 : firstUnplayed));
  const cur = days[Math.min(idx, days.length - 1)];
  const fs = state.fixtures.filter((f) => f.day === cur.i && f.comp === comp);
  const mine = fs.filter((f) => f.home === state.userTeamId || f.away === state.userTeamId);
  const others = fs.filter((f) => !mine.includes(f));
  return (
    <>
      <div className="row between">
        <button className="btn small" disabled={idx <= 0} onClick={() => setIdx(idx - 1)}>
          ◀
        </button>
        <b className="center">{cur.d.label}</b>
        <button className="btn small" disabled={idx >= days.length - 1} onClick={() => setIdx(idx + 1)}>
          ▶
        </button>
      </div>
      <div className="card">
        {fs.length === 0 && <p className="muted center">組み合わせ未定</p>}
        {[...mine, ...others].map((f) => (
          <FixtureRow key={f.id} f={f} teams={teams} me={state.userTeamId} />
        ))}
      </div>
    </>
  );
}

function FixtureRow({ f, teams, me }: { f: Fixture; teams: Record<string, Team>; me: string }) {
  const h = teams[f.home];
  const a = teams[f.away];
  if (!h || !a) return null;
  const r = f.result;
  return (
    <div className={'fixture' + (f.home === me || f.away === me ? ' me' : '')}>
      <span className="tcell right">
        <span className="tname">{h.name}</span> <Crest team={h} size={20} />
      </span>
      <b>
        {r ? `${r.home} - ${r.away}` : 'vs'}
        {r?.pkHome !== undefined && <small className="pk">PK {r.pkHome}-{r.pkAway}</small>}
      </b>
      <span className="tcell">
        <Crest team={a} size={20} /> <span className="tname">{a.name}</span>
      </span>
    </div>
  );
}

function Scorers({ comp, teams }: { comp: 'PL' | 'CL'; teams: Record<string, Team> }) {
  const { state, openPlayer } = useGame();
  const g = (p: { season: { goals: number; clGoals: number } }) => (comp === 'PL' ? p.season.goals : p.season.clGoals);
  const list = Object.values(state.players)
    .filter((p) => g(p) > 0)
    .sort((a, b) => g(b) - g(a) || b.season.assists - a.season.assists)
    .slice(0, 25);
  return (
    <div className="card">
      {list.length === 0 && <p className="muted center">まだ得点がありません</p>}
      {list.map((p, i) => (
        <button key={p.id} className="scorer" onClick={() => openPlayer(p.id)}>
          <span>{i + 1}</span>
          <span className="grow left">
            {p.name} <small className="muted">{p.teamId ? teams[p.teamId]?.name : ''}</small>
          </span>
          <b>{g(p)}G</b>
          {comp === 'PL' && <small>{p.season.assists}A</small>}
        </button>
      ))}
    </div>
  );
}

function Knockout({ teams }: { teams: Record<string, Team> }) {
  const { state } = useGame();
  const stages: CLStage[] = ['PO', 'R16', 'QF', 'SF', 'F'];
  const any = state.ties.length > 0;
  return (
    <div className="ko">
      {!any && <p className="muted center">リーグフェーズ終了後に組み合わせが決まります</p>}
      {stages.map((s) => {
        const ties = state.ties.filter((t) => t.stage === s);
        if (!ties.length) return null;
        return (
          <div key={s} className="card">
            <h4>{STAGE_LABEL[s]}</h4>
            {ties.map((t) => {
              const fs = state.fixtures.filter((f) => f.tieId === t.id);
              let ga = 0;
              let gb = 0;
              for (const f of fs) {
                if (!f.result) continue;
                if (f.home === t.a) {
                  ga += f.result.home;
                  gb += f.result.away;
                } else {
                  gb += f.result.home;
                  ga += f.result.away;
                }
              }
              const played = fs.some((f) => f.result);
              return (
                <div key={t.id} className={'tie' + (t.a === state.userTeamId || t.b === state.userTeamId ? ' me' : '')}>
                  <span className={'tcell right' + (t.winner === t.a ? ' win' : '')}>
                    <span className="tname">{teams[t.a]?.name}</span> <Crest team={teams[t.a]} size={18} />
                  </span>
                  <b>{played ? `${ga} - ${gb}` : 'vs'}</b>
                  <span className={'tcell' + (t.winner === t.b ? ' win' : '')}>
                    <Crest team={teams[t.b]} size={18} /> <span className="tname">{teams[t.b]?.name}</span>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
