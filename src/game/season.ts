import { CL_2026, EU_SEEDS, emptyStats, generateOriginalSquad, generatePlayer, PL_SEEDS, playerFromSeed, teamFromSeed } from './data';
import { CL_STAGE_PRIZE, fairSalary, fmtMoney as fmtYen, leaguePrize, marketValue, MATCH_PRIZE, payroll, round2, wageCap } from './economy';
import { advanceCL, buildCalendar, clLeagueFixtures, plFixtures, plTable, resolveTie, stageComplete, STAGE_LABEL, windowStatus } from './competitions';
import { createMatch, sideRoles, simulateToEnd, sidePower, type LiveMatch } from './engine';
import { legendGrowth, legendTick, spawnHeir } from './legend';
import { afterUserMatch, dailyEvents, heirsDue, jobOfferAtSeasonEnd, listedPlayersTick, onRetire, planHeirs, promoteAcademy, seasonEndAchievements } from './events';
import { mailBestEleven, mailCompetition, mailContractAdvice, mailGrowth, mailInjury, mailPlayerFeelings, mailRedCard, mailScoutAdvice, mailTacticAdvice, mailWindow, sendMail, tryAptitudeGain, tryNewSkill } from './mail';
import { applyFormation, autoLineup, available, repairLineup, setAutoLineup, squadOf, updateSpirit } from './lineup';
import { FORMATION_LIST, FORMATIONS, rolesOf } from './positions';
import { clamp, pick, rand, randInt, uid } from './rng';
import { overall, OVR_WEIGHTS, STAT_KEYS, ratingAt } from './stats';
import type { CLStage, Condition, Fixture, Formation, GameState, Player, Position, StatKey, Team } from './types';

export interface OriginalSetup {
  name: string;
  short: string;
  color: string;
  color2: string;
  /** 入れ替えるクラブ */
  replaces: string;
}

export const ORIGINAL_ID = 'orig';

/* ---------------- 新規ゲーム ---------------- */

export function newGame(managerName: string, userTeamId: string, original?: OriginalSetup): GameState {
  const teams: Team[] = [];
  const players: Record<string, Player> = {};
  const seeds = [...PL_SEEDS, ...EU_SEEDS];
  for (const seed of seeds) {
    if (original && seed.id === original.replaces) continue;
    const t = teamFromSeed(seed);
    teams.push(t);
    const used = new Set<number>();
    seed.players.forEach((line, i) => {
      const p = playerFromSeed(line, t.id);
      while (players[p.id]) p.id += '_' + i;
      while (used.has(p.number)) p.number = p.number < 99 ? p.number + 1 : 2;
      used.add(p.number);
      players[p.id] = p;
    });
  }
  let budget = 0;
  if (original) {
    const replaced = seeds.find((s) => s.id === original.replaces)!;
    const t: Team = {
      id: ORIGINAL_ID,
      name: original.name,
      en: original.name,
      short: original.short,
      color: original.color,
      color2: original.color2,
      rep: 50,
      country: 'イングランド',
      league: 'PL',
      formation: '4-3-3',
      tactic: 'balance',
      lineup: [],
      slots: FORMATIONS['4-3-3'].map((x) => ({ ...x })),
      spirit: 70,
      bench: [],
      budget: 0,
      original: true,
    };
    teams.push(t);
    for (const p of generateOriginalSquad(t.id)) players[p.id] = p;
    budget = Math.max(40, replaced.budget);
    userTeamId = ORIGINAL_ID;
  } else {
    budget = seeds.find((s) => s.id === userTeamId)!.budget;
  }

  const state: GameState = {
    version: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    managerName,
    userTeamId,
    season: 1,
    day: 0,
    calendar: buildCalendar(),
    money: budget,
    teams,
    players,
    fixtures: [],
    clTeams: CL_2026.map((id) => (original && id === original.replaces ? ORIGINAL_ID : id)),
    ties: [],
    offers: [],
    negotiations: {},
    news: [],
    mails: [],
    watchlist: [],
    history: [],
  };

  for (let i = 0; i < 40; i++) {
    const p = generatePlayer({ position: pick(FA_POSITIONS), level: 58 + randInt(0, 14), teamId: null });
    state.players[p.id] = p;
  }
  for (const t of teams) {
    applyFormation(t, bestFormation(state, t));
    setAutoLineup(state, t);
    t.lastLineup = [...t.lineup];
    t.spirit = t.original ? 70 : 80;
  }
  setupFixtures(state);
  const user = teams.find((t) => t.id === userTeamId)!;
  state.news.unshift({
    id: uid('n'),
    season: 1,
    day: 0,
    kind: 'info',
    text: `${managerName}監督が${user.name}の監督に就任。マスターリーグ 2026-27 シーズン開幕！`,
  });
  sendMail(state, {
    from: 'board',
    sender: `${user.name} 会長`,
    subject: 'ようこそ、監督',
    body: `${managerName}監督、${user.name}へようこそ。\n\n今シーズンの移籍資金は ${fmtYen(state.money)} です。夏の移籍市場は第4節の前まで開いています。\nクラブの未来をあなたに託します。`,
    important: true,
  });
  mailWindow(state, true);
  mailScoutAdvice(state);
  return state;
}

