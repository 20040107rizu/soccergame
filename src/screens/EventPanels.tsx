import { useState } from 'react';
import { Crest } from '../components/ui';
import { fmtMoney } from '../game/economy';
import { acceptJob, answerDemand, compromiseAmount, compromiseChance, DEMAND_TRIES, passGem, persuadeChance, raiseAmount, signGem } from '../game/events';
import { teamById } from '../game/season';
import { declineLegendChallenge, legendTeamSnapshot, negotiateLegendPick, pickCandidates, pickTerms } from '../game/legendChallenge';
import { PosTag } from '../components/ui';
import type { Mail } from '../game/types';
import { useGame } from '../store';

/** メール内で選択するイベント（掘り出し物・わがまま・監督オファー） */
export function EventPanel({ mail, onDone }: { mail: Mail; onDone: () => void }) {
  if (mail.action === 'gem') return <GemPanel playerId={mail.playerId!} onDone={onDone} />;
  if (mail.action === 'demand') return <DemandPanel playerId={mail.playerId!} />;
  if (mail.action === 'job') return <JobPanel />;
  if (mail.action === 'legendMatch') return <LegendMatchPanel onDone={onDone} />;
  if (mail.action === 'legendPick') return <LegendPickPanel />;
  return null;
}

function Done({ text }: { text: string }) {
  return <div className="event-card result">{text}</div>;
}

function GemPanel({ playerId, onDone }: { playerId: string; onDone: () => void }) {
  const { state, update, toast } = useGame();
  const [result, setResult] = useState<string | null>(null);
  const o = state.gemOffer;
  if (result) return <Done text={result} />;
  if (!o || o.playerId !== playerId) return <p className="hint">この話はもう終わっています。</p>;
  return (
    <div className="event-card">
      <div className="event-title">
        🔍 スカウトの見立て <small>回答期限 あと{Math.max(0, o.expires - state.day)}日</small>
      </div>
      <p className="small">
        推定総合値 <b>{o.estLow}〜{o.estHigh}</b> / 伸びしろ <b>？？？</b>
        <br />
        移籍金 <b>{fmtMoney(o.fee)}</b> · 年俸 {fmtMoney(o.salary)}
      </p>
      <div className="row gap">
        <button
          className="btn ghost grow"
          onClick={() => {
            update((d) => passGem(d));
            onDone();
          }}
        >
          見送る
        </button>
        <button
          className="btn primary grow"
          disabled={state.money < o.fee}
          onClick={() => {
            const r = update((d) => signGem(d));
            if (!r.ok) return toast(r.message);
            setResult('獲得しました！ 正体はスカウトからのメールで…');
          }}
        >
          賭けてみる（{fmtMoney(o.fee)}）
        </button>
      </div>
    </div>
  );
}

function DemandPanel({ playerId }: { playerId: string }) {
  const { state, update, toast } = useGame();
  const [result, setResult] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const d = state.demand;
  if (result) return <Done text={result} />;
  if (!d || d.playerId !== playerId) return <p className="hint">この件はもう対応済みです。</p>;
  const p = state.players[d.playerId];
  if (!p) return null;
  const run = (c: 'persuade' | 'compromise' | 'accept' | 'release') => {
    const r = update((s) => answerDemand(s, c));
    if (!r.ok) return toast(r.message);
    if ('keep' in r && r.keep) return setNote(r.message ?? '');
    setResult(r.message ?? '');
  };
  const left = DEMAND_TRIES - (d.tries ?? 0);
  return (
    <div className="event-card">
      <div className="event-title">
        どう対応する？ <small>話し合いできる回数 あと{left}回</small>
      </div>
      {note && <p className="small">{note}</p>}
      <button className="btn" onClick={() => run('persuade')}>
        説得する（成功率 約{Math.round(persuadeChance(state, p) * 100)}%）
      </button>
      {d.kind === 'raise' && (
        <button className="btn" onClick={() => run('compromise')}>
          間を取る（年俸 {fmtMoney(p.salary)} → {fmtMoney(compromiseAmount(p))}・成功率 約{Math.round(compromiseChance(state, p) * 100)}%）
        </button>
      )}
      <p className="hint">話し合いが決裂すると、調子とチームの雰囲気が悪化します</p>
      <button className="btn" onClick={() => run('accept')}>
        {d.kind === 'raise' ? `要求をのむ（年俸 ${fmtMoney(p.salary)} → ${fmtMoney(raiseAmount(p))}）` : '要求をのむ（次の6試合で3試合以上の先発を約束）'}
      </button>
      <button className="btn danger" onClick={() => run('release')}>
        放出する（移籍リストに載せる）
      </button>
    </div>
  );
}

