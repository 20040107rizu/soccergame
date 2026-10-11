import { useState } from 'react';
import { Heatmap } from '../components/Heatmap';
import { COND_STYLE, CondArrow, Ovr, PlayerIcon, PosTag, Seg, Sheet, statColor } from '../components/ui';
import { windowStatus } from '../game/competitions';
import { fmtMoney, marketValue } from '../game/economy';
import { teamById } from '../game/season';
import { overall, SKILL_LABEL, STAT_GROUPS, STAT_LABEL, STYLES } from '../game/stats';
import { releaseCost, releasePlayer, renewContract, renewDemand, seekBuyer } from '../game/transfer';
import { useGame } from '../store';

const GROWTH_LABEL = { early: '早熟', normal: '標準', late: '晩成' };

export function PlayerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, update, toast, openNegotiation, editPlayer } = useGame();
  const [tab, setTab] = useState<'stats' | 'info'>('stats');
  const [renew, setRenew] = useState<{ salary: number; years: number } | null>(null);
  const p = state.players[id];
  if (!p) return null;
  const team = p.teamId ? teamById(state, p.teamId) : undefined;
  const mine = p.teamId === state.userTeamId;
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
          {p.nameEn && <div className="pd-en">{p.nameEn}</div>}
          <div className="pd-sub">
            <PosTag pos={p.position} /> {p.age}歳 · {p.nationality} · {p.foot === 'R' ? '右足' : '左足'} · #{p.number}
          </div>
          <div className="pd-sub">{team ? team.name : 'フリー'}</div>
        </div>
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
            {p.skills.length ? p.skills.map((s) => <span key={s} className="skill">{SKILL_LABEL[s] ?? s}</span>) : <span className="muted">なし</span>}
          </div>
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
        {!mine && (
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
