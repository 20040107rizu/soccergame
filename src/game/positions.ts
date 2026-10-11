import type { Formation, Position } from './types';

/** ポジションの大分類（色分け用） */
export function posGroup(p: Position): 'gk' | 'df' | 'mf' | 'fw' {
  if (p === 'GK') return 'gk';
  if (p === 'CB' || p === 'LB' || p === 'RB') return 'df';
  if (p === 'DMF' || p === 'CMF' || p === 'LMF' || p === 'RMF' || p === 'AMF') return 'mf';
  return 'fw';
}

/** ヒートマップ上の各ポジションの位置（x:左→右, y:自陣→敵陣, 0-100） */
export const POS_COORD: Record<Position, { x: number; y: number }> = {
  GK: { x: 50, y: 6 },
  CB: { x: 50, y: 20 },
  LB: { x: 13, y: 26 },
  RB: { x: 87, y: 26 },
  DMF: { x: 50, y: 37 },
  CMF: { x: 50, y: 52 },
  LMF: { x: 13, y: 54 },
  RMF: { x: 87, y: 54 },
  AMF: { x: 50, y: 67 },
  LWF: { x: 15, y: 78 },
  RWF: { x: 85, y: 78 },
  SS: { x: 50, y: 80 },
  CF: { x: 50, y: 91 },
};

type Slot = { pos: Position; x: number; y: number };

export const FORMATIONS: Record<Formation, Slot[]> = {
  '4-3-3': [
    { pos: 'GK', x: 50, y: 5 },
    { pos: 'LB', x: 12, y: 25 },
    { pos: 'CB', x: 37, y: 20 },
    { pos: 'CB', x: 63, y: 20 },
    { pos: 'RB', x: 88, y: 25 },
    { pos: 'DMF', x: 50, y: 39 },
    { pos: 'CMF', x: 28, y: 54 },
    { pos: 'CMF', x: 72, y: 54 },
    { pos: 'LWF', x: 14, y: 76 },
    { pos: 'CF', x: 50, y: 84 },
    { pos: 'RWF', x: 86, y: 76 },
  ],
  '4-2-3-1': [
    { pos: 'GK', x: 50, y: 5 },
    { pos: 'LB', x: 12, y: 25 },
    { pos: 'CB', x: 37, y: 20 },
    { pos: 'CB', x: 63, y: 20 },
    { pos: 'RB', x: 88, y: 25 },
    { pos: 'DMF', x: 35, y: 41 },
    { pos: 'DMF', x: 65, y: 41 },
    { pos: 'LMF', x: 14, y: 64 },
    { pos: 'AMF', x: 50, y: 64 },
    { pos: 'RMF', x: 86, y: 64 },
    { pos: 'CF', x: 50, y: 85 },
  ],
  '4-4-2': [
    { pos: 'GK', x: 50, y: 5 },
    { pos: 'LB', x: 12, y: 25 },
    { pos: 'CB', x: 37, y: 20 },
    { pos: 'CB', x: 63, y: 20 },
    { pos: 'RB', x: 88, y: 25 },
    { pos: 'LMF', x: 12, y: 54 },
    { pos: 'CMF', x: 37, y: 48 },
    { pos: 'CMF', x: 63, y: 48 },
    { pos: 'RMF', x: 88, y: 54 },
    { pos: 'CF', x: 37, y: 82 },
    { pos: 'CF', x: 63, y: 82 },
  ],
  '4-1-2-3': [
    { pos: 'GK', x: 50, y: 5 },
    { pos: 'LB', x: 12, y: 25 },
    { pos: 'CB', x: 37, y: 20 },
    { pos: 'CB', x: 63, y: 20 },
    { pos: 'RB', x: 88, y: 25 },
    { pos: 'DMF', x: 50, y: 37 },
    { pos: 'AMF', x: 32, y: 60 },
    { pos: 'AMF', x: 68, y: 60 },
    { pos: 'LWF', x: 14, y: 78 },
    { pos: 'CF', x: 50, y: 85 },
    { pos: 'RWF', x: 86, y: 78 },
  ],
  '3-5-2': [
    { pos: 'GK', x: 50, y: 5 },
    { pos: 'CB', x: 26, y: 21 },
    { pos: 'CB', x: 50, y: 18 },
    { pos: 'CB', x: 74, y: 21 },
    { pos: 'LMF', x: 10, y: 50 },
    { pos: 'DMF', x: 37, y: 40 },
    { pos: 'DMF', x: 63, y: 40 },
    { pos: 'RMF', x: 90, y: 50 },
    { pos: 'AMF', x: 50, y: 63 },
    { pos: 'CF', x: 37, y: 84 },
    { pos: 'CF', x: 63, y: 84 },
  ],
  '3-4-3': [
    { pos: 'GK', x: 50, y: 5 },
    { pos: 'CB', x: 26, y: 21 },
    { pos: 'CB', x: 50, y: 18 },
    { pos: 'CB', x: 74, y: 21 },
    { pos: 'LMF', x: 10, y: 50 },
    { pos: 'CMF', x: 37, y: 45 },
    { pos: 'CMF', x: 63, y: 45 },
    { pos: 'RMF', x: 90, y: 50 },
    { pos: 'LWF', x: 18, y: 77 },
    { pos: 'CF', x: 50, y: 85 },
    { pos: 'RWF', x: 82, y: 77 },
  ],
};

export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

/** 近いポジション（適性が無い時の目安・自動サブポジ生成に使う） */
export const NEIGHBORS: Record<Position, Position[]> = {
  GK: [],
  CB: ['DMF', 'LB', 'RB'],
  LB: ['LMF', 'CB', 'RB'],
  RB: ['RMF', 'CB', 'LB'],
  DMF: ['CMF', 'CB'],
  CMF: ['DMF', 'AMF', 'LMF', 'RMF'],
  LMF: ['LWF', 'LB', 'CMF', 'RMF'],
  RMF: ['RWF', 'RB', 'CMF', 'LMF'],
  AMF: ['CMF', 'SS', 'LMF', 'RMF'],
  LWF: ['LMF', 'RWF', 'SS'],
  RWF: ['RMF', 'LWF', 'SS'],
  SS: ['CF', 'AMF', 'LWF', 'RWF'],
  CF: ['SS', 'LWF', 'RWF'],
};

/** ポジション適性による能力の補正 */
export function aptitudeMultiplier(level: number | undefined, pos: Position, main: Position): number {
  if (pos === 'GK' || main === 'GK') return pos === main ? 1 : 0.35;
  switch (level) {
    case 3:
      return 1;
    case 2:
      return 0.97;
    case 1:
      return 0.92;
    default:
      return NEIGHBORS[main].includes(pos) ? 0.88 : 0.8;
  }
}
