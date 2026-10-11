import { rand, uid } from './rng';
import type { CalendarDay, CLStage, Fixture, GameState, Team, Tie } from './types';

/**
 * 1シーズンのカレンダー。PL 38 節の間に CL を挟む（実際の日程をおおまかに再現）。
 * CL 日程は「この PL 節の後」に入る。
 */
const CL_AFTER: { after: number; stage: CLStage; round: number; leg?: 1 | 2; label: string }[] = [
  { after: 3, stage: 'LP', round: 0, label: 'CL リーグフェーズ 第1節' },
  { after: 5, stage: 'LP', round: 1, label: 'CL リーグフェーズ 第2節' },
  { after: 8, stage: 'LP', round: 2, label: 'CL リーグフェーズ 第3節' },
  { after: 11, stage: 'LP', round: 3, label: 'CL リーグフェーズ 第4節' },
  { after: 13, stage: 'LP', round: 4, label: 'CL リーグフェーズ 第5節' },
  { after: 15, stage: 'LP', round: 5, label: 'CL リーグフェーズ 第6節' },
  { after: 20, stage: 'LP', round: 6, label: 'CL リーグフェーズ 第7節' },
  { after: 21, stage: 'LP', round: 7, label: 'CL リーグフェーズ 第8節' },
  { after: 24, stage: 'PO', round: 0, leg: 1, label: 'CL 決勝T プレーオフ 1st' },
  { after: 25, stage: 'PO', round: 0, leg: 2, label: 'CL 決勝T プレーオフ 2nd' },
  { after: 27, stage: 'R16', round: 0, leg: 1, label: 'CL ラウンド16 1st' },
  { after: 28, stage: 'R16', round: 0, leg: 2, label: 'CL ラウンド16 2nd' },
  { after: 30, stage: 'QF', round: 0, leg: 1, label: 'CL 準々決勝 1st' },
  { after: 31, stage: 'QF', round: 0, leg: 2, label: 'CL 準々決勝 2nd' },
  { after: 33, stage: 'SF', round: 0, leg: 1, label: 'CL 準決勝 1st' },
  { after: 34, stage: 'SF', round: 0, leg: 2, label: 'CL 準決勝 2nd' },
  { after: 37, stage: 'F', round: 0, label: 'CL 決勝' },
];

export const STAGE_LABEL: Record<CLStage, string> = {
  LP: 'リーグフェーズ',
  PO: 'プレーオフ',
  R16: 'ラウンド16',
  QF: '準々決勝',
  SF: '準決勝',
  F: '決勝',
};

export function buildCalendar(): CalendarDay[] {
  const days: CalendarDay[] = [];
  for (let r = 0; r < 38; r++) {
    days.push({ type: 'PL', round: r, label: `プレミアリーグ 第${r + 1}節` });
    for (const c of CL_AFTER.filter((x) => x.after === r)) {
      days.push({ type: 'CL', round: c.round, stage: c.stage, leg: c.leg, label: c.label });
    }
  }
  return days;
}

/** 移籍市場が開いているか（夏：第4節の前まで / 冬：第20〜23節の前） */
export function windowStatus(state: GameState): { open: boolean; label: string; remaining: number } {
  const next = state.calendar[state.day];
  if (!next) return { open: true, label: 'シーズンオフ', remaining: 0 };
  const plRound = nextPlRound(state);
  if (plRound <= 3) return { open: true, label: '夏の移籍市場', remaining: 4 - plRound };
  if (plRound >= 19 && plRound <= 22) return { open: true, label: '冬の移籍市場', remaining: 23 - plRound };
  return { open: false, label: plRound < 19 ? '冬（第20節前後）に開きます' : '夏（シーズン終了後）に開きます', remaining: 0 };
}

function nextPlRound(state: GameState): number {
  for (let d = state.day; d < state.calendar.length; d++) {
    if (state.calendar[d].type === 'PL') return state.calendar[d].round;
  }
  return 38;
}

/* ---------------- 総当たり ---------------- */

function roundRobin(ids: string[]): [string, string][][] {
  const arr = [...ids];
  if (arr.length % 2) arr.push('BYE');
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const games: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === 'BYE' || b === 'BYE') continue;
      games.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

/** プレミアリーグ 38 節の日程 */
export function plFixtures(teamIds: string[], calendar: CalendarDay[]): Fixture[] {
  const ids = [...teamIds].sort(() => rand() - 0.5);
  const first = roundRobin(ids);
  const rounds = [...first, ...first.map((g) => g.map(([h, a]) => [a, h] as [string, string]))];
  const fixtures: Fixture[] = [];
  rounds.forEach((games, r) => {
    const day = calendar.findIndex((d) => d.type === 'PL' && d.round === r);
    for (const [home, away] of games) fixtures.push({ id: uid('f'), comp: 'PL', day, home, away });
  });
  return fixtures;
}

/**
 * CL リーグフェーズの組み合わせ（各クラブ 8 試合・1 日 1 試合）。
 * 総当たり表から 8 ラウンドを選び、同じ国同士がなるべく当たらないものを採用する。
 */
