import { useState } from 'react';
import { campCost, campTargets, runCampAll } from '../game/club';
import { fmtMoney } from '../game/economy';
import { bulkRenew, bulkRenewPlan, payrollInfo } from '../game/transfer';
import { Seg } from '../components/ui';
import { useGame } from '../store';

/** チームメンバーのまとめて操作：一括能力アップ・一括契約更新 */
export function BulkActions() {
  const { state, update, toast } = useGame();
  const [group, setGroup] = useState<'xi' | 'all'>('xi');
  const [left, setLeft] = useState(1);
  const targets = campTargets(state, group);
  const campTotal = targets.reduce((a, p) => a + campCost(p, 'stat'), 0);
  const plan = bulkRenewPlan(state, left);
  const { total, cap } = payrollInfo(state);
  const add = plan.reduce((a, x) => a + Math.max(0, x.salary - x.p.salary), 0);
  return (
    <div className="card bulk-card">
      <b>🏕 まとめて能力アップ</b>
      <Seg
        small
        value={group}
        onChange={setGroup}
        options={[
          { v: 'xi', label: 'スタメン11人' },
          { v: 'all', label: '全員' },
        ]}
      />
      <small className="muted">
        対象 {targets.length}人（ケガ中・今日特訓済みは除く）· 合計 {fmtMoney(campTotal)}
        {state.money < campTotal ? '（資金が足りない分は、総合値の高い選手から順に途中まで）' : ''}
      </small>
      <button
        className="btn primary"
        disabled={!targets.length || state.money < campCost(targets[0], 'stat')}
        onClick={() => {
          if (!confirm(`${targets.length}人をまとめて特訓しますか？（最大 ${fmtMoney(campTotal)}）`)) return;
          const r = update((d) => runCampAll(d, group));
          toast(`${r.done}人を特訓しました（${fmtMoney(r.cost)}）。${r.up}人の総合値が上がりました！`);
        }}
      >
        まとめて特訓する
      </button>

      <b>📝 まとめて契約更新</b>
      <Seg
        small
        value={String(left)}
        onChange={(v) => setLeft(Number(v))}
        options={[
          { v: '1', label: '残り1年以下' },
          { v: '2', label: '残り2年以下' },
          { v: '9', label: '全員' },
        ]}
      />
      <small className="muted">
        対象 {plan.length}人 · 希望年俸どおりに提示（年数は年齢に合わせて自動）· 年俸総額 {fmtMoney(total)} → 約{fmtMoney(total + add)} / 上限 {fmtMoney(cap)}
        {total + add > cap ? '（上限を超える分は、総合値の低い選手から更新されません）' : ''}
      </small>
      <button
        className="btn primary"
        disabled={!plan.length}
        onClick={() => {
          if (!confirm(`${plan.length}人とまとめて契約を更新しますか？`)) return;
          const r = update((d) => bulkRenew(d, left));
          toast(`${r.done.length}人と契約を更新しました${r.skipped.length ? `（${r.skipped.length}人は年俸の上限などで更新できず）` : ''}`);
        }}
      >
        まとめて契約更新する
      </button>
    </div>
  );
}
