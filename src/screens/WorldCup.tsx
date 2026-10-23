import { useState } from 'react';
import { LineupBoard } from '../components/LineupBoard';
import { Seg, Sheet } from '../components/ui';
import { simulateToEnd } from '../game/engine';
import { applyFormation, moveInTeam, moveSlot, repairLineup, setAutoLineup } from '../game/lineup';
import { FORMATION_LIST } from '../game/positions';
import type { Formation } from '../game/types';
import { answerWCOffer, closeWorldCup, coachFixture, coachMatch, coachResult, groupTable, playWCDay, teamRating, WC_DAYS, WC_STAGE_LABEL, wcPlayer, wcSquads, wcState, winnerOf, type WCFixture, type WorldCup } from '../game/worldcup';
import { TACTIC_OPTIONS } from './Squad';
import { useGame } from '../store';

const GROUP = 'ABCDEFGH';

function dayLabel(wc: WorldCup): string {
  if (wc.day < 3) return `グループリーグ 第${wc.day + 1}戦`;
  const f = wc.fixtures.find((x) => x.day === wc.day);
  return f ? WC_STAGE_LABEL[f.stage] : '';
}

/** ホーム画面：ワールドカップ開催中はクラブの試合の代わりにこれを出す */
export function WorldCupCard() {
  const { state, update, toast } = useGame();
  const [view, setView] = useState(false);
  const [squad, setSquad] = useState(false);
  const [busy, setBusy] = useState(false);
  const wc = state.worldCup!;
  const my = coachFixture(state);
  const run = (fn: () => void) => {
    setBusy(true);
    setTimeout(() => {
      fn();
      setBusy(false);
    }, 20);
  };

  return (
    <div className="card next-match wc-card">
      <div className="wc-head">
        <span className="wc-globe">🌍</span>
        <div>
          <b>ワールドカップ {2025 + wc.season + 1}</b>
          <small className="muted">32か国が世界一をかけて戦います</small>
        </div>
      </div>

      {wc.stage === 'offer' && (
        <>
          <p className="small">代表監督のオファーが届いています。引き受けると、その国の23人を率いて自分で采配できます。</p>
          {wc.offers!.map((n) => (
            <button key={n} className="btn wc-offer" onClick={() => update((d) => answerWCOffer(d, n))}>
              <b>{n}代表</b>
              <small className="muted">
                グループ{GROUP[wc.groups.findIndex((g) => g.includes(n))]} · 平均{teamRating(state, wc.teams[n])} · 出場国で{wc.nations.indexOf(n) + 1}番目の強さ
              </small>
            </button>
          ))}
          <button className="btn ghost" onClick={() => update((d) => answerWCOffer(d, null))}>
            断って観戦する
          </button>
        </>
      )}

      {wc.stage === 'play' && (
        <>
          <small className="muted">{dayLabel(wc)}</small>
          {wc.coach && <p className="small">あなたは{wc.coach}代表の監督です（{wc.day > 0 && !my && wc.fixtures.some((f) => f.day === wc.day) ? '敗退' : '戦い中'}）</p>}
          {my ? (
            <>
              <b className="wc-vs">
                {my.home} vs {my.away}
              </b>
              <div className="row gap">
                <button className="btn ghost" onClick={() => setSquad(true)}>
                  代表メンバー
                </button>
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() =>
                    run(() => {
                      const r = update((d) => {
                        const cm = coachMatch(d)!;
                        simulateToEnd(cm.state, cm.match);
                        const f = d.worldCup!.fixtures.find((x) => x.id === cm.match.fixtureId)!;
                        playWCDay(d, cm);
                        return f;
                      });
                      toast(scoreText(r));
                    })
                  }
                >
                  結果のみ
                </button>
                <button className="btn primary grow" onClick={() => window.dispatchEvent(new CustomEvent('start-wc'))}>
                  試合へ ▶
                </button>
              </div>
            </>
          ) : (
            <button className="btn primary big" disabled={busy} onClick={() => run(() => update((d) => playWCDay(d)))}>
              {busy ? '試合中…' : '次の試合日へ'}
            </button>
          )}
        </>
      )}

      {wc.stage === 'done' && (
        <>
          <div className="wc-champ">
            🏆 <b>{wc.champion}</b> が優勝！
          </div>
          <small className="muted">
            MVP {wcPlayer(state, wc.mvp ?? '')?.name ?? '-'} · 得点王 {wcPlayer(state, wc.topScorer ?? '')?.name ?? '-'}（{wc.goals[wc.topScorer ?? ''] ?? 0}点）
            {wc.coach ? ` · ${wc.coach}は${coachResult(wc, wc.coach)}` : ''}
          </small>
          <button className="btn primary big" onClick={() => update((d) => closeWorldCup(d))}>
            クラブに戻って新シーズンへ
          </button>
        </>
      )}

      {wc.stage !== 'offer' && (
        <button className="btn small ghost" onClick={() => setView(true)}>
          組み合わせ・結果を見る
        </button>
      )}
      {view && (
        <Sheet title="🌍 ワールドカップ" onClose={() => setView(false)} full>
          <WorldCupView wc={wc} />
        </Sheet>
      )}
      {squad && <NationSquad onClose={() => setSquad(false)} />}
    </div>
  );
}

