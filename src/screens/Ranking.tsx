import { useEffect, useMemo, useState } from 'react';
import { Crest, Ovr, PlayerIcon, PosTag, Seg, Sheet, SpiritGauge, statColor } from '../components/ui';
import { Heatmap } from '../components/Heatmap';
import { LineupBoard } from '../components/LineupBoard';
import { parseSnapshot, snapshotTeam } from '../game/friendly';
import { posFromXY } from '../game/positions';
import { teamById } from '../game/season';
import { overall, ratingAt, SKILLS, STAT_GROUPS, STAT_LABEL, STYLES } from '../game/stats';
import type { Player, Team } from '../game/types';
import { useGame } from '../store';
import { TACTIC_OPTIONS } from './Squad';
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

/** フレンドのチーム（ゲームプラン・配置・選手）を見て、親善試合を申し込む */
function FriendTeam({ row, mine, onClose }: { row: RankingRow; mine: boolean; onClose: () => void }) {
  const { state } = useGame();
  const snap = parseSnapshot(row.team);
  const [detail, setDetail] = useState<string | null>(null);
  const built = useMemo(() => (snap ? snapshotTeam(snap, teamById(state, state.userTeamId), row.nickname) : null), [row.team]);
  if (!snap || !built) {
    return (
      <Sheet title={`${row.nickname}のチーム`} onClose={onClose}>
        <p className="hint">このプレイヤーのチーム情報はまだ届いていません（相手が最新版で試合を進めると見られるようになります）。</p>
      </Sheet>
    );
  }
  const { team, players } = built;
  const xi = team.lineup.map((id) => players[id]);
  const roles = team.slots.map((s) => posFromXY(s.x, s.y));
  const avg = Math.round(xi.reduce((a, p, i) => a + ratingAt(p, roles[i]), 0) / xi.length);
  const tactic = TACTIC_OPTIONS.find((t) => t.v === snap.tactic)?.label ?? snap.tactic;
  const p = detail ? players[detail] : null;
  return (
    <Sheet title={`${row.nickname}のチーム`} onClose={onClose} full>
      <div className="friend-plan card">
        <div className="row gap">
          <Crest team={team} size={40} />
          <div className="grow">
            <b>{snap.name}</b>
            <div className="small muted">
              シーズン{row.season} · {row.progress} · PL {row.plRank || '-'}位（{row.win}勝{row.draw}分{row.loss}敗）
            </div>
          </div>
        </div>
        <div className="plan-grid">
          <div>
            <small>フォーメーション</small>
            <b>{snap.formation}</b>
          </div>
          <div>
            <small>作戦</small>
            <b>{tactic}</b>
          </div>
          <div>
            <small>スタメン平均</small>
            <b>{avg}</b>
          </div>
        </div>
        <SpiritGauge v={snap.spirit} />
      </div>
      <LineupBoard
        team={team}
        slots={team.slots}
        lineup={team.lineup}
        bench={team.bench}
        players={players}
        onMove={() => {}}
        onSlotMove={() => {}}
        onDetail={setDetail}
        benchLabel="ベンチ"
        hint="タップで適性表示 · 長押しで選手詳細"
        readOnly
      />
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
      {p && <FriendPlayer p={p} team={team} onClose={() => setDetail(null)} />}
    </Sheet>
  );
}

/** フレンドの選手の詳細（見るだけ） */
function FriendPlayer({ p, team, onClose }: { p: Player; team: Team; onClose: () => void }) {
  const [skill, setSkill] = useState<string | null>(null);
  return (
    <Sheet title="選手詳細" onClose={onClose}>
      <div className="pd-head">
        <PlayerIcon p={p} team={team} size={72} />
        <div className="grow">
          <div className="pd-name">{p.name}</div>
          <div className="pd-sub">
            <PosTag pos={p.position} /> {p.age}歳 · {p.height ? `${p.height}cm · ` : ''}
            {p.foot === 'R' ? '右足' : '左足'} · #{p.number}
          </div>
        </div>
        <div className="pd-ovr">
          <small>総合</small>
          <Ovr v={overall(p)} big />
        </div>
      </div>
      <div className="pd-top">
        <Heatmap aptitudes={p.aptitudes} main={p.position} player={p} />
        <div className="pd-traits">
          <div>
            <small>プレースタイル</small>
            <b>{STYLES[p.style]?.label ?? '—'}</b>
          </div>
        </div>
      </div>
      {STAT_GROUPS.filter((g) => g.label !== 'GK' || p.position === 'GK').map((g) => (
        <div key={g.label} className="stat-group">
          <h4>{g.label}</h4>
          <div className="stat-grid">
            {g.keys.map((k) => (
              <div key={k} className="stat-cell">
                <span>{STAT_LABEL[k]}</span>
                <b style={{ color: statColor(p.stats[k]) }}>{p.stats[k]}</b>
              </div>
            ))}
          </div>
        </div>
      ))}
      <h4>特殊スキル</h4>
      <div className="skills">
        {p.skills.length ? (
          p.skills.map((s) => (
            <button key={s} className={'skill' + (skill === s ? ' on' : '')} onClick={() => setSkill(skill === s ? null : s)}>
              {SKILLS.find((x) => x.id === s)?.label ?? s}
            </button>
          ))
        ) : (
          <span className="muted">なし</span>
        )}
      </div>
      {skill && <p className="skill-desc">{SKILLS.find((x) => x.id === skill)?.desc}</p>}
    </Sheet>
  );
}