const FA_POSITIONS: Position[] = ['GK', 'CB', 'CB', 'LSB', 'RSB', 'DMF', 'CMF', 'CMF', 'OMF', 'LMF', 'RMF', 'LWG', 'RWG', 'CF', 'CF'];

function setupFixtures(state: GameState) {
  const plIds = state.teams.filter((t) => t.league === 'PL').map((t) => t.id);
  state.fixtures = [...plFixtures(plIds, state.calendar), ...clLeagueFixtures(state.clTeams, state.teams, state.calendar)];
  state.ties = [];
}

export function bestFormation(state: GameState, team: Team): Formation {
  const squad = squadOf(state, team.id);
  let best: Formation = '4-3-3';
  let bestV = -1;
  for (const f of FORMATION_LIST) {
    const roles = rolesOf(FORMATIONS[f]);
    const { lineup } = autoLineup(squad, roles);
    const v = lineup.reduce((s, id, i) => s + (state.players[id] ? ratingAt(state.players[id], roles[i]) : 0), 0);
    if (v > bestV) {
      bestV = v;
      best = f;
    }
  }
  return best;
}

/* ---------------- 日程の参照 ---------------- */

export function today(state: GameState) {
  return state.calendar[state.day];
}

export function fixturesOfDay(state: GameState, day = state.day): Fixture[] {
  return state.fixtures.filter((f) => f.day === day);
}

export function userFixture(state: GameState, day = state.day): Fixture | undefined {
  return fixturesOfDay(state, day).find((f) => f.home === state.userTeamId || f.away === state.userTeamId);
}

export function isSeasonOver(state: GameState): boolean {
  return state.day >= state.calendar.length;
}

export function teamById(state: GameState, id: string): Team {
  return state.teams.find((t) => t.id === id)!;
}

/* ---------------- 試合日の処理 ---------------- */

export interface DayReport {
  userResult?: { gf: number; ga: number; prize: number; label: string };
  news: string[];
}

/** 試合前の準備：CPU はベストメンバー、ユーザーは出場できない選手を自動で入れ替え */
export function prepareDay(state: GameState) {
  for (const f of fixturesOfDay(state)) {
    for (const id of [f.home, f.away]) {
      const t = teamById(state, id);
      if (id === state.userTeamId) repairLineup(state, t, true);
      else {
        // CPU は大会や疲労に応じて少しローテーション
        setAutoLineup(state, t);
      }
    }
  }
}

/** その日の全試合を行う。userMatch はユーザーが観戦・采配した試合 */
export function playDay(state: GameState, userMatch?: LiveMatch): DayReport {
  const report: DayReport = { news: [] };
  const day = today(state);
  if (!day) return report;
  let userGame: { f: Fixture; m: LiveMatch } | undefined;
  for (const f of fixturesOfDay(state)) {
    if (f.result) continue;
    const isUser = f.home === state.userTeamId || f.away === state.userTeamId;
    let m: LiveMatch;
    if (isUser && userMatch && userMatch.fixtureId === f.id && userMatch.finished) m = userMatch;
    else {
      m = createMatch(state, f.id);
      simulateToEnd(state, m);
    }
    applyMatch(state, f, m);
    if (isUser) userGame = { f, m };
  }

  // CL のステージ進行
  if (day.type === 'CL' && day.stage) progressCL(state, day.stage, day.leg);

  if (userGame) report.userResult = userResultNews(state, userGame.f, userGame.m);

  // 負傷の回復・調子の変化
  for (const p of Object.values(state.players)) {
    if (p.injury > 0) p.injury--;
    updateCondition(p);
  }

  // 移籍期間中の CPU からのオファーと補強
  const wasOpen = windowStatus(state).open;
  aiTransferActivity(state);
  periodicMails(state, day, wasOpen);
  legendTick(state);
  dailyEvents(state, day);
  listedPlayersTick(state);

  state.day++;
  state.updatedAt = Date.now();
  return report;
}

