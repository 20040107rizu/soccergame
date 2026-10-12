import { useState } from 'react';
import { BadgeWall } from '../components/Badges';
import { Jersey } from '../components/Jersey';
import { computeBadges } from '../game/badges';
import { buildMuseum, buyKit, currentKit, KITS, MUSEUM_COST, ownedKits, renameStadium, RENAME_COST } from '../game/club';
import { managerLevel } from '../game/collection';
import { fmtMoney } from '../game/economy';
import { teamById } from '../game/season';
import { useGame } from '../store';

/** 自分のバッジ */
export function MyBadges() {
  const { state } = useGame();
  const ids = computeBadges(state, managerLevel(state), Object.keys(state.dex ?? {}).length);
  return (
    <>
      <h3 className="section-title">🎖 バッジ（{ids.length}）</h3>
      <div className="card">
        <BadgeWall ids={ids} mine={new Set(ids)} />
        <p className="hint">バッジはフレンドランキングにも表示されます。レア度は ノーマル → レア → スーパーレア → レジェンド → ミシック。🍀 は運も必要な珍しいバッジ。</p>
      </div>
    </>
  );
}

/** 見た目・自慢用のお店 */
export function Cosmetics() {
  const { state, update, toast } = useGame();
  const team = teamById(state, state.userTeamId);
  const [name, setName] = useState(state.stadium?.name ?? '');
  const owned = ownedKits(state);
  const kit = currentKit(state);
  return (
    <>
      <h3 className="section-title">🛍 クラブの見た目</h3>
      <div className="card cos-card">
        <b>ユニフォームの柄</b>
        <div className="kit-grid">
          {KITS.map((k) => {
            const has = owned.includes(k.id);
            return (
              <button
                key={k.id}
                className={'kit-cell' + (kit === k.id ? ' on' : '')}
                disabled={!has && state.money < k.cost}
                onClick={() => {
                  if (!has && !confirm(`「${k.label}」のユニフォームを ${fmtMoney(k.cost)} で手に入れますか？`)) return;
                  const r = update((d) => buyKit(d, k.id));
                  toast(r.message ?? '');
                }}
              >
                <Jersey color={team.color} color2={team.color2} number={10} size={48} pattern={k.id} />
                <small>{k.label}</small>
                <small className="muted">{has ? (kit === k.id ? '着用中' : '持っている') : fmtMoney(k.cost)}</small>
              </button>
            );
          })}
        </div>

        <b>スタジアムの名前</b>
        <div className="row gap">
          <input className="grow" value={name} maxLength={20} placeholder="例：ドリームアリーナ" onChange={(e) => setName(e.target.value)} />
          <button
            className="btn small"
            disabled={!name.trim() || name.trim() === state.stadium?.name || state.money < RENAME_COST}
            onClick={() => {
              const r = update((d) => renameStadium(d, name));
              toast(r.message ?? '');
            }}
          >
            命名
            <br />
            <small>{fmtMoney(RENAME_COST)}</small>
          </button>
        </div>

        <b>クラブ博物館</b>
        {state.cosmetics?.museum ? (
          <p className="small">🏛 クラブの歴史を伝える博物館が建っています。</p>
        ) : (
          <button
            className="btn"
            disabled={state.money < MUSEUM_COST}
            onClick={() => {
              if (!confirm(`クラブ博物館を ${fmtMoney(MUSEUM_COST)} で建てますか？`)) return;
              const r = update((d) => buildMuseum(d));
              toast(r.message ?? '');
            }}
          >
            🏛 博物館を建てる（{fmtMoney(MUSEUM_COST)}）
          </button>
        )}
        <p className="hint">殿堂入りした選手の銅像は、「クラブの記録」の殿堂から建てられます。</p>
      </div>
    </>
  );
}
