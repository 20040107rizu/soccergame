import { useEffect, useState } from 'react';
import { Ovr, PosTag, Seg, Sheet } from '../components/ui';
import { parseSnapshot } from '../game/friendly';
import { overallFor, STAT_KEYS } from '../game/stats';
import type { Stats } from '../game/types';
import { fetchRanking, playerId, rankingEnabled, type RankingRow } from '../game/ranking';

type Sort = 'titles' | 'points' | 'money' | 'achievements';

/** フレンドランキング（テストプレイ中の全員の状況） */
export function Ranking() {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [err, setErr] = useState(false);
  const [sort, setSort] = useState<Sort>('titles');
  const [open, setOpen] = useState<RankingRow | null>(null);
  const me = playerId();

  useEffect(() => {
    if (!rankingEnabled()) return;
    fetchRanking()
      .then(setRows)
      .catch(() => setErr(true));
  }, []);

  if (!rankingEnabled()) return <p className="hint">フレンドランキングは準備中です。</p>;
  if (err) return <p className="hint">ランキングを読み込めませんでした。電波の良いところでもう一度開いてください。</p>;
  if (!rows) return <p className="hint">読み込み中…</p>;

  const key = (r: RankingRow) =>
    sort === 'titles' ? r.titles * 1000 + r.clTitles * 500 + r.points - r.plRank : sort === 'points' ? r.points * 100 + (r.gf - r.ga) : sort === 'money' ? r.money : r.achievements;
  const list = [...rows].sort((a, b) => key(b) - key(a));

  return (
    <>
      <p className="hint">テストプレイ中のみんなの状況です（自動で更新されます）。</p>
      <Seg
        small
        value={sort}
        onChange={setSort}
        options={[
          { v: 'titles', label: 'タイトル' },
          { v: 'points', label: '今季の勝ち点' },
          { v: 'money', label: '資金' },
          { v: 'achievements', label: '実績' },
        ]}
      />
      <div className="list">
        {list.length === 0 && <p className="muted center">まだ誰も参加していません</p>}
        {list.map((r, i) => (
          <button key={r.playerId + r.slot} className={'card friend-row' + (r.playerId === me ? ' me' : '')} onClick={() => setOpen(r)}>
            <span className="friend-rank">{i + 1}</span>
            <div className="grow">
              <b>
                {r.nickname}
                {r.playerId === me && <small className="muted">（あなた）</small>}
              </b>
              <div className="small muted">
                {r.club} · シーズン{r.season} · {r.progress}
              </div>
              <div className="small">
                PL {r.plRank || '-'}位 · {r.win}勝{r.draw}分{r.loss}敗 · 勝ち点{r.points} · 資金￥{r.money}億
              </div>
              <div className="small muted">
                🏆 リーグ{r.titles} · CL{r.clTitles} · 実績{r.achievements} · エース {r.topPlayer}
              </div>
            </div>
          </button>
        ))}
      </div>
      {open && <FriendTeam row={open} mine={open.playerId === me} onClose={() => setOpen(null)} />}
    </>
  );
}

/** フレンドのチームを見て、親善試合を申し込む */
function FriendTeam({ row, mine, onClose }: { row: RankingRow; mine: boolean; onClose: () => void }) {
  const snap = parseSnapshot(row.team);
  return (
    <Sheet title={`${row.nickname}のチーム`} onClose={onClose}>
      <p className="hint">
        {row.club} · シーズン{row.season}
      </p>
      {!snap ? (
        <p className="hint">このプレイヤーのチーム情報はまだ届いていません（相手が最新版で試合を進めると見られるようになります）。</p>
      ) : (
        <>
          <h4>スタメン（{snap.formation} · スピリット {snap.spirit}）</h4>
          <div className="list compact">
            {snap.players.slice(0, 11).map((p, i) => {
              const stats = Object.fromEntries(STAT_KEYS.map((k, j) => [k, p.st[j]])) as unknown as Stats;
              return (
                <div key={i} className="row gap friend-player">
                  <PosTag pos={p.p} />
                  <span className="grow">
                    {p.n} <small className="muted">#{p.no}</small>
                  </span>
                  <Ovr v={overallFor(stats, p.p)} />
                </div>
              );
            })}
          </div>
          {!mine && (
            <button
              className="btn primary big"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('start-friendly', { detail: { snap, nickname: row.nickname } }));
              }}
            >
              ⚽ 親善試合をする
            </button>
          )}
          <p className="hint">親善試合は練習試合です。結果や成長・ケガはセーブに影響しません。</p>
        </>
      )}
    </Sheet>
  );
}
