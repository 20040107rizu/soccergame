import { managerPerks, managerTitle } from './collection';
import { windowStatus } from './competitions';
import { aiFillSquads, teamById } from './season';
import { fairSalary, fmtMoney, marketValue, payroll, round2, wageCap } from './economy';
import { repairLineup, squadOf } from './lineup';
import { overall, seededRandom } from './stats';
import { uid } from './rng';
import type { GameState, NegotiationRecord, Player } from './types';

export const MIN_SQUAD = 18;
export const MAX_SQUAD = 32;
export const MAX_TRIES = 3;
/** 選手との契約交渉で提示できる回数 */
export const PLAYER_TRIES = 5;

export type Result = { ok: true; message?: string } | { ok: false; message: string };

function record(state: GameState, id: string): NegotiationRecord {
  if (!state.negotiations[id]) state.negotiations[id] = { closed: false, clubTries: 0, playerTries: 0 };
  return state.negotiations[id];
}

export function negotiationOf(state: GameState, id: string): NegotiationRecord {
  return state.negotiations[id] ?? { closed: false, clubTries: 0, playerTries: 0 };
}

/* ---------------- クラブとの交渉（移籍金） ---------------- */

/** クラブ内での重要度 0〜1（主力ほど高い） */
export function importance(state: GameState, p: Player): number {
  if (!p.teamId) return 0;
  const squad = squadOf(state, p.teamId).sort((a, b) => overall(b) - overall(a));
  const rank = squad.findIndex((x) => x.id === p.id);
  if (rank < 6) return 1;
  if (rank < 11) return 0.75;
  if (rank < 18) return 0.35;
  return 0.1;
}

export function askingPrice(state: GameState, p: Player): number {
  if (!p.teamId) return 0;
  const t = teamById(state, p.teamId);
  const imp = importance(state, p);
  const v = marketValue(p) * (1.05 + imp * 0.45 + p.contractYears * 0.04) * (t.rep >= 90 ? 1.12 : 1);
  return round2(v);
}

/** クラブが売却を拒否する「非売品」（シーズンごとに変わる） */
export function notForSale(state: GameState, p: Player): boolean {
  if (!p.teamId) return false;
  const t = teamById(state, p.teamId);
  const r = seededRandom(p.id + state.season)();
  return overall(p) >= 86 && t.rep >= 88 && importance(state, p) >= 1 && p.loyalty > 30 && r < 0.6;
}

export interface ClubReply {
  result: 'accept' | 'counter' | 'reject' | 'closed';
  counter?: number;
  message: string;
}

export function offerToClub(state: GameState, playerId: string, fee: number): ClubReply {
  const p = state.players[playerId];
  const rec = record(state, playerId);
  const club = teamById(state, p.teamId!);
  if (rec.closed) return { result: 'closed', message: `${club.name}は交渉を打ち切りました。次の移籍期間まで待ちましょう。` };
  if (notForSale(state, p)) {
    rec.closed = true;
    return { result: 'closed', message: `${club.name}「${p.name}は売り物ではない」` };
  }
  rec.clubTries++;
  const ask = askingPrice(state, p);
  const ratio = fee / ask;
  if (ratio >= 1) {
    rec.agreedFee = fee;
    return { result: 'accept', message: `${club.name}「${fmtMoney(fee)}で合意しよう」` };
  }
  if (rec.clubTries >= MAX_TRIES) {
    rec.closed = true;
    return { result: 'closed', message: `${club.name}「これ以上話すことはない」交渉は決裂しました。` };
  }
  if (ratio >= 0.82) {
    const counter = round2(ask * (1 - (1 - ratio) * 0.25));
    return { result: 'counter', counter, message: `${club.name}「${fmtMoney(counter)}なら考えてもいい」` };
  }
  // 2 回目以降は、おおよその希望額をほのめかす
  const hint = rec.clubTries >= 2 ? `最低でも${fmtMoney(Math.ceil(ask * 0.95))}は必要だ` : '';
  if (ratio >= 0.6) return { result: 'reject', message: `${club.name}「話にならない。${hint || '評価が低すぎる'}」` };
  return { result: 'reject', message: `${club.name}「冗談だろう？${hint ? ' ' + hint : ''}」` };
}

