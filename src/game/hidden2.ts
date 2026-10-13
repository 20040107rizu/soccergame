import { addCounter, earnBadge, markSpent } from './badges';
import { fairSalary, fmtMoney, marketValue, round2 } from './economy';
import { unlock } from './events';
import type { TeamSnapshot } from './friendly';
import { generatePlayer } from './data';
import { repairLineup, squadOf } from './lineup';
import { sendMail } from './mail';
import { FORMATIONS, NEIGHBORS } from './positions';
import { clamp, pick, rand, randInt, uid } from './rng';
import { teamById } from './season';
import { overall, SKILLS, STAT_KEYS } from './stats';
import { MAX_SQUAD, type Result } from './transfer';
import { POSITIONS, type Formation, type GameState, type Player, type Position, type StatKey, type Tactic } from './types';
import { windowStatus } from './competitions';

/* ======================= 1. 伝説の監督からの挑戦状 ======================= */

interface CoachDef {
  id: string;
  name: string;
  team: string;
  formation: Formation;
  tactic: Tactic;
  color: string;
  color2: string;
}

const COACHES: CoachDef[] = [
  { id: 'iron', name: '鉄壁の老将', team: '老将の鉄壁軍団', formation: '4-4-2', tactic: 'defense', color: '#3b4a5c', color2: '#c9d3df' },
  { id: 'magic', name: '攻撃の魔術師', team: '魔術師の攻撃団', formation: '4-3-3', tactic: 'attack', color: '#6a1b9a', color2: '#ffd34d' },
  { id: 'counter', name: 'カウンターの鬼才', team: '鬼才の速攻部隊', formation: '4-2-3-1', tactic: 'balance', color: '#b71c1c', color2: '#111111' },
  { id: 'possession', name: 'ポゼッションの哲学者', team: '哲学者のパス集団', formation: '4-1-2-3', tactic: 'balance', color: '#0d47a1', color2: '#ffffff' },
  { id: 'fighter', name: '不屈の闘将', team: '闘将の不屈軍団', formation: '3-5-2', tactic: 'attack', color: '#e65100', color2: '#000000' },
];
const COACH_RATE = 0.02;
const COACH_LEVEL = 90;

export function coachDef(id: string): CoachDef | undefined {
  return COACHES.find((c) => c.id === id);
}

/** 名将のチーム（挑戦状が届いた時に一度だけ作る） */
function buildCoachTeam(c: CoachDef): TeamSnapshot {
  const slots = FORMATIONS[c.formation].map((x) => ({ ...x }));
  const roles: Position[] = slots.map((s) => (s.y < 12 ? 'GK' : s.y < 33 ? (s.x < 22 ? 'LSB' : s.x > 78 ? 'RSB' : 'CB') : s.y < 45 ? 'DMF' : s.y < 72 ? (s.x < 25 ? 'LMF' : s.x > 75 ? 'RMF' : 'CMF') : s.x < 28 ? 'LWG' : s.x > 72 ? 'RWG' : 'CF'));
  const bench: Position[] = ['GK', 'CB', 'LSB', 'CMF', 'OMF', 'RWG', 'CF'];
  const players = [...roles, ...bench].map((pos, i) => {
    const p = generatePlayer({ position: pos, level: COACH_LEVEL + (i < 11 ? randInt(-1, 2) : randInt(-4, 0)), age: randInt(24, 31), teamId: null });
    return { n: p.name, p: p.position, no: i + 1, st: STAT_KEYS.map((k) => p.stats[k]), sk: p.skills, sy: p.style, ap: p.aptitudes, h: p.height, ft: p.foot, ag: p.age, app: p.appearance };
  });
  return { v: 1, name: c.team, short: c.team.slice(0, 3), color: c.color, color2: c.color2, formation: c.formation, tactic: c.tactic, spirit: 92, slots, players };
}

export function coachChallengeTick(state: GameState, day: { type: string; round: number }) {
  state.flags = state.flags ?? {};
  const c = state.coachChallenge;
  if (c && state.day >= c.expires) {
    if (c.status === 'invited') sendMail(state, { from: 'league', sender: coachDef(c.coach)?.name ?? '名将', subject: '挑戦状の期限が過ぎました', body: '名将は静かに去っていきました。' });
    delete state.coachChallenge;
    return;
  }
  const key = `cc-${state.season}`;
  if (state.flags[key] || c || state.legendChallenge || state.sodeChallenge || day.type !== 'PL' || day.round < 6 || day.round > 34) return;
  if (rand() >= COACH_RATE) return;
  state.flags[key] = true;
  spawnCoachChallenge(state);
}

