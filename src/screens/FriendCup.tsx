import { useEffect, useState } from 'react';
import { claimCupPrize, cupPrizes, cupEntrants, missingCupRows, myCupWinCount, recordCupWin, runCup, weekDeadline, weekId, type CupGame, type CupRow } from '../game/cup';
import { archiveRow, cacheCup, DAILY_START, dayEnd, dayIndex, finishedCup, runDailyCup, type DailyCup } from '../game/cupDaily';
import { fmtMoney, round2 } from '../game/economy';
import { playerId, post, type RankingRow } from '../game/ranking';
import { useGame } from '../store';

const WEEKDAY = ['月', '火', '水', '木', '金', '土', '日'];

function left(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}日${h}時間` : h > 0 ? `${h}時間${m % 60}分` : `${m % 60}分`;
}

/** 画面に出す形（週1回の頃の大会と、毎日の大会で共通） */
interface CupView {
  week: number;
  names: Record<string, { nickname: string; club: string }>;
  table: CupRow[];
  days: { label: string; games: CupGame[]; done: boolean; final?: boolean }[];
  final?: CupGame;
  champion?: string;
  complete: boolean;
}

function fromDaily(r: DailyCup): CupView {
  const names: CupView['names'] = {};
  for (const e of r.entrants) names[e.key] = { nickname: e.nickname, club: e.club };
  let n = 0;
  return {
    week: r.week,
    names,
    table: r.table,
    final: r.final,
    champion: r.champion,
    complete: r.complete,
    days: r.days.map((d) => ({ label: d.final ? `${WEEKDAY[d.d]}曜 · 決勝` : `${WEEKDAY[d.d]}曜 · 第${++n}節`, games: d.games, done: d.done, final: d.final })),
  };
}

/** フレンドカップ：毎日24時に1節ずつ結果が出て、日曜24時の決勝で優勝が決まる */
export function FriendCup({ rows }: { rows: RankingRow[] }) {
  const { update, toast } = useGame();
  const me = playerId();
  const w = weekId();
  const [now] = useState(Date.now());
  const [live, setLive] = useState<CupView | null | undefined>(undefined);
  const [last, setLast] = useState<CupView | null | undefined>(undefined);

  // 試合の計算は少し時間がかかるので、画面を出してから行う
  useEffect(() => {
    const t = setTimeout(() => {
      // 今週
      if (w >= DAILY_START) {
        const r = runDailyCup(rows, w, now);
        setLive(r ? fromDaily(r) : null);
      } else setLive(null);
      // 先週
      const lw = w - 1;
      if (lw >= DAILY_START) {
        const { res, needArchive } = finishedCup(rows, lw, now);
        if (res) {
          cacheCup(res);
          if (needArchive) post(JSON.stringify(archiveRow(res)));
        }
        setLast(res ? fromDaily(res) : null);
      } else {
        const es = cupEntrants(rows, lw);
        if (es.length < 2) setLast(null);
        else {
          const r = runCup(es, lw);
          const names: CupView['names'] = {};
          for (const e of es) names[e.key] = { nickname: e.nickname, club: e.club };
          setLast({ week: lw, names, table: r.table, final: r.final, champion: r.champion, complete: true, days: [{ label: '総当たり', games: r.games, done: true }] });
        }
      }
    }, 30);
    return () => clearTimeout(t);
  }, [rows, w, now]);

  // 先週の結果：優勝・賞金を受け取る
  useEffect(() => {
    if (!last?.complete) return;
    const won = recordCupWin(last, me);
    const n = myCupWinCount();
    const prize = claimCupPrize(last, me);
    update((d) => {
      if ((d.counters?.fcup ?? 0) !== n) d.counters = { ...(d.counters ?? {}), fcup: n };
      if (prize) d.money = round2(d.money + prize);
    });
    if (won) toast(`🏆 フレンドカップ優勝！賞金 ${fmtMoney(prize)} を受け取りました`);
    else if (prize) toast(`フレンドカップの賞金 ${fmtMoney(prize)} を受け取りました`);
  }, [last]);

  const prizeLine = (
    <small className="muted">
      {cupPrizes(w)[0] > 30 && <b className="fcup-boost">🎉 今週は賞金{cupPrizes(w)[0] / 30}倍！ </b>}
      賞金：優勝 {fmtMoney(cupPrizes(w)[0])} · 準優勝 {fmtMoney(cupPrizes(w)[1])} · 3位 {fmtMoney(cupPrizes(w)[2])}
    </small>
  );

  return (
    <div className="fcup">
      {w >= DAILY_START ? (
        <>
          <div className="card fcup-next">
            <b>🤝 今週のフレンドカップ</b>
            <small className="muted">
              毎日24時にその日の試合の結果が出ます（次の結果まで あと{left(dayEnd(w, dayIndex(now)) - now)}）。日曜24時の決勝で優勝が決まります。
            </small>
            {prizeLine}
            <small className="muted">ランキングにいる全員が自動で参加します。その日の24時の時点のスタメン・フォーメーション・作戦で戦います。</small>
          </div>
          {live === undefined ? <p className="hint">試合中…</p> : !live ? <p className="hint">今週の大会はまだ始まっていません。</p> : <CupBoard v={live} me={me} />}
        </>
      ) : (
        <div className="card fcup-next">
          <b>🤝 今週のフレンドカップ</b>
          <small className="muted">
            締め切り 日曜24時（あと{left(weekDeadline(w) - now)}）· 参加 {cupEntrants(rows, w).length + missingCupRows(rows, w).length}人
          </small>
          {prizeLine}
          <small className="muted">ランキングにいる全員が自動で参加します。締め切りの時点のスタメン・フォーメーション・作戦で戦い、月曜に結果が出ます。</small>
          <small className="muted">※来週（10月26日）の大会から、毎日24時に1節ずつ結果が出る形になります。</small>
        </div>
      )}

      <h3 className="section-title">先週の結果</h3>
      {last === undefined ? <p className="hint">集計中…</p> : !last ? <p className="hint">先週は参加者が足りず、大会は開かれませんでした。</p> : <CupBoard v={last} me={me} />}
    </div>
  );
}

function CupBoard({ v, me }: { v: CupView; me: string }) {
  const name = (k: string) => v.names[k]?.nickname ?? '?';
  const club = (k: string) => v.names[k]?.club ?? '';
  const doneDays = v.days.filter((d) => d.done && !d.final).length;
  const next = v.days.find((d) => !d.done);
  const myNext = next?.games.find((g) => g.a === me || g.b === me);
  return (
    <>
      {v.complete && v.champion ? (
        <div className={'card fcup-champ' + (v.champion === me ? ' me' : '')}>
          <div className="fcup-cup">🏆</div>
          <div>
            <small className="muted">優勝</small>
            <b>{name(v.champion)}</b>
            <small className="muted">{club(v.champion)}</small>
          </div>
        </div>
      ) : (
        <div className="card fcup-status">
          <small className="muted">{doneDays ? `第${doneDays}節まで終了` : 'まだ試合は始まっていません'}</small>
          {next && (
            <b>
              次は {next.label}
              {myNext ? `：${name(myNext.a)} vs ${name(myNext.b)}` : '（あなたはお休み）'}
            </b>
          )}
        </div>
      )}
      {v.final && v.final.ga >= 0 && (
        <div className="card">
          <small className="muted">決勝</small>
          <GameLine g={v.final} name={name} me={me} />
        </div>
      )}
      <div className="card fcup-table">
        <div className="fcup-tr head">
          <span>#</span>
          <span className="grow">監督</span>
          <span>試</span>
          <span>勝</span>
          <span>分</span>
          <span>敗</span>
          <span>差</span>
          <span>点</span>
        </div>
        {v.table.map((r, i) => (
          <div key={r.key} className={'fcup-tr' + (r.key === me ? ' me' : '')}>
            <span>{i + 1}</span>
            <span className="grow">
              {name(r.key)}
              <small className="muted"> {club(r.key)}</small>
            </span>
            <span>{r.played}</span>
            <span>{r.win}</span>
            <span>{r.draw}</span>
            <span>{r.loss}</span>
            <span>
              {r.gf - r.ga > 0 ? '+' : ''}
              {r.gf - r.ga}
            </span>
            <b>{r.points}</b>
          </div>
        ))}
      </div>
      {v.days
        .filter((d) => !d.final || !d.done)
        .map((d, i) => (
          <div key={i}>
            <h3 className="section-title">
              {d.label}
              {d.final && <small className="muted">（総当たりの1位と2位。今の順位で表示）</small>}
            </h3>
            <div className="card">
              {d.games.map((g, j) => (
                <GameLine key={j} g={g} name={name} me={me} />
              ))}
            </div>
          </div>
        ))}
    </>
  );
}

function GameLine({ g, name, me }: { g: CupGame; name: (k: string) => string; me: string }) {
  const [open, setOpen] = useState(false);
  const mine = g.a === me || g.b === me;
  const pending = g.ga < 0;
  return (
    <div className={'fcup-game' + (mine ? ' me' : '')} onClick={() => !pending && setOpen(!open)}>
      <div className="fcup-score">
        <span className="grow right">{name(g.a)}</span>
        <b>{pending ? <small className="muted">24時</small> : `${g.ga} - ${g.gb}`}</b>
        <span className="grow">{name(g.b)}</span>
      </div>
      {g.pk && (
        <small className="muted center">
          PK {g.pk[0]} - {g.pk[1]}
        </small>
      )}
      {open && (
        <div className="fcup-goals small muted">
          {g.goals.length ? g.goals.map((x, i) => <div key={i} className={x.side === 'b' ? 'right' : ''}>⚽ {x.minute}' {x.name}</div>) : <div className="center">得点なし</div>}
        </div>
      )}
    </div>
  );
}