/* ---------------- 選手との交渉（契約） ---------------- */

export interface Interest {
  score: number;
  reasons: { label: string; value: string; good: boolean | null }[];
  refuse: boolean;
}

/** 選手の移籍意欲（クラブの格・CL・出場機会・愛着など） */
export function playerInterest(state: GameState, p: Player): Interest {
  const user = teamById(state, state.userTeamId);
  const cur = p.teamId ? teamById(state, p.teamId) : null;
  const reasons: Interest['reasons'] = [];
  let score = 50;

  const curRep = cur?.rep ?? 55;
  const repDiff = user.rep - curRep;
  score += repDiff * 1.1;
  reasons.push({ label: 'クラブの格', value: repDiff >= 5 ? 'ステップアップ' : repDiff <= -5 ? '格下への移籍' : '同程度', good: repDiff >= 5 ? true : repDiff <= -5 ? false : null });

  const userCl = state.clTeams.includes(user.id);
  const curCl = cur ? state.clTeams.includes(cur.id) : false;
  const clWeight = p.ambition / 100;
  if (userCl) score += 10 * clWeight;
  else if (curCl) score -= 12 * clWeight;
  reasons.push({ label: 'チャンピオンズリーグ', value: userCl ? '出場できる' : curCl ? '今は出場中' : 'どちらも出場なし', good: userCl ? true : curCl ? false : null });

  const same = squadOf(state, user.id).filter((x) => x.position === p.position).sort((a, b) => overall(b) - overall(a));
  const rank = same.filter((x) => overall(x) > overall(p)).length;
  const starterSlots = p.position === 'GK' ? 1 : p.position === 'CB' || p.position === 'CMF' || p.position === 'CF' ? 2 : 1;
  const playWeight = p.age <= 29 ? 1 : 0.5;
  if (rank < starterSlots) score += 12 * playWeight;
  else if (rank < starterSlots + 1) score -= 4 * playWeight;
  else score -= 15 * playWeight;
  reasons.push({ label: '出場機会', value: rank < starterSlots ? 'レギュラー候補' : rank < starterSlots + 1 ? '控え候補' : '出番が少なそう', good: rank < starterSlots ? true : rank < starterSlots + 1 ? null : false });

  if (cur) {
    const l = p.loyalty * 0.25;
    score -= l;
    reasons.push({ label: '現クラブへの愛着', value: p.loyalty >= 70 ? '強い' : p.loyalty >= 40 ? 'ふつう' : '弱い', good: p.loyalty >= 70 ? false : p.loyalty < 40 ? true : null });
  } else {
    score += 15;
    reasons.push({ label: '所属', value: 'フリー（新天地を探している）', good: true });
  }
  const perk = managerPerks(state).interest;
  if (perk) {
    score += perk;
    reasons.push({ label: '監督の評判', value: `${managerTitle(state)}の下でプレーしたい`, good: true });
  }
  if (p.age >= 31) {
    score += 5;
    reasons.push({ label: '年齢', value: 'キャリア終盤：条件を重視', good: null });
  }
  score = Math.round(Math.max(0, Math.min(100, score)));
  return { score, reasons, refuse: score < 15 };
}

export function salaryDemand(state: GameState, p: Player): number {
  const it = playerInterest(state, p);
  const base = Math.max(fairSalary(p), p.salary * (p.teamId ? 1.1 : 0.9));
  // 移籍に乗り気でない選手ほど高い年俸を求める（お金を積めば振り向いてくれる）
  const reluctant = it.score < 20 ? (20 - it.score) * 0.02 : 0;
  return round2(base * (1.15 - it.score / 300 + reluctant));
}

