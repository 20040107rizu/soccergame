import { SODE_COLORS, SODE_NAME, SODE_PLAYERS, SODE_SHORT, SODE_SLOTS, type SodeSeed } from '../data/sodegaura';
import { fairSalary, fmtMoney, round2 } from './economy';
import type { TeamSnapshot } from './friendly';
import { repairLineup, squadOf } from './lineup';
import { sendMail } from './mail';
import { clamp, rand, randInt, uid } from './rng';
import { teamById } from './season';
import { overall, STAT_KEYS } from './stats';
import { MAX_SQUAD, type Result } from './transfer';
import type { GameState, Player, Stats } from './types';

/**
 * ひみつのチームからの挑戦（レジェンドXIよりずっと稀）。
 * 勝つと、メンバーからランダムに選ばれた1人と交渉できる（レジェンドよりは話を聞いてくれる）。
 */

/** レジェンドXIと同じくらいの強さにするための底上げ */
const BOOST = 5;
const CHALLENGE_RATE = 0.01;

export function sodeStats(s: SodeSeed, boost = 0): Stats {
  const st = {} as Stats;
  const vals = [...s.a, ...s.d.slice(0, 3)];
  STAT_KEYS.slice(0, 20).forEach((k, i) => (st[k] = vals[i]));
  st.defEngagement = Math.round((s.d[0] + s.d[2]) / 2);
  (['gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach'] as const).forEach((k, i) => (st[k] = s.gk[i]));
  if (boost) for (const k of STAT_KEYS) if (st[k] > 45) st[k] = clamp(st[k] + boost, 35, 99);
  return st;
}

function look(i: number) {
  return { skin: 1, hairStyle: [0, 1, 2, 5, 6][i % 5], hairColor: 0, beard: 0, face: i % 4, brow: i % 3 };
}

/** 上位の選手（当たった時にイナズマが落ちる） */
export function isTopSode(s: SodeSeed): boolean {
  return s.efo >= 99;
}

export function sodeTeamSnapshot(boost = BOOST): TeamSnapshot {
  return {
    v: 1,
    name: SODE_NAME,
    short: SODE_SHORT,
    color: SODE_COLORS[0],
    color2: SODE_COLORS[1],
    formation: 'カスタム',
    tactic: 'attack',
    spirit: 99,
    slots: SODE_SLOTS.map((x) => ({ ...x })),
    players: SODE_PLAYERS.map((s, i) => {
      const st = sodeStats(s, boost);
      return {
        n: s.name,
        p: s.pos,
        no: s.no,
        st: STAT_KEYS.map((k) => st[k]),
        sk: s.skills,
        sy: s.style,
        ap: s.apt,
        h: s.height,
        ft: s.foot,
        ag: 17,
        app: look(i),
      };
    }),
  };
}

/** 試合日ごと：シーズン中盤に、ごく稀に挑戦状が届く */
export function sodeChallengeTick(state: GameState, day: { type: string; round: number }) {
  state.flags = state.flags ?? {};
  const c = state.sodeChallenge;
  if (c && c.status === 'invited' && state.day >= c.expires) {
    delete state.sodeChallenge;
    sendMail(state, { from: 'league', sender: SODE_NAME, subject: '挑戦状の期限が過ぎました', body: '彼らは静かに去っていきました。', sode: true });
    return;
  }
  if (c && c.status === 'won' && state.day >= c.expires) {
    delete state.sodeChallenge;
    return;
  }
  const key = `sc-${state.season}`;
  if (state.flags[key] || state.sodeChallenge || state.legendChallenge || day.type !== 'PL' || day.round < 10 || day.round > 30) return;
  if (rand() >= CHALLENGE_RATE) return;
  state.flags[key] = true;
  spawnSodeChallenge(state);
}

export function spawnSodeChallenge(state: GameState) {
  state.sodeChallenge = { status: 'invited', expires: state.day + 5 };
  sendMail(state, {
    from: 'league',
    sender: SODE_NAME,
    subject: `⚡【挑戦状】${SODE_NAME}が対戦を申し込んできた`,
    body: `聞いたことのない名前のチームから、対戦の申し込みが届きました。\n\n「${SODE_NAME}」――緑と黄色のユニフォームの、17歳の若者たち。噂では、とんでもない実力を持っているといいます。\n\n勝てば、メンバーの誰か1人が、あなたのクラブに興味を示すかもしれません。（回答期限 5日）\n※この試合はセーブの成績には影響しません`,
    action: 'sodeMatch',
    important: true,
    sode: true,
  });
}

