import { useState } from 'react';
import { Crest, RepStars, Sheet, SpiritGauge } from '../components/ui';
import { unreadCount } from '../game/mail';
import { InboxList } from './Inbox';
import { plTable, windowStatus } from '../game/competitions';
import { fmtMoney } from '../game/economy';
import { createMatch, sidePower } from '../game/engine';
import { endSeason, isSeasonOver, playDay, prepareDay, teamById, today, userFixture, userPayroll, type SeasonSummary } from '../game/season';
import { useGame } from '../store';
import { isDerby, isRival } from '../game/events';

export function Home({ onPreMatch }: { onPreMatch: () => void }) {
  const { state, update, toast } = useGame();
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const team = teamById(state, state.userTeamId);
  const tbl = plTable(state);
  const rankIdx = tbl.findIndex((r) => r.teamId === team.id);
  const row = tbl[rankIdx];
  const over = isSeasonOver(state);
  const day = today(state);
  const fx = over ? undefined : userFixture(state);
  const w = windowStatus(state);
  const { total, cap } = userPayroll(state);
  const unread = unreadCount(state);

  const skipDay = () => {
    setBusy(true);
    setTimeout(() => {
      update((d) => {
        prepareDay(d);
        playDay(d);
      });
      setBusy(false);
    }, 20);
  };

  return (
    <div className="screen">
      <div className="club-card" style={{ background: `linear-gradient(135deg, ${team.color}, #0b1410 85%)` }}>
        <Crest team={team} size={56} />
        <div className="grow">
          <div className="club-name">{team.name}</div>
          <div className="club-sub">
            {state.managerName}監督 · シーズン{state.season} · <RepStars rep={team.rep} />
          </div>
        </div>
        <div className="club-rank">
          <small>順位</small>
          <b>{row.played ? rankIdx + 1 : '-'}</b>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <small>移籍資金</small>
          <b className={state.money < 0 ? 'neg' : ''}>{fmtMoney(state.money)}</b>
        </div>
        <div className="kpi">
          <small>リーグ成績</small>
          <b>
            {row.win}勝{row.draw}分{row.loss}敗
          </b>
        </div>
        <div className="kpi">
          <small>年俸総額 / 上限</small>
          <b className={total > cap ? 'neg' : ''}>
            {fmtMoney(total)}
            <small className="muted"> / {fmtMoney(cap)}</small>
          </b>
        </div>
      </div>
      <div className="card tight">
        <SpiritGauge v={team.spirit} />
      </div>

      <div className={'window-banner' + (w.open ? ' open' : '')}>
        <b>{w.open ? `🔓 ${w.label} OPEN` : '🔒 移籍市場 CLOSED'}</b>
        <span>{w.open ? (w.remaining ? `あと${w.remaining}節で閉まります` : '') : w.label}</span>
        {state.offers.length > 0 && <span className="offer-pill">オファー {state.offers.length}件</span>}
      </div>

      {over ? (
        <div className="card next-match">
          <h3>シーズン{state.season} 全日程終了</h3>
          <p>最終順位 {rankIdx + 1}位。シーズンを締めくくり、次のシーズンへ進みましょう。</p>
          <button
            className="btn primary big"
            onClick={() => {
              const s = update((d) => endSeason(d));
              setSummary(s);
            }}
          >
            シーズン終了処理へ
          </button>
        </div>
      ) : fx ? (
        <NextMatch fixtureId={fx.id} label={day.label} onPlay={onPreMatch} />
      ) : (
        <div className="card next-match">
          <small className="muted">{day.label}</small>
          <p>この日程に自クラブの試合はありません。</p>
          <button className="btn primary big" disabled={busy} onClick={skipDay}>
            {busy ? '進行中…' : '次の日程へ進む'}
          </button>
        </div>
      )}

      <h3 className="section-title">
        受信箱{unread > 0 && <span className="unread-pill">{unread}件の未読</span>}
      </h3>
      <InboxList limit={30} />

      {summary && (
        <Sheet title={`シーズン${state.season - 1} 総括`} onClose={() => setSummary(null)}>
          <div className="summary">
            <div className="summary-rank">
              <small>プレミアリーグ最終順位</small>
              <b>{summary.rank}位</b>
              <span>優勝：{summary.champion}</span>
              <span>CL：{summary.userCl}{summary.clWinner ? `（優勝 ${summary.clWinner}）` : ''}</span>
            </div>
            <div className="ledger">
              <div>
                リーグ分配金 <b className="pos-num">+{fmtMoney(summary.prize)}</b>
              </div>
              <div>
                クラブの格 <b className={summary.repChange >= 0 ? 'pos-num' : 'neg'}>{summary.repChange >= 0 ? `+${summary.repChange}` : summary.repChange}</b>
              </div>
              <div>
                移籍資金 <b>{fmtMoney(state.money)}</b>
              </div>
            </div>
            {summary.grown.length > 0 && (
              <>
                <h4>能力の変化</h4>
                <ul className="growth-list">
                  {summary.grown.slice(0, 20).map((g) => (
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
            <button
              className="btn primary big"
              onClick={() => {
                setSummary(null);
                toast('夏の移籍市場がオープンしました');
              }}
            >
              シーズン{state.season}へ
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function NextMatch({ fixtureId, label, onPlay }: { fixtureId: string; label: string; onPlay: () => void }) {
  const { state } = useGame();
  const f = state.fixtures.find((x) => x.id === fixtureId)!;
  const home = teamById(state, f.home);
  const away = teamById(state, f.away);
  const m = createMatch(state, fixtureId);
  const sh = sidePower(state, m.home);
  const sa = sidePower(state, m.away);
  const bars: [string, number, number][] = [
    ['攻撃', sh.attack, sa.attack],
    ['中盤', sh.midfield, sa.midfield],
    ['守備', sh.defense, sa.defense],
  ];
  const leg = f.leg ? `（第${f.leg}戦）` : '';
  return (
    <div className="card next-match">
      <div className="row between">
        <span className={'comp-badge comp-' + f.comp}>{f.comp === 'PL' ? 'Premier League' : 'Champions League'}</span>
        <small className="muted">
          {label}
          {leg}
        </small>
      </div>
      {(() => {
        const opp = f.home === state.userTeamId ? away : home;
        const tags = [isRival(state, opp.id) && '🔥 因縁の相手', isDerby(home.id, away.id) && '⚔️ ダービー'].filter(Boolean);
        return tags.length ? <div className="match-tags">{tags.map((t) => <span key={String(t)} className="chip hot">{t}</span>)}</div> : null;
      })()}
      <div className="versus">
        <div className="vs-team">
          <Crest team={home} size={48} />
          <span className="vs-name">{home.name}</span>
        </div>
        <b className="vs">VS</b>
        <div className="vs-team">
          <Crest team={away} size={48} />
          <span className="vs-name">{away.name}</span>
        </div>
      </div>
      <div className="compare">
        {bars.map(([lb, a, b]) => (
          <div key={lb} className="compare-row">
            <span>{Math.round(a)}</span>
            <div className="compare-bar">
              <div style={{ width: `${(a / (a + b)) * 100}%`, background: home.color }} />
              <div style={{ width: `${(b / (a + b)) * 100}%`, background: away.color }} />
            </div>
            <span>{Math.round(b)}</span>
            <small>{lb}</small>
          </div>
        ))}
      </div>
      <button className="btn primary big" onClick={onPlay}>
        試合へ（メンバー確認）
      </button>
    </div>
  );
}