export interface PlayerReply {
  result: 'accept' | 'counter' | 'reject' | 'closed';
  counter?: number;
  message: string;
}

export function offerToPlayer(state: GameState, playerId: string, salary: number, years: number): PlayerReply {
  const p = state.players[playerId];
  const rec = record(state, playerId);
  if (rec.closed) return { result: 'closed', message: `${p.name}の代理人は交渉を打ち切りました。` };
  const { total, cap } = payrollInfo(state);
  if (total + salary > cap)
    return { result: 'reject', message: `年俸の空き枠が足りません（空き ${fmtMoney(Math.max(0, cap - total))}）。年俸を下げるか、選手を放出して枠を空けてください。` };
  rec.playerTries++;
  const demand = salaryDemand(state, p);
  const wantYears = p.age >= 30 ? 2 : 1;
  const yearsOk = years >= wantYears;
  const enough = salary >= demand * 0.97;
  if (enough && yearsOk) return { result: 'accept', message: `${p.name}「よろしくお願いします！」` };
  const close = salary >= demand * 0.75;
  // 回数を使い切っても、条件が近ければ最後にもう一度だけチャンスをくれる
  if (rec.playerTries > PLAYER_TRIES || (rec.playerTries >= PLAYER_TRIES && !close)) {
    rec.closed = true;
    return { result: 'closed', message: `${p.name}「残念だけど、今回は見送らせてもらう」` };
  }
  const last = rec.playerTries >= PLAYER_TRIES ? '（これが最後のチャンスだ）' : '';
  if (!yearsOk && enough) return { result: 'counter', counter: salary, message: `${p.name}「最低でも${wantYears}年の契約が欲しい」${last}` };
  if (close) return { result: 'counter', counter: demand, message: `${p.name}「年俸${fmtMoney(demand)}なら即決するよ」${last}` };
  if (salary >= demand * 0.6) return { result: 'reject', message: `${p.name}「悪くはないけど、もう少し上げてほしい」` };
  return { result: 'reject', message: `${p.name}「その条件では考えられない」` };
}

/** 年俸の空き枠でこの選手と契約できる見込みがあるか */
export function wageRoomFor(state: GameState, p: Player): { room: number; enough: boolean } {
  const { total, cap } = payrollInfo(state);
  const room = round2(Math.max(0, cap - total));
  return { room, enough: room >= salaryDemand(state, p) * 0.97 };
}

export function payrollInfo(state: GameState): { total: number; cap: number } {
  const t = teamById(state, state.userTeamId);
  return { total: payroll(squadOf(state, t.id)), cap: wageCap(t) };
}

/* ---------------- 成立 ---------------- */

export function canNegotiate(state: GameState, p: Player): Result {
  if (p.teamId === state.userTeamId) return { ok: false, message: '自分のクラブの選手です' };
  if (!windowStatus(state).open) return { ok: false, message: '移籍市場は閉まっています' };
  if (squadOf(state, state.userTeamId).length >= MAX_SQUAD) return { ok: false, message: `登録は最大${MAX_SQUAD}人までです` };
  if (p.injury > 0) return { ok: false, message: '負傷中の選手とは交渉できません' };
  return { ok: true };
}