function userResultNews(state: GameState, f: Fixture, m: LiveMatch) {
  const day = today(state);
  const home = f.home === state.userTeamId;
  const gf = home ? m.score.home : m.score.away;
  const ga = home ? m.score.away : m.score.home;
  const prizeTable = MATCH_PRIZE[f.comp];
  const prize = gf > ga ? prizeTable.win : gf === ga ? prizeTable.draw : prizeTable.loss;
  state.money = round2(state.money + prize);
  const opp = teamById(state, home ? f.away : f.home);
  const scorers = m.events.filter((e) => e.type === 'goal' && e.side === (home ? 'home' : 'away')).map((e) => state.players[e.playerId!]?.name);
  const r = f.result!;
  const pk = r.pkHome !== undefined ? `（PK ${home ? r.pkHome : r.pkAway}-${home ? r.pkAway : r.pkHome}）` : '';
  const label = `${day.label} vs ${opp.name} ${gf}-${ga}${pk}`;
  state.news.unshift({
    id: uid('n'),
    season: state.season,
    day: state.day,
    kind: 'match',
    text: `${label} ${gf > ga ? '勝利' : gf === ga ? '引き分け' : '敗戦'}${scorers.length ? `（得点：${scorers.join('、')}）` : ''} 賞金 +${fmtYen(prize)}`,
  });
  return { gf, ga, prize, label };
}

/** 節の進行に合わせて届くメール */
function periodicMails(state: GameState, day: { type: string; round: number }, wasOpen: boolean) {
  const nextDay = state.calendar[state.day + 1];
  const nextRound = nextDay?.type === 'PL' ? nextDay.round : -1;
  if (day.type === 'PL') {
    const r = day.round + 1;
    if (r % 5 === 0) mailBestEleven(state, `第${r - 4}〜${r}節`);
    if (r % 6 === 3) mailTacticAdvice(state);
    if (r % 7 === 4) mailPlayerFeelings(state);
    if (r === 19) mailContractAdvice(state);
  }
  // 移籍市場の開閉
  state.flags = state.flags ?? {};
  const next = windowStatus({ ...state, day: state.day + 1 } as GameState);
  if (!wasOpen && next.open) {
    state.day++;
    mailWindow(state, true);
    mailScoutAdvice(state);
    state.day--;
  }
  const key = `close-${state.season}-${next.label}`;
  if (next.open && next.remaining === 1 && nextRound >= 0 && !state.flags[key]) {
    state.flags[key] = true;
    mailWindow(state, false);
  }
}

