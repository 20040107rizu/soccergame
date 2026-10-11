import { useMemo, useState } from 'react';
import { PlayerRow, fmtP } from '../components/ui';
import { overall } from '../game/rating';
import { squadOf } from '../game/season';
import { saleValue, transferFee } from '../game/transfer';
import { POSITIONS, type Position } from '../game/types';
import { useGame } from '../store';

type Tab = 'free' | 'clubs' | 'mine';
type Sort = 'ovr' | 'price' | 'age';

export function Transfer() {
  const { state, openPlayer } = useGame();
  const [tab, setTab] = useState<Tab>('free');
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const [sort, setSort] = useState<Sort>('ovr');
  const [maxPrice, setMaxPrice] = useState(false);
  const teamsById = useMemo(() => Object.fromEntries(state.teams.map((t) => [t.id, t])), [state.teams]);

  const list = useMemo(() => {
    let ps = Object.values(state.players);
    if (tab === 'free') ps = ps.filter((p) => !p.teamId);
    else if (tab === 'clubs') ps = ps.filter((p) => p.teamId && p.teamId !== state.userTeamId);
    else ps = squadOf(state, state.userTeamId);
    if (pos !== 'ALL') ps = ps.filter((p) => p.position === pos);
    if (maxPrice && tab !== 'mine') ps = ps.filter((p) => transferFee(p) <= state.points);
    const key = (p: (typeof ps)[number]) =>
      sort === 'ovr' ? -overall(p) : sort === 'age' ? p.age : tab === 'mine' ? -saleValue(p) : transferFee(p);
    return ps.sort((a, b) => key(a) - key(b)).slice(0, 80);
  }, [state, tab, pos, sort, maxPrice]);

  return (
    <div className="screen">
      <div className="row between">
        <h2 className="screen-title">移籍市場</h2>
        <span className="points-badge">{fmtP(state.points)}</span>
      </div>
      <div className="seg">
        <button className={tab === 'free' ? 'on' : ''} onClick={() => setTab('free')}>
          フリー
        </button>
        <button className={tab === 'clubs' ? 'on' : ''} onClick={() => setTab('clubs')}>
          他クラブ
        </button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          放出・契約
        </button>
      </div>
      <div className="seg scroll small">
        <button className={pos === 'ALL' ? 'on' : ''} onClick={() => setPos('ALL')}>
          全て
        </button>
        {POSITIONS.map((p) => (
          <button key={p} className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="row gap wrap">
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="ovr">総合値順</option>
          <option value="price">{tab === 'mine' ? '売却額順' : '移籍金が安い順'}</option>
          <option value="age">年齢が若い順</option>
        </select>
        {tab !== 'mine' && (
          <label className="check">
            <input type="checkbox" checked={maxPrice} onChange={(e) => setMaxPrice(e.target.checked)} /> 獲得可能のみ
          </label>
        )}
      </div>

      <div className="list">
        {list.length === 0 && <p className="muted center">該当する選手がいません</p>}
        {list.map((p) => {
          const price = tab === 'mine' ? saleValue(p) : transferFee(p);
          const afford = tab === 'mine' || price <= state.points;
          return (
            <PlayerRow
              key={p.id}
              p={p}
              team={p.teamId ? teamsById[p.teamId] : undefined}
              onClick={() => openPlayer(p.id)}
              right={
                <div className="right-stack">
                  <span className={'ovr-inline'}>{overall(p)}</span>
                  <small className={afford ? '' : 'neg'}>
                    {tab === 'mine' ? `売 ${fmtP(price)}` : fmtP(price)}
                  </small>
                  {tab === 'mine' && <small className={p.contractYears <= 1 ? 'warn' : 'muted'}>契約{p.contractYears}年</small>}
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
