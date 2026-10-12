import { earnedTitles, levelProgress, managerLevel, managerTitle, MAX_LEVEL, PERK_TEXT } from '../game/collection';
import { useGame } from '../store';

/** 監督のレベル・称号・効果 */
export function ManagerCard() {
  const { state, update } = useGame();
  const lv = managerLevel(state);
  const [cur, need] = levelProgress(state);
  const titles = earnedTitles(state);
  const title = managerTitle(state);
  return (
    <div className="card mgr-card">
      <div className="row between">
        <div>
          <small className="muted">監督レベル</small>
          <div className="mgr-lv">
            Lv.{lv}
            {lv >= MAX_LEVEL && <small> MAX</small>}
          </div>
        </div>
        <div className="mgr-title">「{title}」</div>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.round((cur / need) * 100)}%`, background: 'var(--accent)' }} />
      </div>
      <small className="muted">勝利・タイトル・実績で経験値がたまります{lv < MAX_LEVEL ? `（次のレベルまで ${need - cur}）` : ''}</small>
      <label className="field">
        <span>表示する称号（フレンドランキングにも表示）</span>
        <select
          value={title}
          onChange={(e) =>
            update((d) => {
              d.manager = { ...(d.manager ?? { xp: 0 }), title: e.target.value };
            })
          }
        >
          {titles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <ul className="mgr-perks">
        {PERK_TEXT.map(([l, t]) => (
          <li key={l} className={lv >= l ? 'on' : ''}>
            <span>Lv.{l}</span> {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
