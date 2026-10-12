import { overall } from './stats';
import type { Player, Team } from './types';

/** 内部の金額は「百万ユーロ」単位。表示は円（1ユーロ=160円換算）に統一する */
export const YEN_PER_UNIT = 1.6e8;

export function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const oku = (Math.abs(v) * YEN_PER_UNIT) / 1e8;
  if (oku >= 100) return `${sign}￥${Math.round(oku).toLocaleString('ja-JP')}億`;
  if (oku >= 10) return `${sign}￥${oku.toFixed(1)}億`;
  if (oku >= 1) return `${sign}￥${oku.toFixed(2)}億`;
  return `${sign}￥${Math.round(oku * 10000).toLocaleString('ja-JP')}万`;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** 市場価値 */
/** 99 を超える総合値は、お金の計算では伸びを緩やかにする */
function moneyOvr(p: Player): number {
  const o = overall(p);
  return o <= 95 ? o : 95 + (o - 95) * 0.4;
}

export function marketValue(p: Player): number {
  const ovr = moneyOvr(p);
  let v = Math.exp((ovr - 62) * 0.17);
  const a = p.age;
  const ageMul = a <= 21 ? 1.6 : a <= 24 ? 1.35 : a <= 27 ? 1.1 : a <= 29 ? 0.85 : a <= 31 ? 0.6 : a <= 33 ? 0.35 : 0.2;
  v *= ageMul;
  v *= 1 + Math.max(0, p.potential - overall(p)) / 40;
  return round2(Math.max(0.1, v));
}

/** 適正年俸（年額） */
export function fairSalary(p: Player): number {
  const ovr = moneyOvr(p);
  const s = 0.4 * Math.exp((ovr - 62) * 0.11);
  return round2(Math.max(0.15, s));
}

/** クラブが払える年俸総額の上限 */
export function wageCap(team: Team): number {
  return round2(30 + team.rep * 1.7);
}

export function payroll(players: Player[]): number {
  return round2(players.reduce((s, p) => s + p.salary, 0));
}

/** 試合ごとの賞金 */
export const MATCH_PRIZE = {
  PL: { win: 2, draw: 0.7, loss: 0.2 },
  CL: { win: 2.1, draw: 0.7, loss: 0.3 },
};

/** CL のステージ到達ボーナス */
export const CL_STAGE_PRIZE = { start: 18, R16: 11, QF: 12.5, SF: 15, F: 18, win: 6 };

/** リーグ最終順位の分配金 */
export function leaguePrize(rank: number): number {
  return 10 + (21 - rank) * 2.5;
}