export function completeSigning(state: GameState, playerId: string, salary: number, years: number): Result {
  const p = state.players[playerId];
  const rec = negotiationOf(state, playerId);
  const fee = p.teamId ? rec.agreedFee ?? Infinity : 0;
  if (fee > state.money) return { ok: false, message: '移籍資金が足りません' };
  const from = p.teamId ? teamById(state, p.teamId) : null;
  state.money = round2(state.money - fee);
  if (from) from.budget = round2(from.budget + fee);
  p.exTeamId = p.teamId ?? p.exTeamId;
  p.teamId = state.userTeamId;
  p.joinedSeason = state.season;
  p.contractYears = years;
  p.salary = round2(salary);
  const used = new Set(squadOf(state, state.userTeamId).filter((x) => x.id !== p.id).map((x) => x.number));
  if (used.has(p.number)) {
    let n = 2;
    while (used.has(n)) n++;
    p.number = n;
  }
  delete state.negotiations[playerId];
  state.offers = state.offers.filter((o) => o.playerId !== playerId);
  state.news.unshift({
    id: uid('n'),
    season: state.season,
    day: state.day,
    kind: 'transfer',
    text: `【獲得】${p.name}（${p.position}）${from ? `を${from.name}から ${fmtMoney(fee)} で` : 'をフリーで'}獲得。年俸 ${fmtMoney(salary)}・${years}年契約`,
  });
  if (from) {
    repairLineup(state, from);
    aiFillSquads(state);
  }
  repairLineup(state, teamById(state, state.userTeamId));
  return { ok: true };
}

/* ---------------- 放出 ---------------- */

