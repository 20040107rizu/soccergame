import { useState } from 'react';
import { Crest, fmtP, Sheet } from '../components/ui';
import { teamStrength } from '../game/match';
import { endSeason, isSeasonOver, squadOf, standings, totalRounds, userFixture, type SeasonSummary } from '../game/season';
import { useGame } from '../store';

export function Home({ onPlayMatch }: { onPlayMatch: () => void }) {
  const { state, update } = useGame();
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  const table = standings(state);
  const rank = table.findIndex((r) => r.teamId === team.id) + 1;
  const row = table[rank - 1];
  const fx = userFixture(state);
  const over = isSeasonOver(state);
  const squad = squadOf(state, team.id);
  const payroll = squad.reduce((s, p) => s + p.salary, 0);
  const expiring = squad.filter((p) => p.contractYears <= 1).length;

  return (
    <div className="screen">
      <div className="club-card" style={{ background: `linear-gradient(135deg, ${team.color}, #0b1a12 85%)` }}>
        <Crest team={team} size={56} />
        <div className="grow">
          <div className="club-name">{team.name}</div>
          <div className="club-sub">
            {state.managerName}監督 · シーズン{state.season}
          </div>
        </div>
        <div className="club-rank">
          <small>順位</small>
          <b>{row.played ? rank : '-'}</b>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <small>ポイント</small>
          <b className={state.points < 0 ? 'neg' : ''}>{fmtP(state.points)}</b>
        </div>
        <div className="kpi">
          <small>成績</small>
          <b>
            {row.win}勝{row.draw}分{row.loss}敗
          </b>
        </div>
        <div className="kpi">
          <small>年俸総額/年</small>
          <b>{fmtP(payroll)}</b>
        </div>
      </div>

      {over ? (
        <div className="card next-match">
          <h3>シーズン{state.season} 全日程終了</h3>
          <p>最終順位 {rank}位。シーズンを締めくくり、次のシーズンへ進みましょう。</p>
          {expiring > 0 && <p className="warn">契約が今季で切れる選手が{expiring}人います。延長しないと退団します。</p>}
          <button className="btn primary big" onClick={() => setSummary(update((d) => endSeason(d)))}>
            シーズン終了処理へ
          </button>
        </div>
      ) : (
        fx && <NextMatch fixtureHome={fx.home} fixtureAway={fx.away} onPlay={onPlayMatch} />
      )}

      <h3 className="section-title">ニュース</h3>
      <div className="card news">
        {state.news.slice(0, 12).map((n) => (
          <div key={n.id} className="news-item">
            <small>
              S{n.season}
              {n.round > 0 ? ` 第${n.round}節後` : ''}
            </small>
            <span>{n.text}</span>
          </div>
        ))}
      </div>

      {summary && (
        <Sheet title={`シーズン${state.season - 1} 総括`} onClose={() => setSummary(null)}>
          <div className="summary">
            <div className="summary-rank">
              <small>最終順位</small>
              <b>{summary.rank}位</b>
              <span>優勝：{summary.champion}</span>
            </div>
            <div className="ledger">
              <div>
                順位ボーナス <b className="pos-num">+{fmtP(summary.bonus)}</b>
              </div>
              <div>
                年俸支払い <b className="neg">-{fmtP(summary.salaries)}</b>
              </div>
              <div>
                現在のポイント <b>{fmtP(state.points)}</b>
              </div>
            </div>
            {summary.grown.length > 0 && (
              <>
                <h4>能力の変化</h4>
                <ul className="growth-list">
                  {summary.grown.map((g) => (
                    <li key={g.name}>
                      {g.name} <b className={g.diff > 0 ? 'pos-num' : 'neg'}>{g.diff > 0 ? `+${g.diff}` : g.diff}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {summary.retired.length > 0 && <p>引退：{summary.retired.join('、')}</p>}
            {summary.left.length > 0 && <p>契約満了で退団：{summary.left.join('、')}</p>}
            {summary.promoted.length > 0 && <p>ユースから昇格：{summary.promoted.join('、')}</p>}
            <button className="btn primary big" onClick={() => setSummary(null)}>
              シーズン{state.season}へ
            </button>
          </div>
        </Sheet>
      )}
      <p className="muted center">
        全{totalRounds(state)}節 · 第{Math.min(state.round + 1, totalRounds(state))}節
      </p>
    </div>
  );
}

function NextMatch({ fixtureHome, fixtureAway, onPlay }: { fixtureHome: string; fixtureAway: string; onPlay: () => void }) {
  const { state } = useGame();
  const home = state.teams.find((t) => t.id === fixtureHome)!;
  const away = state.teams.find((t) => t.id === fixtureAway)!;
  const sh = teamStrength(home, state.players);
  const sa = teamStrength(away, state.players);
  const bars: [string, number, number][] = [
    ['攻撃', sh.attack, sa.attack],
    ['中盤', sh.midfield, sa.midfield],
    ['守備', sh.defense, sa.defense],
  ];
  return (
    <div className="card next-match">
      <small className="muted">第{state.round + 1}節 · 次の試合</small>
      <div className="versus">
        <div className="vs-team">
          <Crest team={home} size={48} />
          <span>{home.short}</span>
        </div>
        <b className="vs">VS</b>
        <div className="vs-team">
          <Crest team={away} size={48} />
          <span>{away.short}</span>
        </div>
      </div>
      <div className="compare">
        {bars.map(([label, a, b]) => (
          <div key={label} className="compare-row">
            <span>{Math.round(a)}</span>
            <div className="compare-bar">
              <div style={{ width: `${(a / (a + b)) * 100}%`, background: home.color }} />
              <div style={{ width: `${(b / (a + b)) * 100}%`, background: away.color }} />
            </div>
            <span>{Math.round(b)}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <button className="btn primary big" onClick={onPlay}>
        試合へ
      </button>
    </div>
  );
}
