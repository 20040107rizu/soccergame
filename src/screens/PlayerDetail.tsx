import { Avatar } from '../components/Avatar';
import { Ovr, PosTag, Sheet, StatBar, fmtP } from '../components/ui';
import { marketValue, overall } from '../game/rating';
import { buyPlayer, canBuy, canSell, renewContract, renewFee, saleValue, sellPlayer, transferFee } from '../game/transfer';
import { STAT_KEYS, STAT_LABEL } from '../game/types';
import { useGame } from '../store';

export function PlayerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, update, toast, editPlayer } = useGame();
  const p = state.players[id];
  if (!p) return null;
  const team = p.teamId ? state.teams.find((t) => t.id === p.teamId) : undefined;
  const mine = p.teamId === state.userTeamId;
  const fee = transferFee(p);
  const buyCheck = canBuy(state, p);
  const sellCheck = canSell(state, p);

  return (
    <Sheet title="選手詳細" onClose={onClose}>
      <div className="pd-head">
        <Avatar a={p.appearance} color={team?.color ?? '#475569'} color2={team?.color2 ?? '#fff'} number={p.number} size={84} />
        <div className="grow">
          <div className="pd-name">{p.name}</div>
          <div className="pd-sub">
            <PosTag pos={p.position} /> {p.age}歳 · {p.nationality} · {p.foot === 'R' ? '右足' : '左足'}
          </div>
          <div className="pd-sub">{team ? team.name : 'フリー'}</div>
        </div>
        <div className="pd-ovr">
          <small>総合</small>
          <Ovr v={overall(p)} />
        </div>
      </div>

      <div className="pd-grid">
        <div>
          <small>評価額</small>
          <b>{fmtP(marketValue(p))}</b>
        </div>
        <div>
          <small>年俸</small>
          <b>{fmtP(p.salary)}</b>
        </div>
        <div>
          <small>契約</small>
          <b>{p.teamId ? `残り${p.contractYears}年` : '—'}</b>
        </div>
        <div>
          <small>今季</small>
          <b>
            {p.season.apps}試合 {p.season.goals}G {p.season.assists}A
          </b>
        </div>
        <div>
          <small>通算</small>
          <b>
            {p.career.apps}試合 {p.career.goals}G {p.career.assists}A
          </b>
        </div>
      </div>

      <div className="stats">
        {STAT_KEYS.filter((k) => k !== 'keeper' || p.position === 'GK').map((k) => (
          <StatBar key={k} label={STAT_LABEL[k]} value={p.stats[k]} />
        ))}
      </div>

      <div className="pd-actions">
        {!mine && (
          <button
            className="btn primary"
            disabled={!buyCheck.ok}
            onClick={() => {
              if (!confirm(`${p.name}を${fmtP(fee)}で獲得しますか？\n年俸は約${fmtP(Math.round(p.salary))}になります。`)) return;
              const r = update((d) => buyPlayer(d, p.id));
              toast(r.ok ? `${p.name}を獲得しました！` : r.reason);
            }}
          >
            獲得する（{fmtP(fee)}）{!buyCheck.ok && <small> {buyCheck.reason}</small>}
          </button>
        )}
        {mine && (
          <>
            <button
              className="btn"
              onClick={() => {
                if (!confirm(`契約を1年延長しますか？（契約金 ${fmtP(renewFee(p))}）`)) return;
                const r = update((d) => renewContract(d, p.id));
                toast(r.ok ? '契約を延長しました' : r.reason);
              }}
            >
              契約延長（{fmtP(renewFee(p))}）
            </button>
            <button
              className="btn danger"
              disabled={!sellCheck.ok}
              onClick={() => {
                if (!confirm(`${p.name}を放出して${fmtP(saleValue(p))}を受け取りますか？`)) return;
                const r = update((d) => sellPlayer(d, p.id));
                toast(r.ok ? '放出しました' : r.reason);
                if (r.ok) onClose();
              }}
            >
              放出（+{fmtP(saleValue(p))}）{!sellCheck.ok && <small> {sellCheck.reason}</small>}
            </button>
          </>
        )}
        <button
          className="btn ghost"
          onClick={() => {
            onClose();
            editPlayer(p.id);
          }}
        >
          エディット
        </button>
      </div>
    </Sheet>
  );
}
