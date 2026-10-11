import { generatePlayer } from './data';
import type { MatchResult } from './match';
import { simulateMatch } from './match';
import { autoLineup, fairSalary, FORMATIONS, overall, ratingAt } from './rating';
import { clamp, pick, rand, randInt, uid } from './rng';
import type { Fixture, GameState, Player, Position, StandingRow, StatKey } from './types';
import { STAT_KEYS } from './types';

/** 登録の最低人数（transfer.ts の MIN_SQUAD と同じ） */
export const MIN_SQUAD_SIZE = 16;

/** 総当たり（ホーム＆アウェー）の日程を作る */
export function makeSchedule(teamIds: string[]): Fixture[] {
  const ids = [...teamIds].sort(() => rand() - 0.5);
  if (ids.length % 2) ids.push('BYE');
  const n = ids.length;
  const fixtures: Fixture[] = [];
  const rounds = n - 1;
  const arr = [...ids];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === 'BYE' || b === 'BYE') continue;
      const flip = (r + i) % 2 === 0;
      fixtures.push({ round: r, home: flip ? a : b, away: flip ? b : a });
    }
    arr.splice(1, 0, arr.pop()!);
  }
  // 後半戦はホーム・アウェーを入れ替え
  const second = fixtures.map((f) => ({ round: f.round + rounds, home: f.away, away: f.home }));
  return [...fixtures, ...second];
}

export function totalRounds(state: GameState): number {
  return Math.max(...state.fixtures.map((f) => f.round)) + 1;
}