function progressCL(state: GameState, stage: CLStage, leg?: 1 | 2) {
  if (stage !== 'LP' && (leg === 2 || stage === 'F')) {
    for (const tie of state.ties.filter((t) => t.stage === stage && !t.winner)) {
      resolveTie(state, tie, (id) => {
        const t = teamById(state, id);
        const m = createMatch(state, state.fixtures.find((f) => f.tieId === tie.id)!.id);
        const p = sidePower(state, m[m.home.teamId === t.id ? 'home' : 'away']);
        return p.attack + p.midfield + p.defense;
      });
    }
  }
  if (!stageComplete(state, stage)) return;
  const user = state.userTeamId;
  if (stage === 'F') {
    const tie = state.ties.find((t) => t.stage === 'F')!;
    const winner = teamById(state, tie.winner!);
    state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'info', text: `🏆 チャンピオンズリーグ優勝は${winner.name}！` });
    mailCompetition(state, `🏆 チャンピオンズリーグ優勝は${winner.name}`, tie.winner === user ? `おめでとうございます！ ${winner.name}がヨーロッパの頂点に立ちました！\n優勝賞金 ${fmtYen(CL_STAGE_PRIZE.win)} を獲得しました。` : `今季のチャンピオンズリーグは${winner.name}の優勝で幕を閉じました。`);
    if (tie.winner === user) state.money = round2(state.money + CL_STAGE_PRIZE.win);
    return;
  }
  const next = advanceCL(state, stage);
  if (!next) return;
  const inNext = state.ties.some((t) => t.stage === next && (t.a === user || t.b === user));
  const wasIn = stage === 'LP' ? state.clTeams.includes(user) : state.ties.some((t) => t.stage === stage && (t.a === user || t.b === user));
  if (wasIn) {
    if (inNext) {
      const prize = (CL_STAGE_PRIZE as Record<string, number>)[next] ?? 0;
      state.money = round2(state.money + prize);
      state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'info', text: `CL ${STAGE_LABEL[next]}進出！${prize ? ` 賞金 +${fmtYen(prize)}` : ''}` });
      const tie = state.ties.find((t) => t.stage === next && (t.a === user || t.b === user));
      const opp = tie ? teamById(state, tie.a === user ? tie.b : tie.a).name : '';
      mailCompetition(state, `【CL】${STAGE_LABEL[next]}進出！`, `チャンピオンズリーグ ${STAGE_LABEL[next]}への進出が決まりました。\n対戦相手：${opp}${prize ? `\nステージ賞金 ${fmtYen(prize)} を獲得しました。` : ''}`);
    } else {
      state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'info', text: `CL ${STAGE_LABEL[stage]}で敗退…` });
      mailCompetition(state, `【CL】${STAGE_LABEL[stage]}で敗退`, `チャンピオンズリーグは${STAGE_LABEL[stage]}で敗退となりました。\n来季、再びこの舞台に戻ってきましょう。`);
    }
  }
}

function applyMatch(state: GameState, f: Fixture, m: LiveMatch) {
  f.result = { home: m.score.home, away: m.score.away };
  const isCL = f.comp === 'CL';
  for (const key of ['home', 'away'] as const) {
    const side = m[key];
    const team = teamById(state, side.teamId);
    // 出場停止の消化（この試合に出られなかった選手）
    for (const p of squadOf(state, team.id)) if (p.suspension > 0) p.suspension--;
    const mine = team.id === state.userTeamId;
    const roles = sideRoles(side);
    for (const id of side.usedPlayers) {
      const p = state.players[id];
      if (!p) continue;
      if (isCL) p.season.clApps++;
      else {
        p.season.apps++;
        p.ratingSum = (p.ratingSum ?? 0) + (m.ratings[id] ?? 6);
      }
      p.career.apps++;
      const r = m.ratings[id] ?? 6;
      const before = overall(p);
      if (p.legend) {
        // レジェンドは試合を重ねるほどとんでもない速さで成長する
        const g = legendGrowth(p, r, bumpStats);
        if (g && mine) mailGrowth(state, p, g.from, g.to, true);
      } else if (p.age <= 25 && before < p.potential && rand() < (r >= 7 ? 0.3 : 0.12)) bumpStats(p, 1);
      if (mine && !p.legend) {
        // 急成長・新スキル・適性拡大
        if (p.age <= 23 && r >= 7.5 && before < p.potential && rand() < 0.06) {
          for (let i = 0; i < 6; i++) bumpStats(p, 1);
          mailGrowth(state, p, before, overall(p), true);
        } else if (overall(p) > before) {
          mailGrowth(state, p, before, overall(p), false);
        }
        if (p.age <= 26 && r >= 8 && rand() < 0.05) tryNewSkill(state, p);
      }
      const idx = side.lineup.indexOf(id);
      if (idx >= 0 && roles[idx]) tryAptitudeGain(state, p, roles[idx]);
    }
    for (const id of side.sentOff) {
      const p = state.players[id];
      if (!p) continue;
      p.suspension = 1;
      if (mine) mailRedCard(state, p);
    }
    for (const id of side.injured) {
      const p = state.players[id];
      if (!p) continue;
      p.injury = randInt(1, 3) + randInt(0, 4 - p.traits.injuryRes) * 2;
      if (mine) mailInjury(state, p);
    }
    // 隠しシステム（覚醒・師弟・隠し特性・因縁・約束・実績）
    if (mine) afterUserMatch(state, f, m, key, bumpStats);
    // チームスピリット（試合で使ったスタメンを基準に）
    updateSpirit(state, team);
  }
  for (const e of m.events) {
    if (e.type !== 'goal') continue;
    const s = state.players[e.playerId!];
    if (s) {
      if (isCL) s.season.clGoals++;
      else s.season.goals++;
      s.career.goals++;
    }
    const a = e.assistId ? state.players[e.assistId] : undefined;
    if (a && !isCL) {
      a.season.assists++;
      a.career.assists++;
    }
  }
}