export function spawnCoachChallenge(state: GameState, id?: string) {
  const c = (id && coachDef(id)) || pick(COACHES);
  state.coachChallenge = { status: 'invited', coach: c.id, expires: state.day + 5, snap: JSON.stringify(buildCoachTeam(c)) };
  sendMail(state, {
    from: 'league',
    sender: c.name,
    subject: `🎩【挑戦状】「${c.name}」が練習試合を申し込んできた`,
    body: `かつて数々のタイトルを手にした名将「${c.name}」から、練習試合の申し込みが届きました。\n\n「君のチームの戦い方を見せてもらおう。私に勝てたなら、選手の可能性をひとつ広げてあげよう」\n\n（回答期限 5日）\n※この試合はセーブの成績には影響しません`,
    action: 'coachMatch',
    important: true,
  });
}

export function finishCoachChallenge(state: GameState, gf: number, ga: number) {
  const c = state.coachChallenge;
  if (!c || c.status !== 'invited') return;
  const def = coachDef(c.coach);
  if (gf > ga) {
    state.coachChallenge = { ...c, status: 'won', expires: state.day + 10 };
    sendMail(state, {
      from: 'league',
      sender: def?.name ?? '名将',
      subject: `🎩 名将に勝利！選手の可能性を広げよう`,
      body: `${gf}-${ga}。「見事だ。約束どおり、選手の可能性をひとつ広げてあげよう」\n\n自分のチームの選手を1人選び、新しく適性を持たせるポジションを1つ選んでください。（回答期限 10日）`,
      action: 'coachPick',
      important: true,
    });
    unlock(state, 'coachSlayer');
  } else {
    delete state.coachChallenge;
    sendMail(state, { from: 'league', sender: def?.name ?? '名将', subject: `名将に敗れた（${gf}-${ga}）`, body: '「まだまだだな。また会おう」\n\n名将は去っていきました。' });
  }
}

export function declineCoachChallenge(state: GameState) {
  delete state.coachChallenge;
}

/** 報酬：選手に新しい適性ポジションを1つ（GK とフィールドの入れ替えはできない） */
export function coachRewardOptions(p: Player): Position[] {
  return POSITIONS.filter((pos) => (pos === 'GK') === (p.position === 'GK') && (p.aptitudes[pos] ?? 0) < 3 && pos !== p.position);
}

export function applyCoachReward(state: GameState, playerId: string, pos: Position): Result {
  const c = state.coachChallenge;
  if (!c || c.status !== 'won') return { ok: false, message: 'この話はもう終わっています' };
  const p = state.players[playerId];
  if (!p || p.teamId !== state.userTeamId) return { ok: false, message: '自分のクラブの選手を選んでください' };
  if (!coachRewardOptions(p).includes(pos)) return { ok: false, message: 'そのポジションは選べません' };
  p.aptitudes = { ...p.aptitudes, [pos]: 3 };
  delete state.coachChallenge;
  sendMail(state, { from: 'coach', sender: coachDef(c.coach)?.name ?? '名将', subject: `🎩 ${p.name}が${pos}の適性を手に入れた`, body: `名将の指導を受け、${p.name}は${pos}でもプレーできるようになりました。`, playerId: p.id });
  return { ok: true, message: `${p.name}が${pos}の適性を手に入れました` };
}

/* ======================= 2. 背番号の継承 ======================= */

/** クラブを去る（引退・移籍・契約満了）エースの背番号を記録する */
export function markAce(state: GameState, p: Player) {
  if (p.teamId !== state.userTeamId) return;
  const apps = p.clubApps ?? 0;
  const peak = Math.max(p.peakOvr ?? 0, overall(p));
  const seasons = state.season - (p.joinedSeason ?? state.season);
  if (peak < 85 || apps < 60 || seasons < 3) return;
  const keys = STAT_KEYS.filter((k) => !k.startsWith('gk') || p.position === 'GK')
    .sort((a, b) => p.stats[b] - p.stats[a])
    .slice(0, 3);
  state.aceNumbers = { ...(state.aceNumbers ?? {}), [p.number]: { name: p.name, keys, skills: p.skills.slice(0, 6), season: state.season } };
}

