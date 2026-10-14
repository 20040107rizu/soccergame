import { ClubScene } from '../components/ClubScene';
import { FACILITIES, FACILITY_MAX, facilityLevel, sceneData, sceneSnap, gateIncome, REGIONS, stadiumCapacity, stadiumCost, stadiumLevel, STADIUM_MAX, startExpedition, startStadium, startUpgrade, upgradeCost } from '../game/club';
import { fmtMoney } from '../game/economy';
import { useGame } from '../store';

/** レベルの目盛り（10マス。Lv.11 からは金色で重ねていく） */
const bar = (lv: number, max: number) => (
  <span className="fac-lv">
    {Array.from({ length: max / 2 }, (_, i) => (
      <span key={i} className={lv > i + max / 2 ? 'gold' : lv > i ? '' : 'muted'}>
        {lv > i ? '■' : '□'}
      </span>
    ))}{' '}
    Lv.{lv}
  </span>
);

const jump = (id: string) => document.getElementById('fac-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

/** クラブの施設・スタジアム・海外スカウト遠征 */
export function Facilities() {
  const { state, update, toast } = useGame();
  const b = state.facilities?.building;
  const st = state.stadium;
  const sc = stadiumCost(state);
  const ex = state.expedition;
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  return (
    <>
      <h3 className="section-title">🏙 クラブの全景</h3>
      <ClubScene d={sceneData(sceneSnap(state), st?.name || 'ホームスタジアム', [team.color, team.color2])} onTap={jump} />
      <p className="hint">建物をタップすると、その施設の強化に移動します。</p>

      <h3 className="section-title">🏟 スタジアム</h3>
      <div className="card fac-card" id="fac-stadium">
        {st?.building && <div className="fac-building">🚧 拡張工事中（完成まで あと{Math.max(0, st.building - state.day)}日程）</div>}
        <div className="fac-row">
          <div className="grow">
            <b>🏟 {st?.name || 'ホームスタジアム'}</b>
            {bar(stadiumLevel(state), STADIUM_MAX)}
            <small className="muted">
              収容 {stadiumCapacity(state).toLocaleString()}人 · ホームの入場収入 {fmtMoney(gateIncome(state))}／試合
            </small>
            <small className="muted">拡張するたびに入場収入・クラブの格・年俸総額の上限が上がります</small>
          </div>
          {sc ? (
            <button
              className="btn small"
              disabled={!!st?.building || state.money < sc.cost}
              onClick={() => {
                if (!confirm(`スタジアムをLv.${stadiumLevel(state) + 1}に拡張しますか？\n費用 ${fmtMoney(sc.cost)}・工期 ${sc.days}日程`)) return;
                const r = update((d) => startStadium(d));
                toast(r.message ?? '');
              }}
            >
              拡張
              <br />
              <small>{fmtMoney(sc.cost)}</small>
            </button>
          ) : (
            <span className="chip accent">MAX</span>
          )}
        </div>
      </div>

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
            <div key={f.id} className="fac-row" id={'fac-' + f.id}>
              <div className="grow">
                <b>
                  {f.icon} {f.label}
                </b>
                {bar(lv, FACILITY_MAX)}
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

      <h3 className="section-title">✈️ 海外スカウト遠征</h3>
      <div className="card fac-card">
        {ex ? (
          <div className="fac-building">
            ✈️ スカウトが{REGIONS.find((r) => r.id === ex.region)?.label}に遠征中（報告まで あと{Math.max(0, ex.done - state.day)}日程）
          </div>
        ) : (
          <p className="hint">スカウトを海外に送り込み、まだ知られていない才能を探します。報告では必ず1人、掘り出し物の話を持ち帰ります（ふだんより当たりが出やすい）。</p>
        )}
        {REGIONS.map((r) => (
          <div key={r.id} className="fac-row">
            <div className="grow">
              <b>
                {r.icon} {r.label}
              </b>
              <small className="muted">{r.note}</small>
            </div>
            <button
              className="btn small"
              disabled={!!ex || state.money < r.cost}
              onClick={() => {
                if (!confirm(`${r.label}へスカウトを送りますか？\n費用 ${fmtMoney(r.cost)}`)) return;
                const res = update((d) => startExpedition(d, r.id));
                toast(res.message ?? '');
              }}
            >
              派遣
              <br />
              <small>{fmtMoney(r.cost)}</small>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