export function finishSodeChallenge(state: GameState, gf: number, ga: number) {
  const c = state.sodeChallenge;
  if (!c || c.status !== 'invited') return;
  if (gf > ga) {
    const pool = SODE_PLAYERS.map((_, i) => i).filter((i) => !state.flags?.[`sode-${SODE_PLAYERS[i].name}`]);
    if (!pool.length) {
      delete state.sodeChallenge;
      return;
    }
    state.sodeChallenge = { status: 'won', expires: state.day + 5, pick: pool[randInt(0, pool.length - 1)] };
    sendMail(state, {
      from: 'league',
      sender: SODE_NAME,
      subject: `⚡【快挙】${SODE_NAME}を倒した！`,
      body: `${gf}-${ga}。見事な勝利です！\n\n試合のあと、彼らの中の1人が、あなたのクラブに興味を示しているようです。\n\n誰が来るのかは、まだ分かりません。（回答期限 5日）`,
      action: 'sodePick',
      important: true,
      sode: true,
    });
  } else {
    delete state.sodeChallenge;
    sendMail(state, { from: 'league', sender: SODE_NAME, subject: `${SODE_NAME}に敗れた（${gf}-${ga}）`, body: '若き才能の壁は厚かった…。\nまたいつか、彼らと戦う日が来るかもしれません。', sode: true });
  }
}

export function declineSodeChallenge(state: GameState) {
  delete state.sodeChallenge;
}

/** 当たった選手の詳細（演出用） */
export function sodePickSeed(state: GameState): SodeSeed | null {
  const c = state.sodeChallenge;
  return c && c.status === 'won' && c.pick !== undefined ? SODE_PLAYERS[c.pick] ?? null : null;
}

/** 交渉の条件（レジェンドよりは話を聞いてくれる） */
export function sodeTerms(state: GameState): { fee: number; chance: number } {
  const user = teamById(state, state.userTeamId);
  return {
    fee: round2(Math.max(15, state.money * 0.2)),
    chance: clamp(0.4 + (user.rep - 80) * 0.006, 0.3, 0.55),
  };
}

/** 選ばれた選手を、ゲームの選手として作る */
export function makeSodePlayer(s: SodeSeed): Player {
  const i = SODE_PLAYERS.indexOf(s);
  const p: Player = {
    id: uid('sd'),
    name: s.name,
    nameEn: '',
    nationality: '日本',
    age: 17,
    height: s.height,
    position: s.pos,
    aptitudes: { ...s.apt },
    foot: s.foot,
    number: s.no,
    stats: sodeStats(s),
    traits: { weakFootUse: s.t[0], weakFootAcc: s.t[1], form: s.t[2], injuryRes: s.t[3] },
    skills: [...s.skills],
    style: s.style,
    potential: 0,
    growth: 'normal',
    teamId: null,
    contractYears: 0,
    salary: 0,
    condition: 4,
    injury: 0,
    suspension: 0,
    ambition: 70,
    loyalty: 60,
    season: { apps: 0, goals: 0, assists: 0, clApps: 0, clGoals: 0 },
    career: { apps: 0, goals: 0, assists: 0, clApps: 0, clGoals: 0 },
    appearance: look(i < 0 ? 0 : i),
  };
  p.potential = Math.min(107, overall(p) + randInt(4, 8));
  return p;
}

/** 交渉（1回きり） */
export function negotiateSodePick(state: GameState): Result & { joined?: boolean } {
  const s = sodePickSeed(state);
  if (!s) return { ok: false, message: 'この話はもう終わっています' };
  const { fee, chance } = sodeTerms(state);
  if (state.money < fee) return { ok: false, message: `移籍資金が足りません（必要 ${fmtMoney(fee)}）` };
  if (squadOf(state, state.userTeamId).length >= MAX_SQUAD) return { ok: false, message: `登録は最大${MAX_SQUAD}人までです` };
  delete state.sodeChallenge;
  if (rand() >= chance) {
    sendMail(state, { from: 'agent', sender: s.name, subject: `${s.name}「…ごめんなさい」`, body: `声をかけてもらえて嬉しかったです。でも、今はまだこのチームで戦いたい。\n\n（交渉は不成立に終わりました）`, sode: true });
    return { ok: true, joined: false, message: `${s.name}は首を縦に振らなかった…` };
  }
  const p = makeSodePlayer(s);
  p.teamId = state.userTeamId;
  p.contractYears = 5;
  p.salary = round2(Math.max(0.5, fairSalary(p) * 0.6));
  p.joinedSeason = state.season;
  const used = new Set(squadOf(state, state.userTeamId).map((x) => x.number));
  while (used.has(p.number)) p.number = randInt(2, 49);
  state.players[p.id] = p;
  state.money = round2(state.money - fee);
  state.flags = state.flags ?? {};
  state.flags[`sode-${s.name}`] = true;
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【加入】${SODE_NAME}の${p.name}が入団（移籍金 ${fmtMoney(fee)}）` });
  sendMail(state, {
    from: 'agent',
    sender: s.name,
    subject: `⚡ ${p.name}が入団！`,
    body: `よろしくお願いします！ このクラブで、もっと上を目指します。\n\n${SODE_NAME}の${p.name}が加入しました（総合値 ${overall(p)}）。`,
    playerId: p.id,
    important: true,
    sode: true,
  });
  repairLineup(state, teamById(state, state.userTeamId));
  return { ok: true, joined: true, message: `${p.name}が入団！` };
}
