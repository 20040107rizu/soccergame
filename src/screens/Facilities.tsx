import { FACILITIES, FACILITY_MAX, facilityLevel, startUpgrade, upgradeCost } from '../game/club';
import { fmtMoney } from '../game/economy';
import { useGame } from '../store';

/** クラブの施設：練習場・スカウト網・ユースアカデミー */
export function Facilities() {
  const { state, update, toast } = useGame();
  const b = state.facilities?.building;
  return (
    <>
      <h3 className="section-title">🏗 クラブの施設</h3>
      <div className="card fac-card">
        {b && (
          <div className="fac-building">
            🚧 {FACILITIES.find((f) => f.id === b.kind)?.label}を工事中（完成まで あと{Math.max(0, b.done - state.day)}日程）
          </div>
        )}
        {FACILITIES.map((f) => {
          const lv = facilityLevel(state, f.id);
          const c = upgradeCost(state, f.id);
          return (
            <div key={f.id} className="fac-row">
              <div className="grow">
                <b>
                  {f.icon} {f.label}
                </b>
                <div className="fac-lv">
                  {'■'.repeat(lv)}
                  <span className="muted">{'□'.repeat(FACILITY_MAX - lv)}</span> Lv.{lv}
                </div>
                <small className="muted">{f.effect}</small>
              </div>
              {c ? (
                <button
                  className="btn small"
                  disabled={!!b || state.money < c.cost}
                  onClick={() => {
                    if (!confirm(`${f.label}をLv.${lv + 1}に強化しますか？\n費用 ${fmtMoney(c.cost)}・工期 ${c.days}日程`)) return;
                    const r = update((d) => startUpgrade(d, f.id));
                    toast(r.message ?? '');
                  }}
                >
                  強化
                  <br />
                  <small>{fmtMoney(c.cost)}</small>
                </button>
              ) : (
                <span className="chip accent">MAX</span>
              )}
            </div>
          );
        })}
        <p className="hint">施設の強化には移籍資金を使います。工事は1つずつで、完成までに数日程かかります。</p>
      </div>
    </>
  );
}