export function standings(state: GameState): StandingRow[] {
  const rows: Record<string, StandingRow> = {};
  for (const t of state.teams) rows[t.id] = { teamId: t.id, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0 };
  for (const f of state.fixtures) {
    if (!f.result) continue;
    const h = rows[f.home];
    const a = rows[f.away];
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.gf += f.result.home;
    h.ga += f.result.away;
    a.gf += f.result.away;
    a.ga += f.result.home;
    if (f.result.home > f.result.away) {
      h.win++;
      h.points += 3;
      a.loss++;
    } else if (f.result.home < f.result.away) {
      a.win++;
      a.points += 3;
      h.loss++;
    } else {
      h.draw++;
      a.draw++;
      h.points++;
      a.points++;
    }
  }
  return Object.values(rows).sort(
    (x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf,
  );
}

export function squadOf(state: GameState, teamId: string): Player[] {
  return Object.values(state.players).filter((p) => p.teamId === teamId);
}

export function userFixture(state: GameState): Fixture | undefined {
  return state.fixtures.find((f) => f.round === state.round && (f.home === state.userTeamId || f.away === state.userTeamId));
}

/** 試合1つ分の結果を状態へ反映（破壊的に更新） */
function applyResult(state: GameState, f: Fixture, res: MatchResult) {
  f.result = { home: res.home, away: res.away };
  for (const id of res.appeared) {
    const p = state.players[id];
    if (!p) continue;
    p.season.apps++;
    p.career.apps++;
    // 試合経験で少しずつ成長（若手ほど伸びやすい）
    if (p.age <= 28 && overall(p) < p.potential && rand() < (p.age <= 23 ? 0.35 : 0.15)) {
      bumpStats(p, 1);
    }
  }
  for (const e of res.events) {
    if (e.type !== 'goal') continue;
    const s = state.players[e.playerId!];
    if (s) {
      s.season.goals++;
      s.career.goals++;
    }
    const a = e.assistId ? state.players[e.assistId] : undefined;
    if (a) {
      a.season.assists++;
      a.career.assists++;
    }
  }
}

/** ポジションに関係する能力を中心に上げ下げする */
const KEY_STATS: Record<Position, StatKey[]> = {
  GK: ['keeper', 'physical'],
  CB: ['defense', 'physical', 'speed'],
  SB: ['defense', 'speed', 'stamina', 'pass'],
  DMF: ['defense', 'pass', 'stamina', 'physical'],
  CMF: ['pass', 'stamina', 'dribble', 'offense'],
  OMF: ['pass', 'dribble', 'offense', 'shoot'],
  WG: ['speed', 'dribble', 'offense', 'pass'],
  CF: ['shoot', 'offense', 'physical', 'dribble'],
};

export function bumpStats(p: Player, amount: number) {
  const keys = rand() < 0.7 ? KEY_STATS[p.position] : STAT_KEYS.filter((k) => k !== 'keeper' || p.position === 'GK');
  const k = pick(keys);
  p.stats[k] = clamp(p.stats[k] + amount, 30, 99);
}

/** 収入（ポイント）：勝利 1500 / 引分 800 / 敗戦 400 */
export function matchIncome(gf: number, ga: number): number {
  return gf > ga ? 1500 : gf === ga ? 800 : 400;
}

/**
 * 節を進める。ユーザーの試合結果（観戦済み）があれば使い、他は自動シミュレート。
 */
export function playRound(state: GameState, userResult?: MatchResult): { income: number } {
  let income = 0;
  for (const f of state.fixtures.filter((x) => x.round === state.round && !x.result)) {
    const isUser = f.home === state.userTeamId || f.away === state.userTeamId;
    const res = isUser && userResult ? userResult : simulateMatch(state, f.home, f.away);
    applyResult(state, f, res);
    if (isUser) {
      const home = f.home === state.userTeamId;
      const gf = home ? res.home : res.away;
      const ga = home ? res.away : res.home;
      income = matchIncome(gf, ga);
      state.points += income;
      const opp = state.teams.find((t) => t.id === (home ? f.away : f.home))!;
      const scorers = res.events
        .filter((e) => e.type === 'goal' && e.side === (home ? 'home' : 'away'))
        .map((e) => state.players[e.playerId!]?.name)
        .filter(Boolean);
      state.news.unshift({
        id: uid('n'),
        season: state.season,
        round: state.round,
        text: `第${state.round + 1}節 vs ${opp.name} ${gf}-${ga} ${gf > ga ? '勝利' : gf === ga ? '引き分け' : '敗戦'}` +
          (scorers.length ? `（得点：${scorers.join('、')}）` : '') + ` +${income}P`,
      });
    }
  }
  state.round++;
  state.updatedAt = Date.now();
  return { income };
}

export function isSeasonOver(state: GameState): boolean {
  return state.round >= totalRounds(state);
}

/** 成長カーブ：成長期と衰退開始年齢 */
const CURVE = {
  early: { growUntil: 24, declineFrom: 28 },
  normal: { growUntil: 27, declineFrom: 30 },
  late: { growUntil: 30, declineFrom: 32 },
};

export interface SeasonSummary {
  rank: number;
  champion: string;
  bonus: number;
  salaries: number;
  retired: string[];
  left: string[];
  promoted: string[];
  grown: { name: string; diff: number }[];
}

/** シーズン終了処理：順位ボーナス、年俸支払い、成長・衰退、引退、契約満了、新人補充、新日程 */
export function endSeason(state: GameState): SeasonSummary {
  const table = standings(state);
  const rank = table.findIndex((r) => r.teamId === state.userTeamId) + 1;
  const champion = state.teams.find((t) => t.id === table[0].teamId)!.name;
  const bonus = Math.max(0, 12000 - (rank - 1) * 1500);
  const userPlayers = squadOf(state, state.userTeamId);
  const salaries = userPlayers.reduce((s, p) => s + p.salary, 0);
  state.points += bonus - salaries;

  const summary: SeasonSummary = { rank, champion, bonus, salaries, retired: [], left: [], promoted: [], grown: [] };

  for (const p of Object.values(state.players)) {
    const before = overall(p);
    const curve = CURVE[p.growth];
    p.age++;
    if (p.age <= curve.growUntil && before < p.potential) {
      const playBoost = clamp(p.season.apps / 10, 0.3, 1.3);
      const steps = Math.round((p.potential - before) * 0.35 * playBoost + rand() * 2);
      for (let i = 0; i < steps * 2; i++) bumpStats(p, 1);
    } else if (p.age >= curve.declineFrom) {
      const steps = randInt(1, 3) + Math.max(0, p.age - curve.declineFrom);
      for (let i = 0; i < steps * 2; i++) bumpStats(p, -1);
      // 年齢とともにスピード・スタミナが落ちる
      p.stats.speed = clamp(p.stats.speed - randInt(0, 2), 30, 99);
      p.stats.stamina = clamp(p.stats.stamina - randInt(0, 2), 30, 99);
    }
    const after = overall(p);
    if (p.teamId === state.userTeamId && after !== before) summary.grown.push({ name: p.name, diff: after - before });

    p.season = { apps: 0, goals: 0, assists: 0 };

    // 引退
    if (p.age >= 34 && rand() < 0.25 + (p.age - 34) * 0.2) {
      if (p.teamId === state.userTeamId) summary.retired.push(p.name);
      delete state.players[p.id];
      continue;
    }

    // 契約
    if (p.teamId) {
      p.contractYears--;
      if (p.contractYears <= 0) {
        if (p.teamId === state.userTeamId) {
          summary.left.push(p.name);
          p.teamId = null;
          p.contractYears = 0;
        } else {
          p.contractYears = randInt(1, 3);
          p.salary = fairSalary(p);
        }
      }
    }
  }
  summary.grown.sort((a, b) => b.diff - a.diff);

  // 新人・ベテランをフリー市場に補充
  const positions: Position[] = ['GK', 'CB', 'CB', 'SB', 'DMF', 'CMF', 'CMF', 'OMF', 'WG', 'WG', 'CF', 'CF'];
  for (let i = 0; i < 16; i++) {
    const young = rand() < 0.6;
    const p = generatePlayer({
      position: pick(positions),
      level: young ? 44 + randInt(0, 10) : 50 + randInt(0, 14),
      age: young ? randInt(17, 19) : randInt(22, 32),
      teamId: null,
    });
    state.players[p.id] = p;
  }

  summary.promoted = promoteYouth(state);
  aiFillSquads(state);

  state.history.push({ season: state.season, rank, champion });
  state.season++;
  state.round = 0;
  state.fixtures = makeSchedule(state.teams.map((t) => t.id));
  state.news.unshift({
    id: uid('n'),
    season: state.season,
    round: 0,
    text: `シーズン${state.season - 1}終了：${rank}位（優勝 ${champion}）。順位ボーナス +${bonus}P / 年俸 -${salaries}P`,
  });
  state.updatedAt = Date.now();
  return summary;
}

/** CPUクラブの補強：人数が足りないクラブがフリー選手を獲得 */
export function aiFillSquads(state: GameState) {
  for (const t of state.teams) {
    if (t.id === state.userTeamId) continue;
    let squad = squadOf(state, t.id);
    while (squad.length < 22) {
      const need = neededPosition(squad);
      const free = Object.values(state.players)
        .filter((p) => !p.teamId && (p.position === need || rand() < 0.1))
        .sort((a, b) => overall(b) - overall(a));
      const sign = free[0] ?? generatePlayer({ position: need, level: 55, teamId: null });
      state.players[sign.id] = sign;
      sign.teamId = t.id;
      sign.contractYears = randInt(1, 3);
      sign.salary = fairSalary(sign);
      squad = squadOf(state, t.id);
    }
    t.lineup = autoLineup(squad, t.formation);
  }
  fixUserLineup(state);
}

function neededPosition(squad: Player[]): Position {
  const want: Record<Position, number> = { GK: 2, CB: 4, SB: 3, DMF: 2, CMF: 3, OMF: 2, WG: 3, CF: 3 };
  for (const p of squad) want[p.position]--;
  const sorted = (Object.keys(want) as Position[]).sort((a, b) => want[b] - want[a]);
  return sorted[0];
}

/** ユーザーのスタメンに居なくなった選手がいたら、その枠に合う控えで埋める */
export function fixUserLineup(state: GameState) {
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  const squad = squadOf(state, team.id);
  const ids = new Set(squad.map((p) => p.id));
  const slots = FORMATIONS[team.formation];
  const used = new Set<string>();
  const lineup = slots.map((_, i) => {
    const id = team.lineup[i];
    if (id && ids.has(id) && !used.has(id)) {
      used.add(id);
      return id;
    }
    return '';
  });
  slots.forEach((slot, i) => {
    if (lineup[i]) return;
    const best = squad
      .filter((p) => !used.has(p.id))
      .sort((a, b) => ratingAt(b, slot.pos) - ratingAt(a, slot.pos))[0];
    if (best) {
      used.add(best.id);
      lineup[i] = best.id;
    }
  });
  team.lineup = lineup.filter(Boolean);
}

/** 人数が最低ラインを割ったら、ユースから若手を昇格させる */
function promoteYouth(state: GameState): string[] {
  const names: string[] = [];
  let squad = squadOf(state, state.userTeamId);
  while (squad.length < MIN_SQUAD_SIZE) {
    const p = generatePlayer({ position: neededPosition(squad), level: 46 + randInt(0, 6), age: randInt(17, 18), teamId: state.userTeamId });
    p.contractYears = 3;
    p.salary = fairSalary(p);
    const usedNums = new Set(squad.map((x) => x.number));
    while (usedNums.has(p.number)) p.number = randInt(2, 99);
    state.players[p.id] = p;
    names.push(p.name);
    squad = squadOf(state, state.userTeamId);
  }
  return names;
}
