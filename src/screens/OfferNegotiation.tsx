import { useState } from 'react';
import { Crest, PlayerRow, Sheet } from '../components/ui';
import { windowStatus } from '../game/competitions';
import { fmtMoney, marketValue, round2 } from '../game/economy';
import { teamById } from '../game/season';
import { acceptOffer, MAX_TRIES, negotiateOffer, offerFeeling, rejectOffer } from '../game/transfer';
import { useGame } from '../store';

/** 自クラブの選手に届いたオファーの交渉（希望額の提示・受諾・拒否） */
export function OfferNegotiation({ offerId, onClose }: { offerId: string; onClose: () => void }) {
  const { state, update, toast, openPlayer } = useGame();
  const o = state.offers.find((x) => x.id === offerId);
  const [log, setLog] = useState<{ who: 'me' | 'club'; text: string }[]>([]);
  const [ask, setAsk] = useState(() => (o ? round2(o.fee * 1.25) : 0));
  const [done, setDone] = useState(false);
  const w = windowStatus(state);

  if (!o || done) {
    return (
      <Sheet title="オファー交渉" onClose={onClose}>
        <div className="nego-log">
          {log.map((l, i) => (
            <p key={i} className={'bubble ' + l.who}>
              {l.text}
            </p>
          ))}
        </div>
        <p className="hint">この交渉は終了しました。</p>
        <button className="btn primary big" onClick={onClose}>
          閉じる
        </button>
      </Sheet>
    );
  }

  const p = state.players[o.playerId];
  const buyer = teamById(state, o.fromTeam);
  const mv = marketValue(p);
  const left = MAX_TRIES - (o.tries ?? 0);
  const min = o.fee;
  const max = round2(Math.max(o.fee * 2.5, mv * 2));

  const send = () => {
    const r = update((d) => negotiateOffer(d, offerId, ask));
    setLog((l) => [...l, { who: 'me', text: `${fmtMoney(ask)}でどうだろう？` }, { who: 'club', text: r.message }]);
    if (r.result === 'walkaway') setDone(true);
  };

  return (
    <Sheet title="オファー交渉" onClose={onClose}>
      <PlayerRow
        p={p}
        team={teamById(state, state.userTeamId)}
        onClick={() => {
          onClose();
          openPlayer(p.id);
        }}
      />
      <div className="card offer-head">
        <Crest team={buyer} size={40} />
        <div className="grow">
          <b>{buyer.name}</b>
          <div className="small muted">
            提示額 <b className="accent">{fmtMoney(o.fee)}</b>
            {o.agreed && <span className="chip accent">合意済み</span>}
          </div>
          <div className="small muted">市場価値 {fmtMoney(mv)}</div>
        </div>
      </div>
      <p className="hint">💭 {offerFeeling(state, offerId)}</p>

      {log.length > 0 && (
        <div className="nego-log">
          {log.map((l, i) => (
            <p key={i} className={'bubble ' + l.who}>
              {l.text}
            </p>
          ))}
        </div>
      )}

      {!o.agreed && (
        <div className="card">
          <b>希望額を提示する（残り{left}回）</b>
          <label className="field">
            <span>
              希望額 <b>{fmtMoney(ask)}</b>（提示額の{Math.round((ask / o.fee) * 100)}%）
            </span>
            <input type="range" min={min} max={max} step={Math.max(0.05, round2((max - min) / 200))} value={ask} onChange={(e) => setAsk(Number(e.target.value))} />
          </label>
          <div className="row gap wrap">
            {[1.1, 1.25, 1.5, 2].map((k) => (
              <button key={k} className="chip" onClick={() => setAsk(round2(o.fee * k))}>
                +{Math.round((k - 1) * 100)}%
              </button>
            ))}
            <button className="chip" onClick={() => setAsk(round2(mv * 1.2))}>
              市場価値+20%
            </button>
          </div>
          <button className="btn primary" disabled={left <= 0} onClick={send}>
            この額を提示する
          </button>
        </div>
      )}

      <div className="row gap">
        <button
          className="btn ghost grow"
          onClick={() => {
            update((d) => rejectOffer(d, offerId));
            toast('オファーを断りました');
            onClose();
          }}
        >
          断る
        </button>
        <button
          className="btn primary grow"
          disabled={!w.open}
          onClick={() => {
            if (!confirm(`${p.name}を${buyer.name}へ ${fmtMoney(o.fee)} で売却しますか？`)) return;
            const r = update((d) => acceptOffer(d, offerId));
            toast(r.ok ? '売却が成立しました' : r.message);
            if (r.ok) onClose();
          }}
        >
          {fmtMoney(o.fee)}で売却
        </button>
      </div>
    </Sheet>
  );
}
