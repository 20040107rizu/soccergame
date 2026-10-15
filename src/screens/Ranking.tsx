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
import { fetchRanking, lastPlayed, playerId, rankingEnabled, type RankingRow } from '../game/ranking';
import { ACHIEVEMENTS } from '../game/events';
import { FACILITIES, sceneData } from '../game/club';
import { ClubScene } from '../components/ClubScene';
import type { TeamSnapshot } from '../game/friendly';
import { BadgeStrip, BadgeWall } from '../components/Badges';
import { Jersey } from '../components/Jersey';
import { computeBadges } from '../game/badges';
import { managerLevel } from '../game/collection';

type Sort = 'titles' | 'points' | 'money' | 'achievements';

/** フレンドランキング（テストプレイ中の全員の状況） */
export function Ranking() {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [err, setErr] = useState(false);
  const [sort, setSort] = useState<Sort>('titles');
  const [open, setOpen] = useState<RankingRow | null>(null);
  const me = playerId();
  const { state } = useGame();
  const mineBadges = useMemo(() => new Set(computeBadges(state, managerLevel(state), Object.keys(state.dex ?? {}).length)), [state]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
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
        {list.map((r, i) => {
          const seen = lastPlayed(r.updatedAt, now);
          return (
          <button key={r.playerId + r.slot} className={'card friend-row' + (r.playerId === me ? ' me' : '') + (seen?.tier === 'old' ? ' stale' : '')} onClick={() => setOpen(r)}>
            {seen && (
              <span className={'friend-seen ' + seen.tier}>
                <span className="dot" />
                {seen.label}
                <small>{seen.exact}</small>
              </span>
            )}
            <span className="friend-rank">{i + 1}</span>
            <div className="grow">
              <b>
                {r.nickname}
                {r.playerId === me && <small className="muted">（あなた）</small>}
              </b>
              <FriendTitle team={r.team} />
              <FriendBadges team={r.team} mine={mineBadges} />
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
          );
        })}
      </div>
      {open && <FriendTeam row={open} mine={open.playerId === me} onClose={() => setOpen(null)} />}
    </>
  );
}

/** フレンドのチーム（ゲームプラン・配置・選手）を見て、親善試合を申し込む */
function FriendTeam({ row, mine, onClose }: { row: RankingRow; mine: boolean; onClose: () => void }) {
  const { state } = useGame();
  const snap = parseSnapshot(row.team);
  const seen = lastPlayed(row.updatedAt);
  const [detail, setDetail] = useState<string | null>(null);
  const [view, setView] = useState<'plan' | 'career' | 'club'>('plan');
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
      <Seg
        small
        value={view}
        onChange={setView}
        options={[
          { v: 'plan', label: '⚽ ゲームプラン' },
          { v: 'career', label: '📈 監督の実績' },
          { v: 'club', label: '🏟 クラブ' },
        ]}
      />
      {view === 'club' ? (
        <FriendClub snap={snap} />
      ) : view === 'career' ? (
        <Career row={row} snap={snap} />
      ) : (
      <>
      <div className="friend-plan card">
        <div className="row gap">
          <Crest team={team} size={40} />
          <div className="grow">
            <b>{snap.name}</b>
            <div className="small muted">
              シーズン{row.season} · {row.progress} · PL {row.plRank || '-'}位（{row.win}勝{row.draw}分{row.loss}敗）
            </div>
            {seen && (
              <div className="small muted">
                最終プレイ {seen.exact}（{seen.label}）
              </div>
            )}
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
          <div>
            <small>スタメン平均年齢</small>
            <b>{snap.ages?.[0] ?? Math.round((xi.reduce((a, p) => a + p.age, 0) / xi.length) * 10) / 10}歳</b>
          </div>
          <div>
            <small>チーム平均年齢</small>
            <b>{snap.ages ? `${snap.ages[1]}歳` : '―'}</b>
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
      </>
      )}
      {p && <FriendPlayer p={p} team={team} onClose={() => setDetail(null)} />}
    </Sheet>
  );
}