/** シーズン終了時：エースナンバーを背負う若手が、まれにその魂を受け継ぐ */
export function inheritAceTick(state: GameState) {
  const aces = state.aceNumbers ?? {};
  for (const p of squadOf(state, state.userTeamId)) {
    const a = aces[p.number];
    if (!a || p.age > 22 || p.name === a.name || p.aceOf === p.number || rand() >= 0.08) continue;
    p.aceOf = p.number;
    for (const k of a.keys as StatKey[]) p.stats[k] = clamp(p.stats[k] + randInt(3, 5), 35, 99);
    const known = new Set(SKILLS.map((s) => s.id));
    const gift = a.skills.filter((s) => known.has(s) && !p.skills.includes(s));
    const skill = gift.length && rand() < 0.6 ? pick(gift) : null;
    if (skill) p.skills = [...p.skills, skill];
    sendMail(state, {
      from: 'coach',
      sender: 'ヘッドコーチ',
      subject: `【継承】${p.name}が背番号${p.number}の魂を受け継いだ`,
      body: `かつて背番号${p.number}を背負った${a.name}。その魂が、${p.name}に受け継がれたようです。\n\nプレーのあちこちに、あの頃の${a.name}の面影が見えます。${skill ? `\n\n（特殊スキル「${SKILLS.find((s) => s.id === skill)?.label}」を覚えました）` : ''}`,
      playerId: p.id,
      important: true,
    });
    unlock(state, 'aceHeir');
  }
}

/* ======================= 3. 奇跡の試合（ゾーン） ======================= */

/** 試合後：2点差以上をひっくり返して勝つと、まれにゾーンに入る */
export function checkMiracle(state: GameState, goals: { side?: string; minute: number }[], key: 'home' | 'away', oppName: string, gf: number, ga: number) {
  if (gf <= ga) return;
  let diff = 0;
  let worst = 0;
  for (const g of [...goals].sort((a, b) => a.minute - b.minute)) {
    diff += g.side === key ? 1 : -1;
    worst = Math.min(worst, diff);
  }
  if (worst > -2) return;
  state.miracles = [...(state.miracles ?? []), { season: state.season, opp: oppName, score: `${gf}-${ga}`, from: -worst }].slice(-30);
  unlock(state, 'miracle');
  if (rand() >= 0.3) return;
  state.zone = 3;
  earnBadge(state, 'zone');
  const team = teamById(state, state.userTeamId);
  team.spirit = 99;
  sendMail(state, {
    from: 'coach',
    sender: 'ヘッドコーチ',
    subject: '✨ チームが「ゾーン」に入った！',
    body: `${-worst}点差からの大逆転。選手たちの目つきが変わりました。\n\n今のチームは、何をやってもうまくいく気がする――そんな特別な状態です。この勢いは、しばらく続きそうです。`,
    important: true,
  });
}

/** ゾーン中は全員が少しだけ強い */
export function zoneBonus(state: GameState, teamId: string): number {
  return teamId === state.userTeamId && (state.zone ?? 0) > 0 ? 1.04 : 1;
}

export function zoneAfterMatch(state: GameState) {
  if ((state.zone ?? 0) > 0) state.zone = state.zone! - 1;
}

/* ======================= 4. 謎の代理人 ======================= */

const MYSTERY_RATE = 0.06;
const HINTS = {
  jackpot: ['目の奥に、底知れないものを感じます。', '本人は「いつか世界一になる」と本気で言っていました。'],
  normal: ['可もなく不可もなく、といったところでしょうか。', '真面目な選手です。それ以上でも以下でもない。'],
  bust: ['体のケアには少し気をつけたほうがいいかもしれません。', '波のある選手だと聞いています。'],
};
const GENERIC = ['何者なのか、私にもよく分かりません。', '…この話、乗るかどうかはあなた次第です。'];

export function mysteryTick(state: GameState) {
  const o = state.mysteryOffer;
  if (o && state.day >= o.expires) {
    const p = state.players[o.playerId];
    if (p && !p.teamId) delete state.players[p.id];
    delete state.mysteryOffer;
    return;
  }
  const w = windowStatus(state);
  state.flags = state.flags ?? {};
  const key = `mx-${state.season}-${w.label}`;
  if (o || !w.open || state.flags[key] || rand() >= MYSTERY_RATE) return;
  state.flags[key] = true;
  spawnMystery(state);
}