export function clLeagueFixtures(clTeams: string[], teams: Team[], calendar: CalendarDay[]): Fixture[] {
  const country = Object.fromEntries(teams.map((t) => [t.id, t.country]));
  const rounds = roundRobin([...clTeams].sort(() => rand() - 0.5));
  const scored = rounds.map((g) => ({ g, same: g.filter(([a, b]) => country[a] === country[b]).length }));
  scored.sort((a, b) => a.same - b.same || rand() - 0.5);
  const chosen = scored.slice(0, 8).map((x) => x.g);
  const homeCount: Record<string, number> = {};
  const fixtures: Fixture[] = [];
  chosen.forEach((games, r) => {
    const day = calendar.findIndex((d) => d.type === 'CL' && d.stage === 'LP' && d.round === r);
    for (const [a, b] of games) {
      const ha = homeCount[a] ?? 0;
      const hb = homeCount[b] ?? 0;
      const [home, away] = ha <= hb ? [a, b] : [b, a];
      homeCount[home] = (homeCount[home] ?? 0) + 1;
      fixtures.push({ id: uid('f'), comp: 'CL', stage: 'LP', day, home, away });
    }
  });
  return fixtures;
}

/* ---------------- 順位表 ---------------- */

export interface TableRow {
  teamId: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  points: number;
}

export function table(teamIds: string[], fixtures: Fixture[]): TableRow[] {
  const rows: Record<string, TableRow> = {};
  for (const id of teamIds) rows[id] = { teamId: id, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0 };
  for (const f of fixtures) {
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
  return Object.values(rows).sort((x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);
}

export function plTable(state: GameState): TableRow[] {
  return table(
    state.teams.filter((t) => t.league === 'PL').map((t) => t.id),
    state.fixtures.filter((f) => f.comp === 'PL'),
  );
}

export function clLeagueTable(state: GameState): TableRow[] {
  return table(state.clTeams, state.fixtures.filter((f) => f.comp === 'CL' && f.stage === 'LP'));
}

/* ---------------- ノックアウト ---------------- */

const NEXT: Partial<Record<CLStage, CLStage>> = { LP: 'PO', PO: 'R16', R16: 'QF', QF: 'SF', SF: 'F' };

function dayOf(calendar: CalendarDay[], stage: CLStage, leg?: 1 | 2): number {
  return calendar.findIndex((d) => d.type === 'CL' && d.stage === stage && (leg === undefined || d.leg === leg));
}

function makeTie(state: GameState, stage: CLStage, a: string, b: string): Tie {
  const tie: Tie = { id: uid('t'), stage, a, b };
  state.ties.push(tie);
  if (stage === 'F') {
    state.fixtures.push({ id: uid('f'), comp: 'CL', stage, tieId: tie.id, day: dayOf(state.calendar, 'F'), home: a, away: b });
  } else {
    // 1st は下位シード（b）のホーム、2nd は上位シード（a）のホーム
    state.fixtures.push({ id: uid('f'), comp: 'CL', stage, tieId: tie.id, leg: 1, day: dayOf(state.calendar, stage, 1), home: b, away: a });
    state.fixtures.push({ id: uid('f'), comp: 'CL', stage, tieId: tie.id, leg: 2, day: dayOf(state.calendar, stage, 2), home: a, away: b });
  }
  return tie;
}

/** ステージ終了時に次のラウンドの組み合わせを作る */
export function advanceCL(state: GameState, finished: CLStage): CLStage | null {
  const next = NEXT[finished];
  if (!next) return null;
  if (finished === 'LP') {
    const t = clLeagueTable(state).map((r) => r.teamId);
    // 9〜24 位でプレーオフ（9 vs 24, 10 vs 23, …）
    for (let i = 0; i < 8; i++) makeTie(state, 'PO', t[8 + i], t[23 - i]);
    return 'PO';
  }
  const ties = state.ties.filter((x) => x.stage === finished);
  const winners = ties.map((x) => x.winner!);
  if (finished === 'PO') {
    const top = clLeagueTable(state).map((r) => r.teamId).slice(0, 8);
    // 1位 vs 16/17位の勝者 …（プレーオフは 9vs24 が先頭なので逆順に当てる）
    for (let i = 0; i < 8; i++) makeTie(state, 'R16', top[i], winners[7 - i]);
    return 'R16';
  }
  for (let i = 0; i < winners.length; i += 2) makeTie(state, next, winners[i], winners[i + 1]);
  return next;
}

/** 2 戦合計（決勝は 1 試合）の勝者を決める */
export function resolveTie(state: GameState, tie: Tie, strength: (teamId: string) => number) {
  const fs = state.fixtures.filter((f) => f.tieId === tie.id);
  if (fs.some((f) => !f.result)) return;
  let ga = 0;
  let gb = 0;
  for (const f of fs) {
    if (f.home === tie.a) {
      ga += f.result!.home;
      gb += f.result!.away;
    } else {
      gb += f.result!.home;
      ga += f.result!.away;
    }
  }
  if (ga !== gb) {
    tie.winner = ga > gb ? tie.a : tie.b;
    return;
  }
  // PK 戦
  const last = fs[fs.length - 1];
  const sa = strength(tie.a);
  const sb = strength(tie.b);
  const pa = 3 + Math.round(rand() * 2 + (sa - sb) / 40);
  let pb = 3 + Math.round(rand() * 2 + (sb - sa) / 40);
  if (pa === pb) pb += rand() < 0.5 ? 1 : -1;
  const homeIsA = last.home === tie.a;
  last.result = { ...last.result!, pkHome: homeIsA ? pa : pb, pkAway: homeIsA ? pb : pa };
  tie.winner = pa > pb ? tie.a : tie.b;
}

export function stageComplete(state: GameState, stage: CLStage): boolean {
  const fs = state.fixtures.filter((f) => f.comp === 'CL' && f.stage === stage);
  return fs.length > 0 && fs.every((f) => f.result);
}