/** 調子（コンディション）の変化。安定度が高いほど変わりにくい */
export function updateCondition(p: Player) {
  const changeP = 0.55 - p.traits.form * 0.05;
  if (rand() > changeP) return;
  const toward = p.condition < 3 ? 0.62 : p.condition > 3 ? 0.38 : 0.5;
  const c = clamp(p.condition + (rand() < toward ? 1 : -1), 1, 5);
  p.condition = c as Condition;
}

/** ポジションに関係する能力を中心に上げ下げする */
export function bumpStats(p: Player, amount: number) {
  const w = OVR_WEIGHTS[p.position];
  const keys = Object.keys(w) as StatKey[];
  const k: StatKey = rand() < 0.75 ? pick(keys) : pick(STAT_KEYS.filter((x) => !x.startsWith('gk') || p.position === 'GK'));
  p.stats[k] = clamp(p.stats[k] + amount, 35, 99);
}

/* ---------------- CPU の移籍活動 ---------------- */

function aiTransferActivity(state: GameState) {
  const w = windowStatus(state);
  if (!w.open) {
    // 移籍期間が終わったらオファーと交渉記録は無効
    state.offers = [];
    state.negotiations = {};
    return;
  }
  // ユーザーの選手へのオファー
  const userSquad = squadOf(state, state.userTeamId);
  if (rand() < 0.35 && userSquad.length > 16) {
    const target = userSquad
      .filter((p) => !state.offers.some((o) => o.playerId === p.id))
      .sort((a, b) => marketValue(b) * rand() - marketValue(a) * rand())[0];
    if (target) {
      const buyers = state.teams.filter((t) => t.id !== state.userTeamId && t.rep >= 55 && t.budget >= marketValue(target) * 0.8);
      const buyer = buyers.length ? pick(buyers) : null;
      if (buyer) {
        const fee = round2(marketValue(target) * (0.85 + rand() * 0.4));
        const offerId = uid('o');
        state.offers.push({ id: offerId, playerId: target.id, fromTeam: buyer.id, fee, day: state.day, maxFee: round2(fee * (1.08 + rand() * 0.4)), tries: 0 });
        state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【オファー】${buyer.name}が${target.name}に ${fmtYen(fee)} のオファー` });
        sendMail(state, {
          from: 'club',
          sender: buyer.name,
          subject: `【獲得オファー】${target.name}について`,
          body: `${buyer.name}です。貴クラブの${target.name}選手の獲得を希望します。\n\n移籍金として ${fmtYen(fee)} を提示いたします。\n（市場価値 ${fmtYen(marketValue(target))}）\n\nご検討のほど、よろしくお願いいたします。`,
          playerId: target.id,
          offerId,
          important: true,
        });
      }
    }
  }
  // CPU クラブ同士の補強（人数が足りないクラブがフリー選手を獲得）
  aiFillSquads(state);
}

export function aiFillSquads(state: GameState) {
  for (const t of state.teams) {
    if (t.id === state.userTeamId) continue;
    let squad = squadOf(state, t.id);
    const min = t.league === 'PL' ? 22 : 18;
    while (squad.length < min) {
      const need = neededPosition(squad);
      const free = Object.values(state.players)
        .filter((p) => !p.teamId && !p.legend && !p.gem && p.position === need && available(p))
        .sort((a, b) => overall(b) - overall(a));
      const level = Math.min(80, 50 + t.rep * 0.25);
      const sign = free.find((p) => overall(p) <= level + 6) ?? generatePlayer({ position: need, level, teamId: null, age: randInt(18, 21) });
      state.players[sign.id] = sign;
      sign.teamId = t.id;
      sign.contractYears = randInt(1, 3);
      sign.salary = fairSalary(sign);
      const used = new Set(squad.map((p) => p.number));
      while (used.has(sign.number)) sign.number = randInt(2, 99);
      squad = squadOf(state, t.id);
    }
    repairLineup(state, t);
  }
}

function neededPosition(squad: Player[]): Position {
  const want: Partial<Record<Position, number>> = { GK: 2, CB: 4, LSB: 2, RSB: 2, DMF: 2, CMF: 3, OMF: 1, LWG: 1, RWG: 1, CF: 2 };
  for (const p of squad) if (want[p.position] !== undefined) want[p.position]!--;
  return (Object.keys(want) as Position[]).sort((a, b) => want[b]! - want[a]!)[0];
}

/* ---------------- シーズン終了 ---------------- */

const CURVE = {
  early: { growUntil: 23, declineFrom: 28 },
  normal: { growUntil: 26, declineFrom: 30 },
  late: { growUntil: 29, declineFrom: 32 },
};

export interface SeasonSummary {
  rank: number;
  champion: string;
  clWinner?: string;
  userCl: string;
  prize: number;
  retired: string[];
  left: string[];
  promoted: string[];
  grown: { name: string; diff: number }[];
  repChange: number;
}

export function endSeason(state: GameState): SeasonSummary {
  const tbl = plTable(state);
  const rank = tbl.findIndex((r) => r.teamId === state.userTeamId) + 1;
  const champion = teamById(state, tbl[0].teamId).name;
  const finalTie = state.ties.find((t) => t.stage === 'F');
  const clWinner = finalTie?.winner ? teamById(state, finalTie.winner).name : undefined;
  const userCl = clResultLabel(state);
  const prize = leaguePrize(rank);
  state.money = round2(state.money + prize);

  const user = teamById(state, state.userTeamId);
  const oldRep = user.rep;
  const clBonus = userCl === '優勝' ? 4 : userCl === '決勝' ? 3 : userCl === '準決勝' ? 2 : userCl === '準々決勝' ? 1.5 : userCl === 'ラウンド16' ? 1 : 0;
  user.rep = Math.round(clamp(user.rep + (10.5 - rank) * 0.5 + clBonus, 40, 99));
  // CPU クラブの評価も成績で少し動く
  tbl.forEach((r, i) => {
    if (r.teamId === state.userTeamId) return;
    const t = teamById(state, r.teamId);
    t.rep = Math.round(clamp(t.rep + (10.5 - (i + 1)) * 0.15, 40, 99));
  });

  // 隠しシステム：実績・2世の予定・監督オファー（成績が確定した時点で）
  const userRow = tbl.find((r) => r.teamId === state.userTeamId);
  seasonEndAchievements(state, rank, userRow?.loss ?? 99, userCl);
  planHeirs(state, rank);
  const repOrder = state.teams.filter((t) => t.league === 'PL').sort((a, b) => b.rep - a.rep);
  jobOfferAtSeasonEnd(state, rank, repOrder.findIndex((t) => t.id === state.userTeamId) + 1, userCl);

  const summary: SeasonSummary = { rank, champion, clWinner, userCl, prize, retired: [], left: [], promoted: [], grown: [], repChange: user.rep - oldRep };

  for (const p of Object.values(state.players)) {
    const before = overall(p);
    const curve = CURVE[p.growth];
    p.age++;
    if (p.age <= curve.growUntil && before < p.potential) {
      const apps = p.season.apps + p.season.clApps;
      const playBoost = clamp(apps / 20, 0.3, 1.3);
      const steps = Math.round((p.potential - before) * 0.4 * playBoost + rand() * 2);
      for (let i = 0; i < steps * 3; i++) bumpStats(p, 1);
    } else if (p.age >= curve.declineFrom) {
      const steps = randInt(1, 2) + Math.max(0, p.age - curve.declineFrom);
      for (let i = 0; i < steps * 3; i++) bumpStats(p, -1);
      for (const k of ['speed', 'acceleration', 'stamina'] as StatKey[]) p.stats[k] = clamp(p.stats[k] - randInt(0, 2), 35, 99);
    }
    const after = overall(p);
    if (p.teamId === state.userTeamId && after !== before) summary.grown.push({ name: p.name, diff: after - before });
    p.season = emptyStats();
    p.injury = 0;
    p.suspension = 0;

    if (p.age >= 34 && rand() < 0.2 + (p.age - 34) * 0.18) {
      onRetire(state, p);
      if (p.teamId === state.userTeamId) summary.retired.push(p.name);
      delete state.players[p.id];
      continue;
    }
    if (p.teamId) {
      p.contractYears--;
      if (p.contractYears <= 0) {
        if (p.teamId === state.userTeamId) {
          summary.left.push(p.name);
          p.teamId = null;
          p.contractYears = 0;
        } else if (p.age >= 33 && rand() < 0.5) {
          p.teamId = null;
        } else {
          p.contractYears = randInt(1, 3);
          p.salary = fairSalary(p);
        }
      }
    }
  }
  summary.grown.sort((a, b) => b.diff - a.diff);

  // 新人・ベテランをフリー市場へ
  for (let i = 0; i < 30; i++) {
    const young = rand() < 0.65;
    const p = generatePlayer({ position: pick(FA_POSITIONS), level: young ? 55 + randInt(0, 12) : 60 + randInt(0, 14), age: young ? randInt(17, 19) : randInt(23, 31), teamId: null });
    state.players[p.id] = p;
  }
  summary.promoted = [...promoteAcademy(state), ...promoteYouth(state)];
  aiFillSquads(state);

  state.history.push({ season: state.season, rank, champion, clWinner, userCl });

  // 来季の CL 出場：PL 上位 5 クラブ＋欧州クラブ
  const plTop = tbl.slice(0, 5).map((r) => r.teamId);
  const eu = state.teams.filter((t) => t.league === 'EU').map((t) => t.id);
  state.clTeams = [...plTop, ...eu];

  state.season++;
  state.day = 0;
  state.offers = [];
  state.negotiations = {};
  setupFixtures(state);
  for (const t of state.teams) if (t.id !== state.userTeamId) setAutoLineup(state, t);
  repairLineup(state, user);
  // 伝説の再来：数年前に大活躍したレジェンドの「2世」
  const heir = heirsDue(state);
  if (heir) spawnHeir(state, heir);
  const inCl = state.clTeams.includes(user.id);
  if (inCl) state.money = round2(state.money + CL_STAGE_PRIZE.start);
  state.news.unshift({
    id: uid('n'),
    season: state.season,
    day: 0,
    kind: 'info',
    text: `シーズン${state.season - 1}終了：プレミアリーグ ${rank}位（優勝 ${champion}）。分配金 +${fmtYen(prize)}${inCl ? ` / 来季CL出場（+${fmtYen(CL_STAGE_PRIZE.start)}）` : ''}`,
  });
  state.updatedAt = Date.now();
  return summary;
}

function clResultLabel(state: GameState): string {
  const u = state.userTeamId;
  if (!state.clTeams.includes(u)) return '出場なし';
  const order: CLStage[] = ['F', 'SF', 'QF', 'R16', 'PO'];
  const fin = state.ties.find((t) => t.stage === 'F');
  if (fin?.winner === u) return '優勝';
  for (const s of order) {
    if (state.ties.some((t) => t.stage === s && (t.a === u || t.b === u))) return s === 'F' ? '決勝' : STAGE_LABEL[s];
  }
  return 'リーグフェーズ敗退';
}

/** 人数が最低ラインを割ったらユースから昇格 */
function promoteYouth(state: GameState): string[] {
  const names: string[] = [];
  let squad = squadOf(state, state.userTeamId);
  const user = teamById(state, state.userTeamId);
  while (squad.length < 18) {
    const p = generatePlayer({ position: neededPosition(squad), level: 52 + randInt(0, 8), age: randInt(17, 18), teamId: state.userTeamId, custom: user.original });
    p.contractYears = 3;
    p.academy = true;
    p.salary = fairSalary(p);
    const used = new Set(squad.map((x) => x.number));
    while (used.has(p.number)) p.number = randInt(2, 99);
    state.players[p.id] = p;
    names.push(p.name);
    squad = squadOf(state, state.userTeamId);
  }
  return names;
}

export function userPayroll(state: GameState): { total: number; cap: number } {
  const t = teamById(state, state.userTeamId);
  return { total: payroll(squadOf(state, t.id)), cap: wageCap(t) };
}
