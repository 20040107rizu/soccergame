import { earnBadge, addCounter } from './badges';
import { fmtMoney, marketValue, round2 } from './economy';
import { markAce } from './hidden2';
import { repairLineup, squadOf } from './lineup';
import { sendMail } from './mail';
import { pick, rand, uid } from './rng';
import { overall } from './stats';
import type { Result } from './transfer';
import type { GameState } from './types';

/* ======================= サウジアラビアからの超高額オファー ======================= */

export const SAUDI_CLUBS = ['アル・ヒラル', 'アル・ナスル', 'アル・イテハド', 'アル・アハリ', 'アル・カーディシーヤ', 'アル・シャバブ'];
/** 平均して何シーズンに1回届くか */
const EVERY_SEASONS = 10;
/** 最低額（1000億円） */
const MIN_FEE = 625;
const DAYS = 3;

export function saudiTick(state: GameState) {
  const o = state.saudiOffer;
  if (o) {
    if (state.day > o.expires || state.players[o.playerId]?.teamId !== state.userTeamId) {
      delete state.saudiOffer;
      if (state.players[o.playerId]?.teamId === state.userTeamId) refused(state);
    }
    return;
  }
  if (rand() >= 1 / (EVERY_SEASONS * (state.calendar.length || 60))) return;
  spawnSaudi(state);
}

export function spawnSaudi(state: GameState): boolean {
  const squad = squadOf(state, state.userTeamId);
  if (squad.length <= 16) return false;
  // チームで一番の選手か、28歳以上の主力
  const top = [...squad].sort((a, b) => overall(b) - overall(a));
  const cands = [top[0], ...top.slice(1, 8).filter((p) => p.age >= 28)].filter(Boolean);
  const p = pick(cands);
  const club = pick(SAUDI_CLUBS);
  const fee = round2(Math.max(MIN_FEE * (1 + rand() * 0.6), marketValue(p) * (3 + rand() * 2)));
  state.saudiOffer = { playerId: p.id, club, fee, expires: state.day + DAYS };
  sendMail(state, {
    from: 'club',
    sender: club,
    subject: `💰【超高額オファー】${club}が${p.name}に ${fmtMoney(fee)}`,
    body: `サウジアラビアの${club}です。\n\n貴クラブの${p.name}選手を、移籍金 ${fmtMoney(fee)} で獲得したいと考えています。\n（市場価値 ${fmtMoney(marketValue(p))}）\n\nこの金額は、二度と提示できないかもしれません。お返事は${DAYS}日以内にお願いします。\n※移籍期間に関係なく、合意すればすぐに移籍となります`,
    playerId: p.id,
    action: 'saudi',
    important: true,
  });
  return true;
}

function refused(state: GameState) {
  if (addCounter(state, 'saudiNo') >= 3) earnBadge(state, 'notForSale');
}

/** オファーに答える（受ける＝選手はすぐにサウジへ） */
export function answerSaudi(state: GameState, accept: boolean): Result {
  const o = state.saudiOffer;
  const p = o ? state.players[o.playerId] : undefined;
  if (!o || !p || p.teamId !== state.userTeamId) return { ok: false, message: 'この話はもう終わっています' };
  delete state.saudiOffer;
  if (!accept) {
    refused(state);
    return { ok: true, message: `${p.name}は売らないと伝えた。${o.club}は残念そうに引き下がった` };
  }
  state.money = round2(state.money + o.fee);
  markAce(state, p);
  state.offers = state.offers.filter((x) => x.playerId !== p.id);
  delete state.players[p.id];
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  team.lineup = team.lineup.filter((id) => id !== p.id);
  team.bench = team.bench.filter((id) => id !== p.id);
  repairLineup(state, team);
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【衝撃】${p.name}が${o.club}へ！移籍金 ${fmtMoney(o.fee)}` });
  addCounter(state, 'saudiYes');
  earnBadge(state, 'oilMoney');
  return { ok: true, message: `${p.name}は${o.club}へ旅立った（+${fmtMoney(o.fee)}）` };
}