/** フレンドや対戦相手の選手の詳細（見るだけ） */
export function FriendPlayer({ p, team, onClose }: { p: Player; team: Team; onClose: () => void }) {
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

/** フレンドのバッジ（上位だけ） */
function FriendBadges({ team, mine }: { team?: string; mine: Set<string> }) {
  const snap = useMemo(() => parseSnapshot(team), [team]);
  return <BadgeStrip ids={snap?.prof?.bd} mine={mine} />;
}

/** フレンドの監督レベルと称号（チーム情報に入っていれば表示） */
function FriendTitle({ team }: { team?: string }) {
  const snap = useMemo(() => parseSnapshot(team), [team]);
  if (!snap?.mgr) return null;
  return (
    <div className="small friend-title">
      Lv.{snap.mgr.lv}「{snap.mgr.title}」
    </div>
  );
}

/** フレンドの監督としての実績 */
/** フレンドのクラブの全景（施設・スタジアム・銅像） */
function FriendClub({ snap }: { snap: TeamSnapshot }) {
  const pr = snap.prof;
  if (!pr?.scene) return <p className="hint">この人のクラブの様子はまだ届いていません（相手が最新版で試合を進めると見られるようになります）。</p>;
  const colors = pr.colors ?? [snap.color ?? '#c8102e', snap.color2 ?? '#ffffff'];
  return <ClubScene d={sceneData(pr.scene, pr.stadium?.[1] || 'ホームスタジアム', colors as [string, string])} />;
}

function Career({ row, snap }: { row: RankingRow; snap: TeamSnapshot }) {
  const { state } = useGame();
  const [allHist, setAllHist] = useState(false);
  const myBadges = useMemo(() => new Set(computeBadges(state, managerLevel(state), Object.keys(state.dex ?? {}).length)), [state]);
  const pr = snap.prof;
  if (!pr) return <p className="hint">この人の実績はまだ届いていません（相手が最新版で試合を進めると見られるようになります）。</p>;
  const mine = state.achievements ?? {};
  const got = new Set(pr.ach);
  const shown = ACHIEVEMENTS.filter((a) => got.has(a.id) && (!a.hidden || mine[a.id]));
  const secret = ACHIEVEMENTS.filter((a) => got.has(a.id) && a.hidden && !mine[a.id]).length;
  const best = pr.hist.length ? Math.min(...pr.hist.map((h) => h[1])) : null;
  return (
    <div className="career">
      <div className="card career-head">
        <Jersey color={pr.colors?.[0] ?? snap.color} color2={pr.colors?.[1] ?? snap.color2} number={pr.lv > 99 ? '★' : pr.lv} size={58} pattern={pr.kit} />
        <div className="mgr-lv">Lv.{pr.lv}</div>
        <div className="grow">
          <b>{row.nickname}監督</b>
          <div className="friend-title">「{pr.title}」</div>
          <small className="muted">
            {row.club} · シーズン{row.season}
          </small>
        </div>
      </div>
      <div className="career-kpis">
        <div>
          <small>指揮</small>
          <b>{pr.seasons}季</b>
        </div>
        <div>
          <small>リーグ優勝</small>
          <b>{row.titles}</b>
        </div>
        <div>
          <small>CL優勝</small>
          <b>{row.clTitles}</b>
        </div>
        <div>
          <small>最高順位</small>
          <b>{best ? `${best}位` : '-'}</b>
        </div>
        <div>
          <small>実績</small>
          <b>{pr.ach.length}</b>
        </div>
        <div>
          <small>図鑑</small>
          <b>{pr.dex}人</b>
        </div>
      </div>
      <h3 className="section-title">🎖 バッジ（{pr.bd?.length ?? 0}）</h3>
      <BadgeWall ids={pr.bd} mine={myBadges} />
      {pr.stadium && pr.stadium[0] > 0 && (
        <p className="small">
          🏟 {pr.stadium[1] || 'ホームスタジアム'}（Lv.{pr.stadium[0]}）{pr.statues ? ` · 🗿 銅像 ${pr.statues}体` : ''}
        </p>
      )}
      {pr.best && (
        <p className="small">
          歴代最高の選手：<b>{pr.best[0]}</b>（総合値 {pr.best[1]}）
        </p>
      )}

      <h3 className="section-title">シーズンごとの成績</h3>
      {pr.hist.length === 0 ? (
        <p className="hint">まだシーズンを終えていません。</p>
      ) : (
        <div className="career-hist">
          {[...pr.hist].reverse().slice(0, allHist ? undefined : 10).map(([season, rank, cl, club]) => (
            <div key={season} className={'career-row' + (rank === 1 ? ' gold' : '')}>
              <span>S{season}</span>
              <b>{rank === 1 ? '🏆 優勝' : `${rank}位`}</b>
              <span className="muted">{cl && cl !== '出場なし' ? `CL ${cl === '優勝' ? '🏆優勝' : cl}` : ''}</span>
              <small className="muted">{club}</small>
            </div>
          ))}
          {!allHist && pr.hist.length > 10 && (
            <button className="btn ghost small" onClick={() => setAllHist(true)}>
              すべてのシーズンを見る（{pr.hist.length}）
            </button>
          )}
        </div>
      )}

      <h3 className="section-title">実績（{pr.ach.length}）</h3>
      <div className="ach-grid">
        {shown.map((a) => (
          <div key={a.id} className="ach on">
            <b>{a.label}</b>
            <small>{a.desc}</small>
          </div>
        ))}
        {secret > 0 && (
          <div className="ach">
            <b>？？？ ×{secret}</b>
            <small>あなたがまだ解除していない隠し実績</small>
          </div>
        )}
      </div>

      {pr.hof.length > 0 && (
        <>
          <h3 className="section-title">殿堂</h3>
          <div className="list">
            {pr.hof.map(([name, pos, peak, apps]) => (
              <div key={name} className="career-row hof-row">
                <span className="chip">{pos}</span>
                <b>{name}</b>
                <small className="muted">
                  最高 {peak} · {apps}試合
                </small>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">クラブの施設</h3>
      <div className="career-fac">
        {FACILITIES.map((f, i) => (
          <div key={f.id}>
            {f.icon} {f.label} <b>Lv.{pr.scene?.lv[i + 1] ?? pr.fac[i] ?? 0}</b>
          </div>
        ))}
      </div>
      {pr.miracles > 0 && <p className="small">✨ 大逆転勝利 {pr.miracles}回</p>}
    </div>
  );
}
