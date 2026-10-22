import { useEffect, useMemo, useState } from 'react';
import { claimCupPrize, CUP_PRIZE, cupEntrants, missingCupRows, myCupWinCount, recordCupWin, runCup, weekDeadline, weekId, type CupGame, type CupResult } from '../game/cup';
import { playerId, type RankingRow } from '../game/ranking';
import { useGame } from '../store';
import { fmtMoney, round2 } from '../game/economy';

function left(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}日${h}時間` : h > 0 ? `${h}時間${m % 60}分` : `${m % 60}分`;
}

/** フレンドカップ：毎週日曜24時に締め切り、全員の総当たり＋決勝 */
export function FriendCup({ rows }: { rows: RankingRow[] }) {
  const { update, toast } = useGame();
  const me = playerId();
  const w = weekId();
  const now = Date.now();
  const thisWeek = cupEntrants(rows, w).length + missingCupRows(rows, w).length;
  const entrants = useMemo(() => cupEntrants(rows, w - 1), [rows, w]);
  const [res, setRes] = useState<CupResult | null>(null);

  // 試合の計算は少し時間がかかるので、画面を出してから行う
  useEffect(() => {
    if (entrants.length < 2) return;
    const t = setTimeout(() => setRes(runCup(entrants, w - 1)), 30);
    return () => clearTimeout(t);
  }, [entrants, w]);

  // 優勝していたら記録してバッジに反映
  useEffect(() => {
    if (!res) return;
    const won = recordCupWin(res, me);
    const n = myCupWinCount();
    const prize = claimCupPrize(res, me);
    update((d) => {
      if ((d.counters?.fcup ?? 0) !== n) d.counters = { ...(d.counters ?? {}), fcup: n };
      if (prize) d.money = round2(d.money + prize);
    });
    if (won) toast(`🏆 フレンドカップ優勝！賞金 ${fmtMoney(prize)} を受け取りました`);
    else if (prize) toast(`フレンドカップの賞金 ${fmtMoney(prize)} を受け取りました`);
  }, [res]);

  const name = (k: string) => {
    const e = entrants.find((x) => x.key === k);
    return e ? `${e.nickname}` : '?';
  };
  const club = (k: string) => entrants.find((x) => x.key === k)?.club ?? '';

  return (
    <div className="fcup">
      <div className="card fcup-next">
        <b>🤝 今週のフレンドカップ</b>
        <small className="muted">
          締め切り 日曜24時（あと{left(weekDeadline(w) - now)}）· 参加 {thisWeek}人
        </small>
        <small className="muted">
          賞金：優勝 {fmtMoney(CUP_PRIZE[0])} · 準優勝 {fmtMoney(CUP_PRIZE[1])} · 3位 {fmtMoney(CUP_PRIZE[2])}
        </small>
        <small className="muted">ランキングにいる全員が自動で参加します。締め切りの時点のスタメン・フォーメーション・作戦で戦い、月曜に結果が出ます。</small>
      </div>

      <h3 className="section-title">先週の結果</h3>
      {entrants.length < 2 ? (
        <p className="hint">先週は参加者が足りず、大会は開かれませんでした。</p>
      ) : !res ? (
        <p className="hint">試合中…</p>
      ) : (
        <>
          <div className={'card fcup-champ' + (res.champion === me ? ' me' : '')}>
            <div className="fcup-cup">🏆</div>
            <div>
              <small className="muted">優勝</small>
              <b>{name(res.champion!)}</b>
              <small className="muted">{club(res.champion!)}</small>
            </div>
          </div>
          {res.final && (
            <div className="card">
              <small className="muted">決勝</small>
              <GameLine g={res.final} name={name} me={me} />
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
            {res.table.map((r, i) => (
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
                <span>{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</span>
                <b>{r.points}</b>
              </div>
            ))}
          </div>
          <h3 className="section-title">全試合</h3>
          <div className="card">
            {res.games.map((g, i) => (
              <GameLine key={i} g={g} name={name} me={me} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GameLine({ g, name, me }: { g: CupGame; name: (k: string) => string; me: string }) {
  const [open, setOpen] = useState(false);
  const mine = g.a === me || g.b === me;
  return (
    <div className={'fcup-game' + (mine ? ' me' : '')} onClick={() => setOpen(!open)}>
      <div className="fcup-score">
        <span className="grow right">{name(g.a)}</span>
        <b>
          {g.ga} - {g.gb}
        </b>
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
