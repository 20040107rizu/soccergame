import { useState } from 'react';
import { Heatmap } from '../components/Heatmap';
import { COND_STYLE, CondArrow, Ovr, PlayerIcon, PosTag, Seg, Sheet, statColor } from '../components/ui';
import { windowStatus } from '../game/competitions';
import { fmtMoney, marketValue } from '../game/economy';
import { teamById } from '../game/season';
import { overall, SKILLS, STAT_GROUPS, STAT_LABEL, STYLES } from '../game/stats';
import { AppearanceEditor } from './AppearanceEditor';
import { LegendPanel } from './LegendPanel';
import { LEGEND_LABEL } from '../game/legend';
import { TRAITS, type TraitId } from '../game/events';
import { releaseCost, releasePlayer, renewContract, renewDemand, seekBuyer } from '../game/transfer';
import { useGame } from '../store';
import { changeNumber } from '../game/lineup';
import { campCost, runCamp } from '../game/club';

const GROWTH_LABEL = { early: '早熟', normal: '標準', late: '晩成' };

export function PlayerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, update, toast, openNegotiation, editPlayer } = useGame();
  const [tab, setTab] = useState<'stats' | 'info'>('stats');
  const [renew, setRenew] = useState<{ salary: number; years: number } | null>(null);
  const [skillOpen, setSkillOpen] = useState<string | null>(null);
  const [face, setFace] = useState(false);
  const p = state.players[id];
  if (!p) return null;
  const team = p.teamId ? teamById(state, p.teamId) : undefined;
  const mine = p.teamId === state.userTeamId;
  const changeNum = () => {
    const v = prompt('新しい背番号（1〜99）。同じ番号の選手がいれば入れ替えます', String(p.number));
    if (v === null) return;
    const n = Number(v);
    if (!update((d) => changeNumber(d, p.id, n))) return toast('1〜99の数字を入れてください');
    toast(`背番号を ${n} にしました`);
  };
  const userTeam = teamById(state, state.userTeamId);
  const canEdit = mine && userTeam.original && p.custom;
  const w = windowStatus(state);
  const isGk = p.position === 'GK';

  return (
    <Sheet title="選手詳細" onClose={onClose}>
      <div className="pd-head">
        <PlayerIcon p={p} team={team} size={72} />
        <div className="grow">
          <div className="pd-name">{p.name}</div>
          {p.nickname && <div className="pd-nick">📣「{p.nickname}」</div>}
          {p.nameEn && <div className="pd-en">{p.nameEn}</div>}
          <div className="pd-sub">
            <PosTag pos={p.position} /> {p.age}歳 · {p.height ? `${p.height}cm · ` : ''}{p.nationality} · {p.foot === 'R' ? '右足' : '左足'} ·{' '}
            {mine ? (
              <button className="num-btn" onClick={changeNum}>
                #{p.number} ✎
              </button>
            ) : (
              <>#{p.number}</>
            )}
          </div>
          <div className="pd-sub">{team ? team.name : 'フリー'}</div>
          {p.legend && <span className="legend-badge">🌟 レジェンド・{LEGEND_LABEL[p.legend.kind]}</span>}
          <PlayerBadges id={p.id} />
        </div>
        <button
          className={'star-btn' + ((state.watchlist ?? []).includes(p.id) ? ' on' : '')}
          aria-label="マイリスト"
          onClick={() =>
            update((d) => {
              d.watchlist = d.watchlist ?? [];
              if (d.watchlist.includes(p.id)) d.watchlist = d.watchlist.filter((x) => x !== p.id);
              else d.watchlist.push(p.id);
            })
          }
        >
          {(state.watchlist ?? []).includes(p.id) ? '★' : '☆'}
        </button>
        <div className="pd-ovr">
          <small>総合</small>
          <Ovr v={overall(p)} big />
          <div className="pd-cond">
            <CondArrow c={p.condition} size={22} />
            <small>{COND_STYLE[p.condition].label}</small>
          </div>
        </div>
      </div>
      {(p.injury > 0 || p.suspension > 0) && (
        <div className="warn-box">
          {p.injury > 0 && `負傷中（あと約${p.injury}試合）`} {p.suspension > 0 && '次の試合は出場停止'}
        </div>
      )}

      <div className="seg">
        <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>
          能力
        </button>
        <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>
          契約・成績
        </button>
      </div>

      {tab === 'stats' ? (
        <>
          <div className="pd-top">
            <Heatmap aptitudes={p.aptitudes} main={p.position} player={p} />
            <div className="pd-traits">
              <div>
                <small>プレースタイル</small>
                <b>{STYLES[p.style]?.label ?? '—'}</b>
                <small className="muted">有効：{STYLES[p.style]?.pos.join('/')}</small>
              </div>
              <div>
                <small>逆足頻度 / 精度</small>
                <b>
                  {'●'.repeat(p.traits.weakFootUse)}
                  <span className="muted">{'●'.repeat(4 - p.traits.weakFootUse)}</span> / {'●'.repeat(p.traits.weakFootAcc)}
                  <span className="muted">{'●'.repeat(4 - p.traits.weakFootAcc)}</span>
                </b>
              </div>
              <div>
                <small>コンディション安定度</small>
                <b>{p.traits.form} / 8</b>
              </div>
              <div>
                <small>ケガ耐性</small>
                <b>{['', 'C', 'B', 'A'][p.traits.injuryRes]}</b>
              </div>
            </div>
          </div>
          {STAT_GROUPS.filter((g) => g.label !== 'GK' || isGk).map((g) => (
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
              p.skills.map((s) => {
                const sk = SKILLS.find((x) => x.id === s);
                return (
                  <button key={s} className={'skill' + (skillOpen === s ? ' on' : '')} onClick={() => setSkillOpen(skillOpen === s ? null : s)}>
                    {sk?.label ?? s}
                  </button>
                );
              })
            ) : (
              <span className="muted">なし</span>
            )}
          </div>
          {skillOpen && <p className="skill-desc">{SKILLS.find((x) => x.id === skillOpen)?.desc}</p>}
          {mine && (
            <>
              <h4>隠し特性</h4>
              {p.knownTraits?.length ? (
                <div className="skills">
                  {p.knownTraits.map((t) => (
                    <span key={t} className="skill trait" title={TRAITS[t as TraitId]?.desc}>
                      {TRAITS[t as TraitId]?.label} <small>{TRAITS[t as TraitId]?.desc}</small>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted small">まだ見つかっていない…（試合で発揮されると判明します）</p>
              )}
            </>
          )}
          <button className="btn small ghost" onClick={() => setFace(true)}>
            顔（見た目）を編集
          </button>
          {face && <AppearanceEditor id={p.id} onClose={() => setFace(false)} />}
        </>
      ) : (
        <>
          <div className="pd-grid">
            <div>
              <small>市場価値</small>
              <b>{fmtMoney(marketValue(p))}</b>
            </div>
            <div>
              <small>年俸</small>
              <b>{fmtMoney(p.salary)}</b>
            </div>
            <div>
              <small>契約</small>
              <b>{p.teamId ? `残り${p.contractYears}年` : 'フリー'}</b>
            </div>
            <div>
              <small>成長タイプ</small>
              <b>{mine ? GROWTH_LABEL[p.growth] : '？？？'}</b>
            </div>
            <div>
              <small>今季 リーグ</small>
              <b>
                {p.season.apps}試合 {p.season.goals}G {p.season.assists}A
              </b>
            </div>
            <div>
              <small>今季 CL</small>
              <b>
                {p.season.clApps}試合 {p.season.clGoals}G
              </b>
            </div>
            <div>
              <small>通算</small>
              <b>
                {p.career.apps}試合 {p.career.goals}G {p.career.assists}A
              </b>
            </div>
          </div>
        </>
      )}

      <div className="pd-actions">
        {p.legend && !p.teamId && <LegendPanel playerId={p.id} onDone={onClose} />}
        {!mine && !(p.legend && !p.teamId) && (
          <button
            className="btn primary"
            disabled={!w.open}
            onClick={() => {
              onClose();
              openNegotiation(p.id);
            }}
          >
            {w.open ? '獲得交渉を始める' : '移籍市場は閉まっています'}
          </button>
        )}
        {mine && (
          <div className="card camp-card">
            <b>🏕 特訓キャンプ</b>
            <small className="muted">お金を使って、この選手を集中的に鍛えます（同じ選手ほど費用が上がります。1日1回まで）</small>
            <div className="row gap">
              <button
                className="btn grow"
                disabled={state.money < campCost(p, 'stat')}
                onClick={() => {
                  if (!confirm(`${p.name}の能力を特訓しますか？（${fmtMoney(campCost(p, 'stat'))}）`)) return;
                  const r = update((d) => runCamp(d, p.id, 'stat'));
                  toast(r.message ?? '');
                }}
              >
                能力アップ
                <br />
                <small>{fmtMoney(campCost(p, 'stat'))}</small>
              </button>
              <button
                className="btn grow"
                disabled={state.money < campCost(p, 'skill') || p.skills.length >= 12}
                onClick={() => {
                  if (!confirm(`${p.name}に新しいスキルを特訓しますか？（${fmtMoney(campCost(p, 'skill'))}）`)) return;
                  const r = update((d) => runCamp(d, p.id, 'skill'));
                  toast(r.message ?? '');
                }}
              >
                スキル習得
                <br />
                <small>{fmtMoney(campCost(p, 'skill'))}</small>
              </button>
            </div>
          </div>
        )}
        {mine && (
          <>
            {renew ? (
              <div className="card">
                <b>契約延長</b>
                <p className="hint">希望年俸の目安：{fmtMoney(renewDemand(p))}</p>
                <label className="field">
                  <span>年俸 {fmtMoney(renew.salary)}</span>
                  <input type="range" min={Math.max(0.1, p.salary * 0.7)} max={p.salary * 2.5 + 0.5} step={0.05} value={renew.salary} onChange={(e) => setRenew({ ...renew, salary: Number(e.target.value) })} />
                </label>
                <Seg value={String(renew.years)} options={[1, 2, 3, 4, 5].map((y) => ({ v: String(y), label: `${y}年` }))} onChange={(v) => setRenew({ ...renew, years: Number(v) })} small />
                <div className="row gap">
                  <button className="btn ghost" onClick={() => setRenew(null)}>
                    やめる
                  </button>
                  <button
                    className="btn primary grow"
                    onClick={() => {
                      const r = update((d) => renewContract(d, p.id, renew.salary, renew.years));
                      toast(r.message ?? '');
                      if (r.ok) setRenew(null);
                    }}
                  >
                    提示する
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn" onClick={() => setRenew({ salary: Math.round(renewDemand(p) * 20) / 20, years: Math.min(5, p.contractYears + 2) })}>
                契約延長の交渉
              </button>
            )}
            <button
              className="btn"
              disabled={!w.open}
              onClick={() => {
                const r = update((d) => seekBuyer(d, p.id));
                toast(r.message ?? '');
              }}
            >
              {w.open ? '移籍リストに載せる（買い手を探す）' : '売却は移籍期間のみ'}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (!confirm(`${p.name}との契約を解除しますか？違約金 ${fmtMoney(releaseCost(p))} がかかります。`)) return;
                const r = update((d) => releasePlayer(d, p.id));
                toast(r.ok ? '契約を解除しました' : r.message);
                if (r.ok) onClose();
              }}
            >
              契約解除（違約金 {fmtMoney(releaseCost(p))}）
            </button>
          </>
        )}
        {canEdit && (
          <button
            className="btn ghost"
            onClick={() => {
              onClose();
              editPlayer(p.id);
            }}
          >
            エディット
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** 覚醒・ユース出身・師弟・古巣・約束などのバッジ */
function PlayerBadges({ id }: { id: string }) {
  const { state } = useGame();
  const p = state.players[id];
  const mentor = p.mentorId ? state.players[p.mentorId] : undefined;
  const pupils = Object.values(state.players).filter((x) => x.mentorId === p.id && x.teamId === p.teamId);
  const ex = p.exTeamId ? state.teams.find((t) => t.id === p.exTeamId) : undefined;
  const items = [
    p.awakened && '⚡ 覚醒',
    p.academy && '🎓 ユース出身',
    p.gem?.revealed && `💎 ${p.gem.origin}出身`,
    mentor && `🤝 師匠：${mentor.name}`,
    pupils.length > 0 && `🤝 弟子：${pupils.map((x) => x.name).join('、')}`,
    ex && `古巣：${ex.name}`,
    p.promise && `📝 約束：残り${p.promise.left}試合で先発あと${Math.max(0, p.promise.need - p.promise.got)}回`,
    p.listed && '📋 移籍リスト',
  ].filter(Boolean) as string[];
  if (!items.length) return null;
  return (
    <div className="pd-badges">
      {items.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
