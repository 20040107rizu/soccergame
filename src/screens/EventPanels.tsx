import { useState } from 'react';
import { Crest } from '../components/ui';
import { fmtMoney } from '../game/economy';
import { acceptJob, answerDemand, passGem, persuadeChance, raiseAmount, signGem } from '../game/events';
import { teamById } from '../game/season';
import type { Mail } from '../game/types';
import { useGame } from '../store';

/** メール内で選択するイベント（掘り出し物・わがまま・監督オファー） */
export function EventPanel({ mail, onDone }: { mail: Mail; onDone: () => void }) {
  if (mail.action === 'gem') return <GemPanel playerId={mail.playerId!} onDone={onDone} />;
  if (mail.action === 'demand') return <DemandPanel playerId={mail.playerId!} />;
  if (mail.action === 'job') return <JobPanel />;
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
  const d = state.demand;
  if (result) return <Done text={result} />;
  if (!d || d.playerId !== playerId) return <p className="hint">この件はもう対応済みです。</p>;
  const p = state.players[d.playerId];
  if (!p) return null;
  const run = (c: 'persuade' | 'accept' | 'release') => {
    const r = update((s) => answerDemand(s, c));
    if (!r.ok) return toast(r.message);
    setResult(r.message ?? '');
  };
  return (
    <div className="event-card">
      <div className="event-title">どう対応する？</div>
      <button className="btn" onClick={() => run('persuade')}>
        説得する（成功率 約{Math.round(persuadeChance(state, p) * 100)}%・失敗すると調子と雰囲気が悪化）
      </button>
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
