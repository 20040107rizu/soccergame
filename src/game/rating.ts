import type { Formation, Player, Position, StatKey, Stats } from './types';

/** ポジションごとの能力の重み（総合値の計算に使う） */
const WEIGHTS: Record<Position, Partial<Record<StatKey, number>>> = {
  GK: { keeper: 6, physical: 1, defense: 1 },
  CB: { defense: 4, physical: 3, speed: 1, pass: 1 },
  SB: { defense: 3, speed: 3, stamina: 2, pass: 1, dribble: 1 },
  DMF: { defense: 3, pass: 3, stamina: 2, physical: 2 },
  CMF: { pass: 4, stamina: 2, offense: 1, defense: 1, dribble: 1 },
  OMF: { pass: 3, dribble: 3, offense: 2, shoot: 2 },
  WG: { speed: 3, dribble: 3, offense: 2, pass: 1, shoot: 1 },
  CF: { shoot: 4, offense: 3, physical: 1, speed: 1, dribble: 1 },
};

export function overallFor(stats: Stats, pos: Position): number {
  const w = WEIGHTS[pos];
  let sum = 0;
  let total = 0;
  for (const k in w) {
    const key = k as StatKey;
    sum += stats[key] * (w[key] ?? 0);
    total += w[key] ?? 0;
  }
  return Math.round(sum / total);
}

export function overall(p: Player): number {
  return overallFor(p.stats, p.position);
}

/** 移籍市場での評価額（ポイント） */
export function marketValue(p: Player): number {
  const ovr = overall(p);
  const base = Math.pow(Math.max(ovr - 45, 1), 2.2) * 6;
  let ageMul = 1;
  if (p.age <= 21) ageMul = 1.4;
  else if (p.age <= 24) ageMul = 1.25;
  else if (p.age <= 28) ageMul = 1;
  else if (p.age <= 31) ageMul = 0.7;
  else ageMul = 0.4;
  const potMul = 1 + Math.max(0, p.potential - ovr) / 60;
  return roundTo(base * ageMul * potMul, 50);
}

/** 年俸（1シーズン）。評価額の約6% */
export function fairSalary(p: Player): number {
  return Math.max(80, roundTo(marketValue(p) * 0.06, 10));
}

export function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/** フォーメーションの枠（GKから順に）と、ピッチ上の座標（x:0-100 左右, y:0-100 自陣→敵陣） */
export const FORMATIONS: Record<Formation, { pos: Position; x: number; y: number }[]> = {
  '4-4-2': [
    { pos: 'GK', x: 50, y: 6 },
    { pos: 'SB', x: 14, y: 26 },
    { pos: 'CB', x: 38, y: 22 },
    { pos: 'CB', x: 62, y: 22 },
    { pos: 'SB', x: 86, y: 26 },
    { pos: 'WG', x: 14, y: 55 },
    { pos: 'CMF', x: 38, y: 50 },
    { pos: 'CMF', x: 62, y: 50 },
    { pos: 'WG', x: 86, y: 55 },
    { pos: 'CF', x: 38, y: 80 },
    { pos: 'CF', x: 62, y: 80 },
  ],
  '4-3-3': [
    { pos: 'GK', x: 50, y: 6 },
    { pos: 'SB', x: 14, y: 26 },
    { pos: 'CB', x: 38, y: 22 },
    { pos: 'CB', x: 62, y: 22 },
    { pos: 'SB', x: 86, y: 26 },
    { pos: 'DMF', x: 50, y: 42 },
    { pos: 'CMF', x: 30, y: 55 },
    { pos: 'CMF', x: 70, y: 55 },
    { pos: 'WG', x: 16, y: 78 },
    { pos: 'CF', x: 50, y: 84 },
    { pos: 'WG', x: 84, y: 78 },
  ],
  '3-5-2': [
    { pos: 'GK', x: 50, y: 6 },
    { pos: 'CB', x: 28, y: 22 },
    { pos: 'CB', x: 50, y: 20 },
    { pos: 'CB', x: 72, y: 22 },
    { pos: 'SB', x: 10, y: 50 },
    { pos: 'DMF', x: 38, y: 42 },
    { pos: 'DMF', x: 62, y: 42 },
    { pos: 'SB', x: 90, y: 50 },
    { pos: 'OMF', x: 50, y: 62 },
    { pos: 'CF', x: 38, y: 82 },
    { pos: 'CF', x: 62, y: 82 },
  ],
  '4-2-3-1': [
    { pos: 'GK', x: 50, y: 6 },
    { pos: 'SB', x: 14, y: 26 },
    { pos: 'CB', x: 38, y: 22 },
    { pos: 'CB', x: 62, y: 22 },
    { pos: 'SB', x: 86, y: 26 },
    { pos: 'DMF', x: 38, y: 42 },
    { pos: 'DMF', x: 62, y: 42 },
    { pos: 'WG', x: 16, y: 66 },
    { pos: 'OMF', x: 50, y: 64 },
    { pos: 'WG', x: 84, y: 66 },
    { pos: 'CF', x: 50, y: 84 },
  ],
};

/** 本職でないポジションでの適性補正 */
const NEAR: Record<Position, Position[]> = {
  GK: [],
  CB: ['SB', 'DMF'],
  SB: ['CB', 'WG'],
  DMF: ['CMF', 'CB'],
  CMF: ['DMF', 'OMF'],
  OMF: ['CMF', 'WG', 'CF'],
  WG: ['OMF', 'SB', 'CF'],
  CF: ['OMF', 'WG'],
};

/** 選手が指定ポジションでプレーした時の実効能力 */
export function ratingAt(p: Player, pos: Position): number {
  const base = overallFor(p.stats, pos);
  if (p.position === pos) return base;
  if (pos === 'GK' || p.position === 'GK') return Math.round(base * 0.5);
  if (NEAR[p.position].includes(pos)) return Math.round(base * 0.95);
  return Math.round(base * 0.85);
}

/** 自動でベストな11人を選ぶ（貪欲法） */
export function autoLineup(players: Player[], formation: Formation): string[] {
  const slots = FORMATIONS[formation];
  const used = new Set<string>();
  const result: string[] = new Array(slots.length).fill('');
  // 枠ごとに候補の能力差が大きい順（GK優先）
  const order = slots.map((_, i) => i).sort((a, b) => (slots[a].pos === 'GK' ? -1 : slots[b].pos === 'GK' ? 1 : 0));
  for (const i of order) {
    let best: Player | null = null;
    let bestVal = -1;
    for (const p of players) {
      if (used.has(p.id)) continue;
      const v = ratingAt(p, slots[i].pos);
      if (v > bestVal) {
        bestVal = v;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      result[i] = best.id;
    }
  }
  return result;
}