export function acceptOffer(state: GameState, offerId: string): Result {
  const o = state.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, message: 'オファーが見つかりません' };
  const p = state.players[o.playerId];
  if (squadOf(state, state.userTeamId).length <= MIN_SQUAD) return { ok: false, message: `最低${MIN_SQUAD}人は必要です` };
  if (!windowStatus(state).open) return { ok: false, message: '移籍市場は閉まっています' };
  const buyer = teamById(state, o.fromTeam);
  state.money = round2(state.money + o.fee);
  buyer.budget = round2(buyer.budget - o.fee);
  p.exTeamId = state.userTeamId;
  p.teamId = buyer.id;
  p.joinedSeason = state.season;
  p.contractYears = Math.max(2, p.contractYears);
  delete p.mentorId;
  delete p.promise;
  delete p.listed;
  state.offers = state.offers.filter((x) => x.playerId !== p.id);
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【放出】${p.name}を${buyer.name}へ ${fmtMoney(o.fee)} で売却` });
  repairLineup(state, teamById(state, state.userTeamId));
  repairLineup(state, buyer);
  return { ok: true };
}

export interface OfferReply {
  result: 'accept' | 'counter' | 'reject' | 'walkaway';
  message: string;
}

/** 届いたオファーに対して、こちらから希望額を提示する */
export function negotiateOffer(state: GameState, offerId: string, ask: number): OfferReply {
  const o = state.offers.find((x) => x.id === offerId);
  if (!o) return { result: 'walkaway', message: 'オファーはすでに取り下げられています' };
  const buyer = teamById(state, o.fromTeam);
  const p = state.players[o.playerId];
  const max = o.maxFee ?? round2(o.fee * 1.2);
  o.tries = (o.tries ?? 0) + 1;
  ask = round2(ask);
  if (ask <= o.fee) {
    o.agreed = true;
    return { result: 'accept', message: `${buyer.name}「もちろん、その条件で問題ない」` };
  }
  if (ask <= max) {
    o.fee = ask;
    o.agreed = true;
    return { result: 'accept', message: `${buyer.name}「…いいだろう。${fmtMoney(ask)}で合意だ」` };
  }
  // 吹っかけすぎ・粘りすぎると交渉を打ち切られる
  const over = ask / max;
  if (o.tries >= MAX_TRIES || over > 1.6 || (over > 1.3 && Math.random() < 0.4)) {
    state.offers = state.offers.filter((x) => x.id !== o.id);
    return { result: 'walkaway', message: `${buyer.name}「その額は払えない。${p?.name ?? 'この選手'}の獲得は見送らせてもらう」交渉は決裂しました。` };
  }
  if (over <= 1.25) {
    const counter = round2(o.fee + (max - o.fee) * (0.55 + Math.random() * 0.35));
    o.fee = Math.max(o.fee, counter);
    return { result: 'counter', message: `${buyer.name}「さすがにそこまでは出せない。${fmtMoney(o.fee)}まで上げよう」` };
  }
  return { result: 'reject', message: `${buyer.name}「高すぎる。考え直してほしい」（残り${MAX_TRIES - o.tries}回）` };
}

/** オファーに対する選手本人の気持ち */
export function offerFeeling(state: GameState, offerId: string): string {
  const o = state.offers.find((x) => x.id === offerId);
  if (!o) return '';
  const p = state.players[o.playerId];
  const buyer = teamById(state, o.fromTeam);
  const user = teamById(state, state.userTeamId);
  const diff = buyer.rep - user.rep + (p.ambition - 50) * 0.2 - (p.loyalty - 50) * 0.3;
  if (diff > 8) return `${p.name}は${buyer.name}への移籍に乗り気のようです`;
  if (diff > -4) return `${p.name}はどちらでも構わないと考えているようです`;
  return `${p.name}はクラブに残りたいと思っているようです`;
}

export function rejectOffer(state: GameState, offerId: string) {
  state.offers = state.offers.filter((x) => x.id !== offerId);
}

/** 選手を売りに出して、買い手を探す */
export function seekBuyer(state: GameState, playerId: string): Result {
  const p = state.players[playerId];
  if (!windowStatus(state).open) return { ok: false, message: '移籍市場は閉まっています' };
  if (state.offers.some((o) => o.playerId === playerId)) return { ok: false, message: 'すでにオファーが届いています' };
  const v = marketValue(p);
  const buyers = state.teams.filter((t) => t.id !== state.userTeamId && t.budget >= v * 0.7 && Math.abs(t.rep - 30 - overall(p) * 0.6) < 25);
  if (!buyers.length) return { ok: false, message: '興味を示すクラブは見つかりませんでした' };
  const b = buyers[Math.floor(Math.random() * buyers.length)];
  const fee = round2(v * (0.7 + Math.random() * 0.3));
  state.offers.push({ id: uid('o'), playerId, fromTeam: b.id, fee, day: state.day, maxFee: round2(fee * (1.05 + Math.random() * 0.3)), tries: 0 });
  return { ok: true, message: `${b.name}から ${fmtMoney(fee)} のオファーが届きました` };
}

/** 契約解除（残り契約の半額を支払う） */
export function releaseCost(p: Player): number {
  return round2(p.salary * p.contractYears * 0.5);
}

export function releasePlayer(state: GameState, playerId: string): Result {
  const p = state.players[playerId];
  if (squadOf(state, state.userTeamId).length <= MIN_SQUAD) return { ok: false, message: `最低${MIN_SQUAD}人は必要です` };
  const cost = releaseCost(p);
  if (cost > state.money) return { ok: false, message: '違約金を払う資金が足りません' };
  state.money = round2(state.money - cost);
  p.exTeamId = state.userTeamId;
  p.teamId = null;
  delete p.promise;
  delete p.listed;
  p.contractYears = 0;
  state.offers = state.offers.filter((x) => x.playerId !== p.id);
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【契約解除】${p.name}との契約を解除（違約金 ${fmtMoney(cost)}）` });
  repairLineup(state, teamById(state, state.userTeamId));
  return { ok: true };
}

/* ---------------- 契約延長 ---------------- */

export function renewDemand(p: Player): number {
  return round2(Math.max(p.salary, fairSalary(p)) * (1.05 + p.ambition / 500));
}

export function renewContract(state: GameState, playerId: string, salary: number, years: number): Result {
  const p = state.players[playerId];
  if (p.teamId !== state.userTeamId) return { ok: false, message: '自分のクラブの選手ではありません' };
  const { total, cap } = payrollInfo(state);
  if (total - p.salary + salary > cap) return { ok: false, message: `年俸総額の上限（${fmtMoney(cap)}）を超えてしまいます` };
  const demand = renewDemand(p);
  if (salary < demand) return { ok: false, message: `${p.name}「年俸${fmtMoney(demand)}は欲しい」` };
  p.salary = round2(salary);
  p.contractYears = years;
  return { ok: true, message: `${p.name}と${years}年契約を結びました` };
}