export function spawnMystery(state: GameState): Player {
  const roll = rand();
  const tier = roll < 0.3 ? 'jackpot' : roll < 0.7 ? 'normal' : 'bust';
  const pos = pick(POSITIONS);
  const p = generatePlayer({ position: pos, level: randInt(70, 78), age: randInt(19, 26), teamId: null });
  if (tier === 'jackpot') {
    p.potential = Math.min(99, overall(p) + randInt(10, 16));
    p.growth = 'late';
  } else if (tier === 'normal') {
    p.potential = overall(p) + randInt(1, 4);
  } else {
    p.potential = overall(p);
    p.traits = { ...p.traits, injuryRes: 1, form: randInt(1, 3) };
  }
  p.mystery = { tier };
  state.players[p.id] = p;
  const fee = round2(Math.max(1, marketValue(p) * 0.3));
  state.mysteryOffer = { playerId: p.id, fee, expires: state.day + 4 };
  const hint = rand() < 0.7 ? pick(HINTS[tier]) : pick(GENERIC);
  sendMail(state, {
    from: 'agent',
    sender: '代理人 X',
    subject: '【？】ある選手を、格安で',
    body: `はじめまして。名乗るほどの者ではありません。\n\nある選手を、格安でお譲りしたい。\n${p.name}（${p.age}歳・${p.position}・総合値 ${overall(p)}）\n移籍金：${fmtMoney(fee)}\n\n${hint}\n\nなぜ安いのか？ それは聞かないでください。（回答期限 4日）`,
    action: 'mystery',
    playerId: p.id,
    important: true,
  });
  return p;
}

export function signMystery(state: GameState): Result {
  const o = state.mysteryOffer;
  if (!o) return { ok: false, message: 'この話はもう終わっています' };
  const p = state.players[o.playerId];
  if (!p) return { ok: false, message: 'この話はもう終わっています' };
  if (state.money < o.fee) return { ok: false, message: '移籍資金が足りません' };
  if (squadOf(state, state.userTeamId).length >= MAX_SQUAD) return { ok: false, message: `登録は最大${MAX_SQUAD}人までです` };
  delete state.mysteryOffer;
  state.money = round2(state.money - o.fee);
  markSpent(state, o.fee);
  p.teamId = state.userTeamId;
  p.salary = round2(Math.max(0.3, fairSalary(p) * 0.7));
  p.contractYears = 3;
  p.joinedSeason = state.season;
  const used = new Set(squadOf(state, state.userTeamId).filter((x) => x.id !== p.id).map((x) => x.number));
  while (used.has(p.number)) p.number = randInt(13, 49);
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【獲得】謎の代理人から${p.name}を ${fmtMoney(o.fee)} で獲得` });
  repairLineup(state, teamById(state, state.userTeamId));
  return { ok: true, message: `${p.name}を獲得しました。正体はいずれ分かるはず…` };
}

export function passMystery(state: GameState) {
  const o = state.mysteryOffer;
  if (!o) return;
  delete state.players[o.playerId];
  delete state.mysteryOffer;
}

/** 試合を重ねると正体が分かる */
export function revealMystery(state: GameState, p: Player) {
  if (!p.mystery || p.mystery.revealed || (p.clubApps ?? 0) < 8) return;
  p.mystery.revealed = true;
  const t = p.mystery.tier;
  const text =
    t === 'jackpot'
      ? 'とんでもない掘り出し物でした。伸びしろは、まだまだ底が見えません。'
      : t === 'normal'
        ? '値段なりの、堅実な選手でした。'
        : '…安いのには、やはり理由がありました。ケガと好不調の波に悩まされそうです。';
  sendMail(state, { from: 'coach', sender: 'ヘッドコーチ', subject: `【正体判明】${p.name}`, body: `謎の代理人から獲得した${p.name}。しばらく一緒にやって、正体が分かってきました。\n\n${text}`, playerId: p.id, important: t === 'jackpot' });
  if (t === 'jackpot') {
    unlock(state, 'mysteryJackpot');
    addCounter(state, 'jackpot');
  }
}

/** 隣のポジション（名将の報酬の候補を並べる時に、近い順にする） */
export function nearFirst(p: Player, list: Position[]): Position[] {
  const near = new Set(NEIGHBORS[p.position]);
  return [...list].sort((a, b) => Number(near.has(b)) - Number(near.has(a)));
}
