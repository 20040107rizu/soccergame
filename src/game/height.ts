import { HEIGHTS } from '../data/heights';
import { seededRandom } from './stats';
import type { Player, Position } from './types';

/** ポジションごとの身長の目安（平均・ばらつき） */
const HEIGHT_BY_POS: Record<Position, [number, number]> = {
  GK: [190, 4],
  CB: [187, 4],
  LSB: [178, 5],
  RSB: [178, 5],
  DMF: [181, 5],
  CMF: [178, 5],
  OMF: [176, 5],
  LMF: [176, 5],
  RMF: [176, 5],
  LWG: [175, 5],
  RWG: [175, 5],
  ST: [178, 5],
  CF: [184, 6],
};

/** 実在選手の身長を英語名から探す（所属クラブが分かればそのクラブを優先） */
export function realHeight(nameEn: string, clubId?: string): number | undefined {
  if (!nameEn) return undefined;
  if (clubId && HEIGHTS[clubId]?.[nameEn]) return HEIGHTS[clubId][nameEn];
  for (const club of Object.values(HEIGHTS)) if (club[nameEn]) return club[nameEn];
  return undefined;
}

/** 架空選手の身長（ポジションに合わせてランダム。乱数を渡せば決定的） */
export function randomHeight(pos: Position, r: () => number = Math.random): number {
  const [mean, sd] = HEIGHT_BY_POS[pos];
  // 3つの一様乱数の和で近似した正規分布
  const g = (r() + r() + r() - 1.5) * 2;
  return Math.round(Math.max(160, Math.min(205, mean + g * sd)));
}

/** 身長が未設定の選手（古いセーブなど）に設定する */
export function ensureHeight(p: Player): number {
  if (!p.height) p.height = realHeight(p.nameEn) ?? randomHeight(p.position, seededRandom(p.id + ':height'));
  return p.height;
}

/** 空中戦での補正（180cm を基準に、高いほど有利） */
export function aerialFactor(p: Player): number {
  return 1 + ((p.height ?? 180) - 180) * 0.02;
}
