import type { Player } from '../game/types';
import { overall } from '../game/stats';

/** 成長アルバム：15歳からの総合値の移り変わり */
export function GrowthAlbum({ p }: { p: Player }) {
  const hist = p.youth?.hist ?? [];
  if (!hist.length) return null;
  const now = overall(p);
  const pts: [number, number][] = [...hist];
  const last = pts[pts.length - 1];
  if (last[1] !== now) pts.push([last[0] + 0.5, now]);
  const W = 320;
  const H = 150;
  const pad = { l: 26, r: 10, t: 10, b: 20 };
  const x0 = 15;
  const x1 = Math.max(25, Math.ceil(pts[pts.length - 1][0]) + 1);
  const y0 = 40;
  const y1 = 100;
  const X = (a: number) => pad.l + ((a - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (Math.max(y0, v) - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let a = x0; a <= x1; a += x1 - x0 > 14 ? 5 : 2) ticks.push(a);
  const best = Math.max(...pts.map((x) => x[1]));
  return (
    <div className="album">
      <b>📸 成長アルバム</b>
      <svg viewBox={`0 0 ${W} ${H}`} className="album-chart" role="img" aria-label="年齢ごとの総合値">
        {[50, 60, 70, 80, 90].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} className={v === 90 ? 'album-90' : 'album-grid'} />
            <text x={pad.l - 4} y={Y(v) + 3} textAnchor="end" className="album-label">
              {v}
            </text>
          </g>
        ))}
        <line x1={X(25)} x2={X(25)} y1={pad.t} y2={H - pad.b} className="album-25" />
        {ticks.map((a) => (
          <text key={a} x={X(a)} y={H - 6} textAnchor="middle" className="album-label">
            {a}歳
          </text>
        ))}
        <polyline points={pts.map(([a, v]) => `${X(a)},${Y(v)}`).join(' ')} className="album-line" />
        {pts.map(([a, v], i) => (
          <circle key={i} cx={X(a)} cy={Y(v)} r={i === pts.length - 1 ? 4 : 2.6} className={v === best ? 'album-dot best' : 'album-dot'} />
        ))}
      </svg>
      <small className="muted">
        {hist[0][0]}歳で入団（総合値{hist[0][1]}）→ 今 {now}
      </small>
    </div>
  );
}
