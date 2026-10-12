import { useState } from 'react';
import { MAX_SUBS } from '../game/engine';
import { posFromXY } from '../game/positions';
import { teamById } from '../game/season';
import type { Player } from '../game/types';
import { useGame } from '../store';

/** 「結果のみ」で試合を進める時の、ハーフタイムの交代予約 */
export function HalftimePlan() {
  const { state, update } = useGame();
  const [open, setOpen] = useState(false);
  const team = teamById(state, state.userTeamId);
  const plan = team.halftimeSubs ?? [];
  const label = (p?: Player) => (p ? `${p.position} ${p.name}` : '（いない選手）');
  const valid = (s: { out: string; in: string }) => team.lineup.includes(s.out) && team.bench.includes(s.in);
  const set = (next: { out: string; in: string }[]) =>
    update((d) => {
      teamById(d, d.userTeamId).halftimeSubs = next;
    });

  // GK の枠には GK、フィールドの枠にはフィールドの選手だけ
  const gkSlot = (outId: string) => {
    const i = team.lineup.indexOf(outId);
    return i >= 0 && posFromXY(team.slots[i].x, team.slots[i].y) === 'GK';
  };
  const fits = (outId: string, inId: string) => gkSlot(outId) === (state.players[inId]?.position === 'GK');
  const usedOut = new Set(plan.map((s) => s.out));
  const usedIn = new Set(plan.map((s) => s.in));
  const freeOut = team.lineup.filter((id) => id && !usedOut.has(id));
  const freeIn = team.bench.filter((id) => !usedIn.has(id));

  return (
    <div className="card ht-plan">
      <button className="ht-head" onClick={() => setOpen(!open)}>
        <b>⏱ ハーフタイムの交代予約</b>
        <span className="muted small">{plan.length ? `${plan.length}人予約中` : 'なし'} {open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          <p className="hint">「結果のみ」で試合を進めた時、ハーフタイムにここで決めた交代を行います（試合を観る時は使いません）。ケガ・出場停止などで出られない選手の予約は飛ばします。</p>
          {plan.map((s, i) => (
            <div key={i} className={'ht-row' + (valid(s) ? '' : ' bad')}>
              <select
                value={s.out}
                onChange={(e) => {
                  const out = e.target.value;
                  const inn = fits(out, s.in) ? s.in : freeIn.find((id) => fits(out, id)) ?? s.in;
                  set(plan.map((x, j) => (j === i ? { out, in: inn } : x)));
                }}
              >
                {[s.out, ...freeOut].map((id) => (
                  <option key={id} value={id}>
                    {label(state.players[id])}
                  </option>
                ))}
              </select>
              <span className="ht-arrow">→</span>
              <select
                value={s.in}
                onChange={(e) => set(plan.map((x, j) => (j === i ? { ...x, in: e.target.value } : x)))}
              >
                {[s.in, ...freeIn.filter((id) => fits(s.out, id))].map((id) => (
                  <option key={id} value={id}>
                    {label(state.players[id])}
                  </option>
                ))}
              </select>
              <button className="icon-btn" aria-label="予約を消す" onClick={() => set(plan.filter((_, j) => j !== i))}>
                ×
              </button>
              {!valid(s) && <small className="neg ht-warn">スタメン・ベンチが変わったため、この予約は今は使えません</small>}
            </div>
          ))}
          {plan.length < MAX_SUBS && freeOut.some((o) => freeIn.some((n) => fits(o, n))) && (
            <button
              className="btn small"
              onClick={() => {
                const out = [...freeOut].reverse().find((o) => freeIn.some((n) => fits(o, n)))!;
                set([...plan, { out, in: freeIn.find((n) => fits(out, n))! }]);
              }}
            >
              ＋ 交代を予約する
            </button>
          )}
          {team.bench.length === 0 && <p className="hint">ベンチに選手がいません。</p>}
        </>
      )}
    </div>
  );
}
