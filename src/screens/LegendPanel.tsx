import { useState } from 'react';
import { fmtMoney } from '../game/economy';
import { acceptLegend, chanceLabel, declineLegend, LEGEND_LABEL } from '../game/legend';
import { useGame } from '../store';

/** レジェンド選手の極秘オファー（条件の承諾・見送り） */
export function LegendPanel({ playerId, onDone }: { playerId: string; onDone: () => void }) {
  const { state, update, toast } = useGame();
  const [result, setResult] = useState<string | null>(null);
  const o = state.legendOffer;
  if (result) return <div className="legend-card result">{result}</div>;
  if (!o || o.playerId !== playerId) return null;
  const p = state.players[o.playerId];
  if (!p) return null;
  const left = Math.max(0, o.expires - state.day);
  return (
    <div className="legend-card">
      <div className="legend-title">
        🌟 {LEGEND_LABEL[o.kind]}の選手 <small>回答期限 あと{left}日</small>
      </div>
      <ul>
        {o.conditions.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="small">
        入団の可能性：<b>{chanceLabel(o.chance)}</b>
        <br />
        移籍資金：{fmtMoney(state.money)}
        {state.money < o.fee && <span className="neg">（不足）</span>}
      </p>
      <div className="row gap">
        <button
          className="btn ghost grow"
          onClick={() => {
            if (!confirm(`${p.name}の話を見送りますか？もう二度と現れないかもしれません。`)) return;
            update((d) => declineLegend(d));
            onDone();
          }}
        >
          見送る
        </button>
        <button
          className="btn legend-btn grow"
          disabled={state.money < o.fee}
          onClick={() => {
            if (!confirm(`条件をすべて承諾して、${p.name}に入団を打診しますか？\n（断られた場合、移籍金はかかりませんが、この話は終わります）`)) return;
            const r = update((d) => acceptLegend(d));
            if (!r.ok) return toast(r.message);
            setResult(r.joined ? `🎉 ${p.name}が入団を決断！` : `😢 ${p.name}は入団を断りました…`);
          }}
        >
          条件を承諾して打診
        </button>
      </div>
    </div>
  );
}
