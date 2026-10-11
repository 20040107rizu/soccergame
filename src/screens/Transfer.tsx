import { useMemo, useState } from 'react';
import { CondArrow, Ovr, PlayerRow, Seg } from '../components/ui';
import { windowStatus } from '../game/competitions';
import { fmtMoney, marketValue } from '../game/economy';
import { squadOf } from '../game/lineup';
import { teamById } from '../game/season';
import { overall } from '../game/stats';
import { acceptOffer, payrollInfo, rejectOffer } from '../game/transfer';
import { POSITIONS, type Position } from '../game/types';
import { useGame } from '../store';

type Tab = 'search' | 'watch' | 'offers' | 'mine';
type League = 'all' | 'PL' | 'EU' | 'free';
type Sort = 'ovr' | 'value' | 'age';

export function Transfer() {
  const { state, update, toast, openPlayer } = useGame();
  const [tab, setTab] = useState<Tab>('search');
  const [league, setLeague] = useState<League>('all');
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const [sort, setSort] = useState<Sort>('ovr');
  const [q, setQ] = useState('');
  const [affordable, setAffordable] = useState(false);
  const w = windowStatus(state);
  const teams = useMemo(() => Object.fromEntries(state.teams.map((t) => [t.id, t])), [state.teams]);
  const { total, cap } = payrollInfo(state);

  const list = useMemo(() => {
    let ps =
      tab === 'mine'
        ? squadOf(state, state.userTeamId)
        : tab === 'watch'
          ? (state.watchlist ?? []).map((id) => state.players[id]).filter(Boolean)
          : Object.values(state.players).filter((p) => p.teamId !== state.userTeamId);
    if (tab === 'search') {
      if (league === 'free') ps = ps.filter((p) => !p.teamId);
      else if (league !== 'all') ps = ps.filter((p) => p.teamId && teams[p.teamId]?.league === league);
      if (affordable) ps = ps.filter((p) => marketValue(p) <= state.money);
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        ps = ps.filter((p) => p.name.toLowerCase().includes(s) || p.nameEn.toLowerCase().includes(s) || (p.teamId && teams[p.teamId]?.name.includes(q.trim())));
      }
    }
    if (tab === 'watch') ps = [...ps];
    if (pos !== 'ALL') ps = ps.filter((p) => p.position === pos);
    const key = (p: (typeof ps)[number]) => (sort === 'ovr' ? -overall(p) : sort === 'value' ? -marketValue(p) : p.age);
    return ps.sort((a, b) => key(a) - key(b)).slice(0, 100);
  }, [state, tab, league, pos, sort, q, affordable, teams]);

  return (
    <div className="screen">
      <div className="row between">
        <h2 className="screen-title">移籍</h2>
        <span className="money-badge">{fmtMoney(state.money)}</span>
      </div>
      <div className={'window-banner' + (w.open ? ' open' : '')}>
        <b>{w.open ? `🔓 ${w.label}` : '🔒 移籍市場 CLOSED'}</b>
        <span>{w.open ? (w.remaining ? `あと${w.remaining}節` : '') : w.label}</span>
      </div>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { v: 'search', label: '選手を探す' },
          { v: 'watch', label: `マイリスト${state.watchlist?.length ? `(${state.watchlist.length})` : ''}` },
          { v: 'offers', label: `オファー${state.offers.length ? `(${state.offers.length})` : ''}` },
          { v: 'mine', label: '自クラブ' },
        ]}
      />

      {tab === 'offers' ? (
        <div className="list">
          {state.offers.length === 0 && <p className="muted center">届いているオファーはありません</p>}
          {state.offers.map((o) => {
            const p = state.players[o.playerId];
            if (!p) return null;
            const from = teams[o.fromTeam];
            return (
              <div key={o.id} className="card offer">
                <PlayerRow p={p} team={teams[state.userTeamId]} onClick={() => openPlayer(p.id)} />
                <div className="row between">
                  <span>
                    {from?.name}から <b>{fmtMoney(o.fee)}</b>
                    <small className="muted">（市場価値 {fmtMoney(marketValue(p))}）</small>
                  </span>
                </div>
                <div className="row gap">
                  <button className="btn ghost grow" onClick={() => update((d) => rejectOffer(d, o.id))}>
                    断る
                  </button>
                  <button
                    className="btn primary grow"
                    disabled={!w.open}
                    onClick={() => {
                      if (!confirm(`${p.name}を${from?.name}へ ${fmtMoney(o.fee)} で売却しますか？`)) return;
                      const r = update((d) => acceptOffer(d, o.id));
                      toast(r.ok ? '売却が成立しました' : r.message);
                    }}
                  >
                    受け入れる
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {tab === 'search' && (
            <>
              <input className="search" placeholder="名前・クラブで検索" value={q} onChange={(e) => setQ(e.target.value)} />
              <Seg
                small
                value={league}
                onChange={setLeague}
                options={[
                  { v: 'all', label: '全て' },
                  { v: 'PL', label: 'プレミア' },
                  { v: 'EU', label: '欧州' },
                  { v: 'free', label: 'フリー' },
                ]}
              />
            </>
          )}
          {tab === 'watch' && <p className="hint">選手詳細の ☆ を押すとマイリストに追加できます。</p>}
          {tab === 'mine' && (
            <p className="hint">
              年俸総額 {fmtMoney(total)} / 上限 {fmtMoney(cap)}。選手をタップすると契約延長・売却・契約解除ができます。
            </p>
          )}
          <Seg scroll small value={pos} onChange={setPos} options={[{ v: 'ALL' as const, label: '全' }, ...POSITIONS.map((p) => ({ v: p, label: p }))]} />
          <div className="row gap wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="ovr">総合値順</option>
              <option value="value">市場価値順</option>
              <option value="age">若い順</option>
            </select>
            {tab === 'search' && (
              <label className="check">
                <input type="checkbox" checked={affordable} onChange={(e) => setAffordable(e.target.checked)} /> 資金内
              </label>
            )}
          </div>
          <div className="list">
            {list.length === 0 && <p className="muted center">該当する選手がいません</p>}
            {list.map((p) => (
              <PlayerRow
                key={p.id}
                p={p}
                team={p.teamId ? teams[p.teamId] : undefined}
                onClick={() => openPlayer(p.id)}
                sub={
                  tab === 'mine'
                    ? `${p.age}歳 · 年俸${fmtMoney(p.salary)} · 契約残り${p.contractYears}年`
                    : `${p.age}歳 · ${p.teamId ? teamById(state, p.teamId).name : 'フリー'} · ${fmtMoney(marketValue(p))}`
                }
                right={
                  <>
                    <CondArrow c={p.condition} size={18} />
                    <Ovr v={overall(p)} />
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