function scoreText(f: WCFixture): string {
  const r = f.result!;
  return `${f.home} ${r.home}-${r.away}${r.pk ? `（PK ${r.pk[0]}-${r.pk[1]}）` : ''} ${f.away}`;
}

/** 組み合わせと結果 */
export function WorldCupView({ wc }: { wc: WorldCup }) {
  const [tab, setTab] = useState<'group' | 'ko'>(wc.day >= 3 ? 'ko' : 'group');
  return (
    <>
      <Seg
        small
        value={tab}
        onChange={setTab}
        options={[
          { v: 'group', label: 'グループリーグ' },
          { v: 'ko', label: '決勝トーナメント' },
        ]}
      />
      {tab === 'group' ? (
        <div className="wc-groups">
          {wc.groups.map((_, gi) => (
            <div key={gi} className="card wc-group">
              <b>グループ{GROUP[gi]}</b>
              {groupTable(wc, gi).map((r, i) => (
                <div key={r.nation} className={'wc-row' + (r.nation === wc.coach ? ' me' : '') + (i < 2 && r.played === 3 ? ' through' : '')}>
                  <span>{i + 1}</span>
                  <span className="grow">{r.nation}</span>
                  <span className="muted">
                    {r.win}勝{r.draw}分{r.loss}敗
                  </span>
                  <span className="muted">{r.gf - r.ga >= 0 ? '+' : ''}{r.gf - r.ga}</span>
                  <b>{r.points}</b>
                </div>
              ))}
              {wc.fixtures
                .filter((f) => f.group === gi && f.result)
                .map((f) => (
                  <small key={f.id} className="muted wc-res">
                    {scoreText(f)}
                  </small>
                ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="wc-ko">
          {(['R16', 'QF', 'SF', 'F'] as const).map((st) => {
            const fs = wc.fixtures.filter((f) => f.stage === st);
            return (
              <div key={st} className="card">
                <b>{WC_STAGE_LABEL[st]}</b>
                {fs.length ? (
                  fs.map((f) => (
                    <div key={f.id} className={'wc-ko-row' + (f.home === wc.coach || f.away === wc.coach ? ' me' : '')}>
                      <span className={'grow right' + (f.result && winnerOf(f) === f.home ? ' win' : '')}>{f.home}</span>
                      <b>{f.result ? `${f.result.home} - ${f.result.away}` : 'vs'}</b>
                      <span className={'grow' + (f.result && winnerOf(f) === f.away ? ' win' : '')}>{f.away}</span>
                      {f.result?.pk && <small className="muted">PK {f.result.pk[0]}-{f.result.pk[1]}</small>}
                    </div>
                  ))
                ) : (
                  <small className="muted">まだ決まっていません</small>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** 代表監督：メンバーとスタメン・フォーメーション・作戦 */
function NationSquad({ onClose }: { onClose: () => void }) {
  const { state, update, openPlayer } = useGame();
  const wc = state.worldCup!;
  const n = wc.coach!;
  const team = wc.teams[n];
  const st = wcState(state, [n], n);
  const reserves = wcSquads(wc)[n].filter((id) => !team.lineup.includes(id) && !team.bench.includes(id));
  const edit = (fn: (t: typeof team, s: typeof st) => void) =>
    update((d) => {
      const t = d.worldCup!.teams[n];
      fn(t, wcState(d, [n], n));
    });
  return (
    <Sheet title={`${n}代表（${WC_DAYS > wc.day ? dayLabel(wc) : ''}）`} onClose={onClose} full>
      <Seg
        scroll
        value={team.formation as Formation}
        options={FORMATION_LIST.map((f) => ({ v: f, label: f }))}
        onChange={(f: Formation) =>
          edit((t, s) => {
            applyFormation(t, f);
            repairLineup({ ...s, teams: [t] }, t);
          })
        }
      />
      <div className="row gap">
        <Seg small value={team.tactic} options={TACTIC_OPTIONS} onChange={(v) => edit((t) => (t.tactic = v))} />
        <button className="btn small" onClick={() => edit((t, s) => setAutoLineup({ ...s, teams: [t] }, t))}>
          おまかせ
        </button>
      </div>
      <LineupBoard
        team={team}
        slots={team.slots}
        lineup={team.lineup}
        bench={team.bench}
        reserves={reserves}
        players={st.players}
        onMove={(a, b) => edit((t) => moveInTeam(t, a, b))}
        onSlotMove={(i, x, y) => edit((t) => moveSlot(t, i, x, y))}
        onDetail={(id) => state.players[id] && openPlayer(id)}
      />
    </Sheet>
  );
}
