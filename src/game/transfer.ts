import { fairSalary, marketValue, roundTo } from './rating';
import { fixUserLineup, squadOf, aiFillSquads, MIN_SQUAD_SIZE } from './season';
import { uid } from './rng';
import type { GameState, Player } from './types';

export const MIN_SQUAD = MIN_SQUAD_SIZE;
export const MAX_SQUAD = 30;

/** 獲得に必要な移籍金。フリーは契約金のみ、他クラブ所属は評価額に上乗せ */
export function transferFee(p: Player): number {
  if (!p.teamId) return roundTo(marketValue(p) * 0.25, 50);
  return roundTo(marketValue(p) * (1.15 + p.contractYears * 0.05), 50);
}

/** 放出時に受け取るポイント */
export function saleValue(p: Player): number {
  return roundTo(marketValue(p) * 0.7, 50);
}

/** 契約延長の費用（契約金） */
export function renewFee(p: Player): number {
  return roundTo(fairSalary(p) * 0.5, 10);
}

export type Check = { ok: true } | { ok: false; reason: string };

export function canBuy(state: GameState, p: Player): Check {
  if (p.teamId === state.userTeamId) return { ok: false, reason: '自分のクラブの選手です' };
  if (squadOf(state, state.userTeamId).length >= MAX_SQUAD) return { ok: false, reason: `登録は最大${MAX_SQUAD}人までです` };
  if (state.points < transferFee(p)) return { ok: false, reason: 'ポイントが足りません' };
  return { ok: true };
}

export function buyPlayer(state: GameState, playerId: string): Check {
  const p = state.players[playerId];
  const c = canBuy(state, p);
  if (!c.ok) return c;
  const fee = transferFee(p);
  const from = p.teamId ? state.teams.find((t) => t.id === p.teamId)?.name : null;
  state.points -= fee;
  p.teamId = state.userTeamId;
  p.contractYears = 3;
  p.salary = fairSalary(p);
  const used = new Set(squadOf(state, state.userTeamId).filter((x) => x.id !== p.id).map((x) => x.number));
  if (used.has(p.number)) {
    let n = 2;
    while (used.has(n)) n++;
    p.number = n;
  }
  state.news.unshift({
    id: uid('n'),
    season: state.season,
    round: state.round,
    text: `【獲得】${p.name}（${p.position}）${from ? `を${from}から` : 'をフリーで'}獲得。-${fee}P`,
  });
  // 引き抜かれたCPUクラブは補充
  aiFillSquads(state);
  state.updatedAt = Date.now();
  return { ok: true };
}

export function canSell(state: GameState, p: Player): Check {
  if (p.teamId !== state.userTeamId) return { ok: false, reason: '自分のクラブの選手ではありません' };
  if (squadOf(state, state.userTeamId).length <= MIN_SQUAD) return { ok: false, reason: `最低${MIN_SQUAD}人は必要です` };
  return { ok: true };
}

export function sellPlayer(state: GameState, playerId: string): Check {
  const p = state.players[playerId];
  const c = canSell(state, p);
  if (!c.ok) return c;
  const value = saleValue(p);
  state.points += value;
  p.teamId = null;
  p.contractYears = 0;
  state.news.unshift({
    id: uid('n'),
    season: state.season,
    round: state.round,
    text: `【放出】${p.name}を放出。+${value}P`,
  });
  fixUserLineup(state);
  state.updatedAt = Date.now();
  return { ok: true };
}

export function renewContract(state: GameState, playerId: string): Check {
  const p = state.players[playerId];
  if (p.teamId !== state.userTeamId) return { ok: false, reason: '自分のクラブの選手ではありません' };
  if (p.contractYears >= 5) return { ok: false, reason: '契約は最長5年です' };
  const fee = renewFee(p);
  if (state.points < fee) return { ok: false, reason: 'ポイントが足りません' };
  state.points -= fee;
  p.contractYears += 1;
  p.salary = fairSalary(p);
  state.updatedAt = Date.now();
  return { ok: true };
}
