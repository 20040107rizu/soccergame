import { useState } from 'react';
import { CondArrow, Ovr, PlayerIcon, PosTag, Seg, Sheet } from '../components/ui';
import { fmtMoney, marketValue, round2 } from '../game/economy';
import { teamById } from '../game/season';
import { overall } from '../game/stats';
import {
  askingPrice,
  canNegotiate,
  completeSigning,
  MAX_TRIES,
  negotiationOf,
  offerToClub,
  offerToPlayer,
  PLAYER_TRIES,
  payrollInfo,
  playerInterest,
  salaryDemand,
  wageRoomFor,
} from '../game/transfer';
import { useGame } from '../store';

/** マスターリーグ風の移籍交渉：①クラブと移籍金 → ②選手と契約条件 */
export function Negotiation({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, update, toast } = useGame();
  const p = state.players[id];
  const rec = negotiationOf(state, id);
  const club = p.teamId ? teamById(state, p.teamId) : null;
  const value = marketValue(p);
  const ask = club ? askingPrice(state, p) : 0;
  const [fee, setFee] = useState(() => round2(Math.max(0.1, value)));
  const it = playerInterest(state, p);
  const demand = salaryDemand(state, p);
  const [salary, setSalary] = useState(() => round2(demand * 0.9));
  const [years, setYears] = useState(p.age >= 31 ? 2 : 4);
  const [log, setLog] = useState<{ who: 'me' | 'club' | 'player'; text: string }[]>([]);
  const check = canNegotiate(state, p);
  const step: 'club' | 'player' = !club || rec.agreedFee !== undefined ? 'player' : 'club';
  const { total, cap } = payrollInfo(state);
  const wage = wageRoomFor(state, p);

  if (!check.ok) {
    return (
      <Sheet title="移籍交渉" onClose={onClose}>
        <p>{check.message}</p>
      </Sheet>
    );
  }

  return (
    <Sheet title="移籍交渉" onClose={onClose}>
      <div className="pd-head">
        <PlayerIcon p={p} team={club ?? undefined} size={56} />
        <div className="grow">
          <div className="pd-name">{p.name}</div>
          <div className="pd-sub">
            <PosTag pos={p.position} /> {p.age}歳 · {club ? club.name : 'フリー'}
          </div>
          <div className="pd-sub">
            市場価値 {fmtMoney(value)} · 年俸 {fmtMoney(p.salary)}
          </div>
        </div>
        <div className="pd-ovr">
          <Ovr v={overall(p)} big />
          <CondArrow c={p.condition} size={18} />
        </div>
      </div>

      <div className="steps">
        <span className={step === 'club' ? 'on' : 'done'}>① クラブと交渉</span>
        <span className={step === 'player' ? 'on' : ''}>② 選手と契約</span>
      </div>

      {log.length > 0 && (
        <div className="nego-log">
          {log.map((l, i) => (
            <div key={i} className={'bubble ' + l.who}>
              {l.text}
            </div>
          ))}
        </div>
      )}

      {!rec.closed && !wage.enough && (
        <div className="warn-box">
          年俸の空き枠が足りません（年俸総額 {fmtMoney(total)} / 上限 {fmtMoney(cap)}・空き {fmtMoney(wage.room)}）。
          <br />
          今の空きでは、この選手の希望年俸に届きません。移籍画面で選手を売却・契約解除して枠を空けてから交渉しましょう。
        </div>
      )}

      {rec.closed ? (
        <div className="warn-box">交渉は打ち切られました。次の移籍期間に再挑戦できます。</div>
      ) : step === 'club' && club ? (
        <div className="card">
          <b>{club.name}への移籍金オファー</b>
          <p className="hint">
            クラブ内での立場や契約年数によって、求められる金額は市場価値より高くなります。
            {ask > value * 1.3 ? '（主力選手のため、かなり高額になりそうだ）' : ''}
            残り交渉回数 {MAX_TRIES - rec.clubTries}
          </p>
          <div className="money-input">
            <button className="icon-btn" onClick={() => setFee(round2(Math.max(0.1, fee - Math.max(0.5, fee * 0.05))))}>
              −
            </button>
            <b>{fmtMoney(fee)}</b>
            <button className="icon-btn" onClick={() => setFee(round2(fee + Math.max(0.5, fee * 0.05)))}>
              ＋
            </button>
          </div>
          <input type="range" min={0.1} max={Math.max(value * 3, 5)} step={0.1} value={fee} onChange={(e) => setFee(Number(e.target.value))} />
          <p className={'hint ' + (fee > state.money ? 'neg' : '')}>移籍資金：{fmtMoney(state.money)}</p>
          <button
            className="btn primary big"
            disabled={fee > state.money || !wage.enough}
            onClick={() => {
              const r = update((d) => offerToClub(d, id, fee));
              setLog((l) => [...l, { who: 'me', text: `移籍金 ${fmtMoney(fee)} を提示` }, { who: 'club', text: r.message }]);
              if (r.counter) setFee(r.counter);
            }}
          >
            オファーを送る
          </button>
        </div>
      ) : (
        <div className="card">
          <b>{p.name}との契約交渉</b>
          {rec.agreedFee !== undefined && <p className="hint">移籍金 {fmtMoney(rec.agreedFee)} でクラブと合意済み</p>}
          <div className="interest">
            <div className="row between">
              <span>移籍への興味</span>
              <b>{it.score >= 70 ? '強い' : it.score >= 45 ? 'ある' : it.score >= 25 ? '低い' : 'ほとんどない'}</b>
            </div>
            <div className="meter">
              <i style={{ width: `${it.score}%`, background: it.score >= 60 ? '#3ccb5a' : it.score >= 35 ? '#f2d43d' : '#e5484d' }} />
            </div>
            <ul className="reasons">
              {it.reasons.map((r) => (
                <li key={r.label}>
                  <span>{r.label}</span>
                  <b className={r.good === true ? 'pos-num' : r.good === false ? 'neg' : ''}>{r.value}</b>
                </li>
              ))}
            </ul>
          </div>
          <p className="hint">
            残り交渉回数 {Math.max(0, PLAYER_TRIES - rec.playerTries)} · 年俸の空き枠 {fmtMoney(wage.room)}
          </p>
          <label className="field">
            <span>年俸（年額）</span>
            <div className="money-input">
              <button className="icon-btn" onClick={() => setSalary(round2(Math.max(0.05, salary - Math.max(0.05, salary * 0.05))))}>
                −
              </button>
              <b>{fmtMoney(salary)}</b>
              <button className="icon-btn" onClick={() => setSalary(round2(salary + Math.max(0.05, salary * 0.05)))}>
                ＋
              </button>
            </div>
            <input type="range" min={0.05} max={Math.max(demand * 2.2, 1)} step={0.05} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
          </label>
          <div className="field">
            <span>契約年数</span>
            <Seg small value={String(years)} options={[1, 2, 3, 4, 5].map((y) => ({ v: String(y), label: `${y}年` }))} onChange={(v) => setYears(Number(v))} />
          </div>
          {salary > wage.room && <p className="hint neg">提示額が年俸の空き枠（{fmtMoney(wage.room)}）を超えています</p>}
          <button
            className="btn primary big"
            disabled={salary > wage.room}
            onClick={() => {
              const r = update((d) => offerToPlayer(d, id, salary, years));
              setLog((l) => [...l, { who: 'me', text: `年俸 ${fmtMoney(salary)}・${years}年契約を提示` }, { who: 'player', text: r.message }]);
              if (r.result === 'counter' && r.counter) setSalary(r.counter);
              if (r.result === 'accept') {
                const done = update((d) => completeSigning(d, id, salary, years));
                if (done.ok) {
                  toast(`${p.name}の獲得が決まりました！`);
                  onClose();
                } else toast(done.message);
              }
            }}
          >
            条件を提示する
          </button>
        </div>
      )}
    </Sheet>
  );
}
