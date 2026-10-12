import { fmtMoney, round2 } from './economy';
import { unlock } from './events';
import type { TeamSnapshot } from './friendly';
import { LEGENDS, makeLegend, type LegendSeed } from './legend';
import { repairLineup, squadOf } from './lineup';
import { sendMail } from './mail';
import { FORMATIONS } from './positions';
import { clamp, rand, randInt, uid } from './rng';
import { teamById } from './season';
import { autoSkills, generateStats, overall, STAT_KEYS } from './stats';
import { MAX_SQUAD, type Result } from './transfer';
import type { GameState, Position } from './types';

/**
 * レジェンドチームとの対戦イベント（1シーズンに1回あるかないか）。
 * ほぼ全員が能力カンストのレジェンドXIに挑み、勝てばその中の1人と移籍交渉ができる。
 * 交渉で来てくれるのは「若き日の」その選手（総合値は低いが、育てるととても強くなる）。
 */

/** スタメン（4-3-3 の枠と同じ順）とベンチ */
const XI: [string, Position][] = [
  ['yashin', 'GK'],
  ['maldini', 'LSB'],
  ['beckenbauer', 'CB'],
  ['baresi', 'CB'],
  ['cafu', 'RSB'],
  ['pirlo', 'DMF'],
  ['xavi', 'CMF'],
  ['iniesta', 'CMF'],
  ['ronaldinho', 'LWG'],
  ['r9', 'CF'],
  ['best', 'RWG'],
];
const BENCH = ['kahn', 'cannavaro', 'rcarlos', 'zidane', 'maradona', 'pele', 'cruyff'];

/** レジェンドの能力水準（カンスト付近） */
const LEVEL = 94;
const CHALLENGE_RATE = 0.035;

function seed(id: string): LegendSeed {
  return LEGENDS.find((l) => l.id === id)!;
}

/** レジェンドXI のチーム（親善試合と同じ形式） */
export function legendTeamSnapshot(): TeamSnapshot {
  const players = [...XI.map(([id]) => id), ...BENCH].map((id) => {
    const s = seed(id);
    const st = generateStats(s.pos, LEVEL, s.style);
    for (const k of s.sig) st[k] = 99;
    for (const k of STAT_KEYS) st[k] = clamp(st[k] + 2, 35, 99);
    const skills = [...new Set([...s.skills, ...autoSkills(st, s.pos, s.style)])].slice(0, 12);
    return {
      n: s.name,
      p: s.pos,
      no: s.pos === 'GK' ? 1 : randInt(2, 23),
      st: STAT_KEYS.map((k) => st[k]),
      sk: skills,
      sy: s.style,
      ap: { [s.pos]: 3 },
      h: s.height,
      ft: s.foot,
      ag: 28,
      app: { skin: s.look[0], hairStyle: s.look[1], hairColor: s.look[2], beard: s.look[3], face: 0, brow: 0 },
    };
  });
  // 背番号の重複をなくす
  const used = new Set<number>();
  for (const p of players) {
    while (used.has(p.no)) p.no++;
    used.add(p.no);
  }
  return {
    v: 1,
    name: 'レジェンドXI',
    short: 'LGD',
    color: '#d4af37',
    color2: '#111111',
    formation: '4-3-3',
    tactic: 'attack',
    spirit: 99,
    slots: FORMATIONS['4-3-3'].map((x) => ({ ...x })),
    players,
  };
}

/** 試合日ごと：シーズン中盤に、ごく稀に挑戦状が届く（1シーズン1回まで） */
export function legendChallengeTick(state: GameState, day: { type: string; round: number }) {
  state.flags = state.flags ?? {};
  const c = state.legendChallenge;
  if (c && c.status === 'invited' && state.day >= c.expires) {
    delete state.legendChallenge;
    sendMail(state, { from: 'league', sender: 'レジェンドXI', subject: '挑戦状の期限が過ぎました', body: 'レジェンドXIは次の挑戦者のもとへ去っていきました。' });
    return;
  }
  if (c && c.status === 'won' && state.day >= c.expires) {
    delete state.legendChallenge;
    return;
  }
  const key = `lc-${state.season}`;
  if (state.flags[key] || state.legendChallenge || day.type !== 'PL' || day.round < 8 || day.round > 32) return;
  if (rand() >= CHALLENGE_RATE) return;
  state.flags[key] = true;
  spawnLegendChallenge(state);
}

export function spawnLegendChallenge(state: GameState) {
  state.legendChallenge = { status: 'invited', expires: state.day + 5 };
  sendMail(state, {
    from: 'league',
    sender: 'レジェンドXI',
    subject: '⚔️【挑戦状】レジェンドXIが対戦を申し込んできた',
    body: 'サッカーの歴史を彩った伝説の選手たちが集結した「レジェンドXI」から、対戦の申し込みが届きました。\n\n彼らに勝った者だけが、その中の1人と話をする権利を得られるといいます。\n\n挑戦するかどうかは監督次第です。（回答期限 5日）\n※この試合はセーブの成績には影響しません',
    action: 'legendMatch',
    important: true,
    legend: true,
  });
}