function JobPanel() {
  const { state, update, toast } = useGame();
  const [result, setResult] = useState<string | null>(null);
  const o = state.jobOffer;
  if (result) return <Done text={result} />;
  if (!o) return <p className="hint">このオファーはもう有効ではありません。</p>;
  return (
    <div className="event-card">
      <div className="event-title">就任するクラブを選ぶ</div>
      {o.teamIds.map((id) => {
        const t = teamById(state, id);
        return (
          <button
            key={id}
            className="btn job-btn"
            onClick={() => {
              if (!confirm(`${t.name}の監督に就任しますか？\n今のクラブには戻れません。`)) return;
              const r = update((d) => acceptJob(d, id));
              if (!r.ok) return toast(r.message);
              setResult(`🎉 ${t.name}の監督に就任しました！`);
            }}
          >
            <Crest team={t} size={28} /> {t.name}
            <small className="muted"> 格{t.rep} · 資金 {fmtMoney(t.budget)}</small>
          </button>
        );
      })}
      <button
        className="btn ghost"
        onClick={() => {
          update((d) => {
            delete d.jobOffer;
          });
          setResult('今のクラブに残ることにしました');
        }}
      >
        残留する
      </button>
    </div>
  );
}

/** レジェンドXI からの挑戦状 */
function LegendMatchPanel({ onDone }: { onDone: () => void }) {
  const { state, update } = useGame();
  const c = state.legendChallenge;
  if (!c || c.status !== 'invited') return <p className="hint">この挑戦はもう終わっています。</p>;
  return (
    <div className="legend-card">
      <div className="legend-title">
        ⚔️ レジェンドXI <small>回答期限 あと{Math.max(0, c.expires - state.day)}日</small>
      </div>
      <p className="small">伝説の選手たちとの一戦。勝てば、その中の1人と移籍交渉ができます。挑戦は1回きりです。</p>
      <div className="row gap">
        <button
          className="btn ghost grow"
          onClick={() => {
            if (!confirm('挑戦を辞退しますか？')) return;
            update((d) => declineLegendChallenge(d));
            onDone();
          }}
        >
          辞退する
        </button>
        <button
          className="btn legend-btn grow"
          onClick={() => {
            onDone();
            window.dispatchEvent(new CustomEvent('start-friendly', { detail: { snap: legendTeamSnapshot(), nickname: '', challenge: true } }));
          }}
        >
          挑戦する
        </button>
      </div>
    </div>
  );
}

/** 勝利後：レジェンドを1人選んで交渉 */
function LegendPickPanel() {
  const { state, update, toast } = useGame();
  const [pick, setPick] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const c = state.legendChallenge;
  if (result) return <div className="legend-card result">{result}</div>;
  if (!c || c.status !== 'won') return <p className="hint">この話はもう終わっています。</p>;
  const { fee } = pickTerms(state);
  const cands = pickCandidates();
  const sel = cands.find((x) => x.id === pick);
  return (
    <div className="legend-card">
      <div className="legend-title">
        🌟 交渉する選手を1人選ぶ <small>回答期限 あと{Math.max(0, c.expires - state.day)}日</small>
      </div>
      <div className="legend-picks">
        {cands.map((x) => (
          <button key={x.id} className={'legend-pick' + (pick === x.id ? ' on' : '')} onClick={() => setPick(x.id)}>
            <PosTag pos={x.pos} /> {x.name}
          </button>
        ))}
      </div>
      {sel && (
        <>
          <p className="small">
            交渉に応じてくれれば、<b>若き日の{sel.name}</b>が加入します（今はまだ荒削り）。
            <br />
            移籍金 <b>{fmtMoney(fee)}</b> · 交渉のチャンスは1回だけ。かなり難しい交渉です。
          </p>
          <button
            className="btn legend-btn"
            disabled={state.money < fee}
            onClick={() => {
              if (!confirm(`${sel.name}と交渉しますか？（チャンスは1回だけです）`)) return;
              const r = update((d) => negotiateLegendPick(d, sel.id));
              if (!r.ok) return toast(r.message);
              setResult(r.joined ? `🎉 若き日の${sel.name}が入団！` : `😢 ${sel.name}は首を縦に振らなかった…`);
            }}
          >
            {sel.name}と交渉する
          </button>
        </>
      )}
    </div>
  );
}
