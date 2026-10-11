import { POS_COORD } from '../game/positions';
import { ratingAt } from '../game/stats';
import type { Aptitudes, Player, Position } from '../game/types';
import { POSITIONS } from '../game/types';

const LEVEL_COLOR = ['rgba(255,255,255,0.06)', '#2f9e6a', '#f2b33d', '#e5484d'];
const LEVEL_LABEL = ['—', '可', '適性', 'メイン'];

/**
 * ポジション適性のヒートマップ（eFootball 風）。
 * メイン=赤、適性あり=橙、可=緑。onTap を渡すと編集できる。
 */
export function Heatmap(props: { aptitudes: Aptitudes; main: Position; player?: Player; onTap?: (pos: Position) => void; size?: number }) {
  const { aptitudes, main, player, onTap } = props;
  return (
    <div className="heatmap">
      <svg viewBox="0 0 100 130" className="heatmap-svg">
        <rect x="1" y="1" width="98" height="128" rx="4" fill="#1d6b41" stroke="#e8fff044" strokeWidth="0.8" />
        <g stroke="#e8fff033" strokeWidth="0.6" fill="none">
          <line x1="1" y1="65" x2="99" y2="65" />
          <circle cx="50" cy="65" r="10" />
          <rect x="25" y="1" width="50" height="16" />
          <rect x="25" y="113" width="50" height="16" />
        </g>
        {POSITIONS.map((pos) => {
          const c = POS_COORD[pos];
          const level = pos === main ? 3 : aptitudes[pos] ?? 0;
          const cx = c.x;
          const cy = 128 - c.y * 1.24;
          return (
            <g key={pos} onClick={onTap ? () => onTap(pos) : undefined} style={{ cursor: onTap ? 'pointer' : undefined }}>
              <rect x={cx - 11} y={cy - 6.5} width="22" height="13" rx="4" fill={LEVEL_COLOR[level]} stroke={level ? '#0008' : '#ffffff22'} strokeWidth="0.5" />
              <text x={cx} y={cy - 0.3} textAnchor="middle" fontSize="5" fontWeight="800" fill={level ? '#fff' : '#ffffff77'}>
                {pos}
              </text>
              {player && (
                <text x={cx} y={cy + 4.8} textAnchor="middle" fontSize="4.2" fontWeight="700" fill={level ? '#fff' : '#ffffff66'}>
                  {ratingAt(player, pos)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="heatmap-legend">
        {[3, 2, 1].map((l) => (
          <span key={l}>
            <i style={{ background: LEVEL_COLOR[l] }} />
            {LEVEL_LABEL[l]}
          </span>
        ))}
      </div>
    </div>
  );
}