/** 試合結果を受け取る（勝てば交渉権） */
export function finishLegendChallenge(state: GameState, gf: number, ga: number) {
  const c = state.legendChallenge;
  if (!c || c.status !== 'invited') return;
  if (gf > ga) {
    state.legendChallenge = { status: 'won', expires: state.day + 5 };
    unlock(state, 'legendSlayer');
    sendMail(state, {
      from: 'league',
      sender: 'レジェンドXI',
      subject: '🏆【快挙】レジェンドXIを倒した！',
      body: `${gf}-${ga}。信じられない結果です！\n\nレジェンドXIの選手たちは、あなたのチームに敬意を表しています。約束どおり、この中の1人と移籍の話ができます。\n\nただし伝説の選手を口説くのは簡単ではありません。（回答期限 5日）`,
      action: 'legendPick',
      important: true,
      legend: true,
    });
  } else {
    delete state.legendChallenge;
    sendMail(state, {
      from: 'league',
      sender: 'レジェンドXI',
      subject: `レジェンドXIに敗れた（${gf}-${ga}）`,
      body: '伝説の壁は厚かった…。\nまたいつか、彼らが現れる日が来るかもしれません。',
      legend: true,
    });
  }
}

export function declineLegendChallenge(state: GameState) {
  delete state.legendChallenge;
}

export const LEGEND_PICKS = [...XI.map(([id]) => id), ...BENCH];

export function pickCandidates(): LegendSeed[] {
  return LEGEND_PICKS.map(seed);
}

/** 交渉の条件（移籍金は資金の2〜4割） */
export function pickTerms(state: GameState): { fee: number; chance: number } {
  const user = teamById(state, state.userTeamId);
  return {
    fee: round2(Math.max(20, state.money * 0.3)),
    chance: clamp(0.2 + (user.rep - 80) * 0.005, 0.1, 0.3),
  };
}

/** 選んだレジェンドと交渉（1回きり） */
export function negotiateLegendPick(state: GameState, seedId: string): Result & { joined?: boolean } {
  const c = state.legendChallenge;
  if (!c || c.status !== 'won') return { ok: false, message: 'この話はもう終わっています' };
  if (!LEGEND_PICKS.includes(seedId)) return { ok: false, message: '選べない選手です' };
  const { fee, chance } = pickTerms(state);
  if (state.money < fee) return { ok: false, message: `移籍資金が足りません（必要 ${fmtMoney(fee)}）` };
  if (squadOf(state, state.userTeamId).length >= MAX_SQUAD) return { ok: false, message: `登録は最大${MAX_SQUAD}人までです` };
  const s = seed(seedId);
  delete state.legendChallenge;
  if (rand() >= chance) {
    sendMail(state, { from: 'agent', sender: s.name, subject: `${s.name}「今回は遠慮しておくよ」`, body: `君たちのサッカーは素晴らしかった。だが、まだ一緒に戦う時ではないようだ。\n\n（交渉は不成立に終わりました）`, legend: true });
    return { ok: true, joined: false, message: `${s.name}は首を縦に振らなかった…` };
  }
  // 若き日のレジェンド：総合値は低いが、育てるととても強くなる
  const p = makeLegend(s, 'prodigy');
  p.name = s.name;
  p.age = randInt(18, 20);
  p.potential = randInt(101, 107);
  p.teamId = state.userTeamId;
  p.contractYears = 5;
  p.salary = round2(Math.max(1.5, fee * 0.05));
  p.joinedSeason = state.season;
  p.legend!.signed = true;
  const used = new Set(squadOf(state, state.userTeamId).map((x) => x.number));
  while (used.has(p.number)) p.number = randInt(2, 49);
  state.players[p.id] = p;
  state.money = round2(state.money - fee);
  state.flags = state.flags ?? {};
  state.flags[`legend-${s.id}`] = true;
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【伝説加入】若き日の${p.name}が入団（移籍金 ${fmtMoney(fee)}）` });
  sendMail(state, {
    from: 'agent',
    sender: s.name,
    subject: `🌟 ${p.name}が入団！`,
    body: `君たちと一緒に、もう一度夢を見てみたくなった。\n\n若き日の${p.name}が加入しました（総合値 ${overall(p)}）。今はまだ荒削りですが、育てればかつての輝きを取り戻すはずです。`,
    playerId: p.id,
    important: true,
    legend: true,
  });
  unlock(state, 'legend');
  repairLineup(state, teamById(state, state.userTeamId));
  return { ok: true, joined: true, message: `${p.name}が入団！` };
}
