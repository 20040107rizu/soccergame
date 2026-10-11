import type { Formation, Position } from './types';

/** ポジションの大分類（色分け用） */
export function posGroup(p: Position): 'gk' | 'df' | 'mf' | 'fw' {
  if (p === 'GK') return 'gk';
  if (p === 'CB' || p === 'LSB' || p === 'RSB') return 'df';
  if (p === 'DMF' || p === 'CMF' || p === 'LMF' || p === 'RMF' || p === 'OMF') return 'mf';
  return 'fw';
}

/** 各ポジションの代表位置（x:左→右, y:自陣→敵陣, 0-100） */
export const POS_COORD: Record<Position, { x: number; y: number }> = {
  GK: { x: 50, y: 5 },
  CB: { x: 50, y: 20 },
  LSB: { x: 11, y: 24 },
  RSB: { x: 89, y: 24 },
  DMF: { x: 50, y: 38 },
  CMF: { x: 50, y: 52 },
  LMF: { x: 11, y: 55 },
  RMF: { x: 89, y: 55 },
  OMF: { x: 50, y: 67 },
  LWG: { x: 13, y: 79 },
  RWG: { x: 87, y: 79 },
  ST: { x: 50, y: 78 },
  CF: { x: 50, y: 91 },
};

/** ピッチ上の位置からポジションを決める（自由配置用） */
export function posFromXY(x: number, y: number): Position {
  if (y < 12) return 'GK';
  if (y < 33) return x < 22 ? 'LSB' : x > 78 ? 'RSB' : 'CB';
  if (y < 45) return x < 22 ? 'LSB' : x > 78 ? 'RSB' : 'DMF';
  if (y < 61) return x < 25 ? 'LMF' : x > 75 ? 'RMF' : 'CMF';
  if (y < 72) return x < 25 ? 'LMF' : x > 75 ? 'RMF' : 'OMF';
  if (y < 85) return x < 28 ? 'LWG' : x > 72 ? 'RWG' : 'ST';
  return x < 28 ? 'LWG' : x > 72 ? 'RWG' : 'CF';
}

/** ポジションの範囲（ピッチ上にヒートマップを重ねる用） */
export const POS_ZONE: Record<Position, { x: number; y: number; w: number; h: number }> = {
  GK: { x: 25, y: 0, w: 50, h: 12 },
  LSB: { x: 0, y: 12, w: 22, h: 33 },
  CB: { x: 22, y: 12, w: 56, h: 21 },
  RSB: { x: 78, y: 12, w: 22, h: 33 },
  DMF: { x: 22, y: 33, w: 56, h: 12 },
  LMF: { x: 0, y: 45, w: 25, h: 27 },
  CMF: { x: 25, y: 45, w: 50, h: 16 },
  RMF: { x: 75, y: 45, w: 25, h: 27 },
  OMF: { x: 25, y: 61, w: 50, h: 11 },
  LWG: { x: 0, y: 72, w: 28, h: 28 },
  ST: { x: 28, y: 72, w: 44, h: 13 },
  RWG: { x: 72, y: 72, w: 28, h: 28 },
  CF: { x: 28, y: 85, w: 44, h: 15 },
};

type XY = { x: number; y: number };

export const FORMATIONS: Record<Formation, XY[]> = {
  '4-3-3': [
    { x: 50, y: 5 }, { x: 12, y: 25 }, { x: 37, y: 20 }, { x: 63, y: 20 }, { x: 88, y: 25 },
    { x: 50, y: 39 }, { x: 30, y: 54 }, { x: 70, y: 54 }, { x: 14, y: 78 }, { x: 50, y: 88 }, { x: 86, y: 78 },
  ],
  '4-2-3-1': [
    { x: 50, y: 5 }, { x: 12, y: 25 }, { x: 37, y: 20 }, { x: 63, y: 20 }, { x: 88, y: 25 },
    { x: 36, y: 40 }, { x: 64, y: 40 }, { x: 14, y: 64 }, { x: 50, y: 66 }, { x: 86, y: 64 }, { x: 50, y: 88 },
  ],
  '4-4-2': [
    { x: 50, y: 5 }, { x: 12, y: 25 }, { x: 37, y: 20 }, { x: 63, y: 20 }, { x: 88, y: 25 },
    { x: 12, y: 55 }, { x: 37, y: 50 }, { x: 63, y: 50 }, { x: 88, y: 55 }, { x: 37, y: 88 }, { x: 63, y: 88 },
  ],
  '4-1-2-3': [
    { x: 50, y: 5 }, { x: 12, y: 25 }, { x: 37, y: 20 }, { x: 63, y: 20 }, { x: 88, y: 25 },
    { x: 50, y: 38 }, { x: 33, y: 64 }, { x: 67, y: 64 }, { x: 14, y: 78 }, { x: 50, y: 88 }, { x: 86, y: 78 },
  ],
  '3-5-2': [
    { x: 50, y: 5 }, { x: 28, y: 20 }, { x: 50, y: 18 }, { x: 72, y: 20 },
    { x: 10, y: 52 }, { x: 36, y: 40 }, { x: 64, y: 40 }, { x: 90, y: 52 }, { x: 50, y: 64 }, { x: 37, y: 88 }, { x: 63, y: 88 },
  ],
  '3-4-3': [
    { x: 50, y: 5 }, { x: 28, y: 20 }, { x: 50, y: 18 }, { x: 72, y: 20 },
    { x: 10, y: 52 }, { x: 37, y: 48 }, { x: 63, y: 48 }, { x: 90, y: 52 }, { x: 14, y: 78 }, { x: 50, y: 88 }, { x: 86, y: 78 },
  ],
};

export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

export function rolesOf(slots: XY[]): Position[] {
  return slots.map((s) => posFromXY(s.x, s.y));
}

/** 近いポジション（適性が無い時の目安・自動サブポジ生成に使う） */
export const NEIGHBORS: Record<Position, Position[]> = {
  GK: [],
  CB: ['DMF', 'LSB', 'RSB'],
  LSB: ['LMF', 'CB', 'RSB'],
  RSB: ['RMF', 'CB', 'LSB'],
  DMF: ['CMF', 'CB'],
  CMF: ['DMF', 'OMF', 'LMF', 'RMF'],
  LMF: ['LWG', 'LSB', 'CMF', 'RMF'],
  RMF: ['RWG', 'RSB', 'CMF', 'LMF'],
  OMF: ['CMF', 'ST', 'LMF', 'RMF'],
  LWG: ['LMF', 'RWG', 'ST'],
  RWG: ['RMF', 'LWG', 'ST'],
  ST: ['CF', 'OMF', 'LWG', 'RWG'],
  CF: ['ST', 'LWG', 'RWG'],
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
