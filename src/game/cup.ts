import { createMatch, simulateToEnd } from './engine';
import { parseSnapshot, snapshotTeam, type TeamSnapshot } from './friendly';
import { FORMATIONS } from './positions';
import type { RankingRow } from './ranking';
import type { GameState, Player, Team } from './types';

/* ======================= フレンドカップ（毎週・日曜24時締め） ======================= */

/**
 * ランキングのシートに「cup:端末ID:スロット」という行で、その週のチームを保存する。
 * slot には週番号の偶奇（0/1）を入れて、1人あたり2行（今週・先週）だけを使い回す。season には週番号を入れる。
 * 締め切り（日本時間の月曜0時）を過ぎた週の行は誰も書き換えないので、全員が同じチームで同じ結果を見られる。
 */
export const CUP_PREFIX = 'cup:';
const DAY = 86400000;
const JST = 9 * 3600000;

/** 日本時間の月曜0時で区切った週番号 */
export function weekId(now = Date.now()): number {
  const days = Math.floor((now + JST) / DAY);
  // 1970-01-05 が月曜（4日目）
  return Math.floor((days - 4) / 7);
}

/** その週の締め切り（次の月曜0時＝日曜24時、日本時間） */
export function weekDeadline(w: number): number {
  return ((w + 1) * 7 + 4) * DAY - JST;
}

/** フレンドカップ用の行（ランキングには出さない）。cup: 週1回の頃の登録 / cupd: 毎日の登録 / cupres: 結果の保存 */
export function isCupRow(r: RankingRow): boolean {
  return /^cup(d|res)?:/.test(String(r.playerId));
}

function isWeeklyRow(r: RankingRow): boolean {
  return String(r.playerId).startsWith(CUP_PREFIX);
}

/** cup 行の持ち主（端末ID） */
export function ownerOf(r: RankingRow): string {
  return String(r.playerId).split(':')[1] ?? '';
}

/** 自分のチームを今週のフレンドカップに登録する行 */
export function cupRowFrom(row: RankingRow, w = weekId()): RankingRow {
  return { ...row, playerId: `${CUP_PREFIX}${row.playerId}:${row.slot}`, slot: w % 2, season: w };
}

export interface CupEntrant {
  /** 端末ID（1人1チーム） */
  key: string;
  nickname: string;
  club: string;
  snap: TeamSnapshot;
}

/** その週の出場チーム（1人1チーム。複数のセーブで遊んでいる人は最後に遊んだチーム） */
export function cupEntrants(rows: RankingRow[], w: number): CupEntrant[] {
  const best = new Map<string, RankingRow>();
  for (const r of rows) {
    if (!isWeeklyRow(r) || Number(r.season) !== w || Number(r.slot) !== w % 2) continue;
    if (!parseSnapshot(r.team)) continue;
    const k = ownerOf(r);
    const cur = best.get(k);
    if (!cur || String(r.updatedAt ?? '') > String(cur.updatedAt ?? '')) best.set(k, r);
  }
  return [...best.entries()]
    .map(([key, r]) => ({ key, nickname: String(r.nickname), club: String(r.club), snap: parseSnapshot(r.team)! }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * 全員参加：今週まだ登録されていない人は、その人の最新のチームで登録しておく（誰の端末からでも行う）。
 * 本人が遊べば本人の端末が上書きするので、締め切り時点の最新のチームが残る。
 */
export function missingCupRows(rows: RankingRow[], w = weekId()): RankingRow[] {
  const entered = new Set(rows.filter((r) => isWeeklyRow(r) && Number(r.season) === w && Number(r.slot) === w % 2).map(ownerOf));
  const latest = new Map<string, RankingRow>();
  for (const r of rows) {
    if (isCupRow(r) || !parseSnapshot(r.team)) continue;
    const cur = latest.get(r.playerId);
    if (!cur || String(r.updatedAt ?? '') > String(cur.updatedAt ?? '')) latest.set(r.playerId, r);
  }
  return [...latest.values()].filter((r) => !entered.has(r.playerId)).map((r) => cupRowFrom(r, w));
}

/* ---------------- 試合（誰の端末でも同じ結果になるように、乱数を固定する） ---------------- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 乱数を固定して fn を実行する */
export function withSeed<T>(seed: string, fn: () => T): T {
  const orig = Math.random;
  Math.random = seeded(hash(seed));
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

const BASE: Team = {
  id: 'base',
  name: '',
  en: '',
  short: '',
  color: '#fff',
  color2: '#000',
  rep: 80,
  country: '',
  league: 'PL',
  formation: '4-3-3',
  tactic: 'balance',
  lineup: [],
  slots: FORMATIONS['4-3-3'],
  spirit: 80,
  bench: [],
  budget: 0,
};

/** 2チームだけの試合用の状態（誰のセーブにも関係しない） */
function neutralState(a: CupEntrant, b: CupEntrant): GameState {
  const players: Record<string, Player> = {};
  const teams: Team[] = [];
  for (const [side, e] of [['A', a], ['B', b]] as const) {
    const built = snapshotTeam(e.snap, BASE, '');
    const ren = (id: string) => `${side}_${id}`;
    for (const p of Object.values(built.players)) players[ren(p.id)] = { ...p, id: ren(p.id), teamId: side };
    teams.push({ ...built.team, id: side, name: e.snap.name, lineup: built.team.lineup.map(ren), bench: built.team.bench.map(ren) });
  }
  return {
    version: 3,
    createdAt: 0,
    updatedAt: 0,
    managerName: '',
    userTeamId: '__none__',
    season: 1,
    day: 0,
    calendar: [],
    money: 0,
    teams,
    players,
    fixtures: [{ id: 'cup', comp: 'PL', day: 0, home: 'A', away: 'B' }],
    clTeams: [],
    ties: [],
    offers: [],
    negotiations: {},
    news: [],
    mails: [],
    watchlist: [],
    flags: {},
    history: [],
  };
}

export interface CupGame {
  a: string;
  b: string;
  ga: number;
  gb: number;
  /** PK 戦（決勝で引き分けの時） */
  pk?: [number, number];
  goals: { side: 'a' | 'b'; name: string; minute: number }[];
}

export function playCupGame(a: CupEntrant, b: CupEntrant, seed: string, final = false): CupGame {
  return withSeed(seed, () => {
    const st = neutralState(a, b);
    const m = createMatch(st, 'cup');
    simulateToEnd(st, m);
    const goals = m.events
      .filter((e) => e.type === 'goal')
      .map((e) => ({ side: (e.side === 'home' ? 'a' : 'b') as 'a' | 'b', name: st.players[e.playerId!]?.name ?? '', minute: e.minute }));
    const g: CupGame = { a: a.key, b: b.key, ga: m.score.home, gb: m.score.away, goals };
    if (final && g.ga === g.gb) {
      let pa = 3 + Math.floor(Math.random() * 3);
      let pb = 3 + Math.floor(Math.random() * 3);
      if (pa === pb) Math.random() < 0.5 ? pa++ : pb++;
      g.pk = [pa, pb];
    }
    return g;
  });
}

export interface CupRow {
  key: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  points: number;
}

export interface CupResult {
  week: number;
  entrants: CupEntrant[];
  games: CupGame[];
  table: CupRow[];
  final?: CupGame;
  champion?: string;
}

/** 総当たり（1試合ずつ）→ 上位2チームで決勝 */
export function runCup(entrants: CupEntrant[], w: number): CupResult {
  const es = [...entrants].sort((x, y) => (x.key < y.key ? -1 : 1));
  const games: CupGame[] = [];
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      // ホームは交互に
      const [h, a] = (i + j) % 2 ? [es[i], es[j]] : [es[j], es[i]];
      games.push(playCupGame(h, a, `${w}:${h.key}:${a.key}`));
    }
  const tbl = new Map<string, CupRow>(es.map((e) => [e.key, { key: e.key, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0 }]));
  for (const g of games) {
    const a = tbl.get(g.a)!;
    const b = tbl.get(g.b)!;
    a.played++;
    b.played++;
    a.gf += g.ga;
    a.ga += g.gb;
    b.gf += g.gb;
    b.ga += g.ga;
    if (g.ga > g.gb) (a.win++, b.loss++, (a.points += 3));
    else if (g.ga < g.gb) (b.win++, a.loss++, (b.points += 3));
    else (a.draw++, b.draw++, a.points++, b.points++);
  }
  const table = [...tbl.values()].sort((x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || (x.key < y.key ? -1 : 1));
  const res: CupResult = { week: w, entrants: es, games, table };
  if (es.length === 1) res.champion = es[0].key;
  if (table.length >= 2) {
    const e1 = es.find((e) => e.key === table[0].key)!;
    const e2 = es.find((e) => e.key === table[1].key)!;
    const f = playCupGame(e1, e2, `${w}:final`, true);
    res.final = f;
    res.champion = f.ga > f.gb || (f.ga === f.gb && f.pk && f.pk[0] > f.pk[1]) ? f.a : f.b;
  }
  return res;
}

/* ---------------- 優勝の記録（この端末のセーブスロットごと） ---------------- */

const WINS_KEY = 'masterleague.cupWins';

export function cupWins(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(WINS_KEY) || '{}');
  } catch {
    return {};
  }
}

/** 自分が優勝していたら記録する（同じ週は1回だけ） */
export function recordCupWin(res: Pick<CupResult, 'week' | 'champion'>, me: string): boolean {
  if (res.champion !== me) return false;
  try {
    const all = cupWins();
    const list = all.me ?? [];
    if (list.includes(res.week)) return false;
    all.me = [...list, res.week];
    localStorage.setItem(WINS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/** この端末での優勝回数 */
export function myCupWinCount(): number {
  return (cupWins().me ?? []).length;
}

/* ---------------- 賞金（少しだけ。1週につき1回、その時に開いているセーブに入る） ---------------- */

/** 順位ごとの賞金（百万ユーロ）：優勝・準優勝・3位 */
export const CUP_PRIZE = [30, 15, 8];
/** 特別な週の賞金の倍率（週番号 → 倍率） */
const PRIZE_BOOST: Record<number, number> = {
  // 2026年10月26日〜11月1日の大会（毎日形式の第1回）は賞金100倍
  2964: 100,
};

/** その週の賞金（優勝・準優勝・3位） */
export function cupPrizes(week: number): number[] {
  const k = PRIZE_BOOST[week] ?? 1;
  return CUP_PRIZE.map((x) => x * k);
}
const PAID_KEY = 'masterleague.cupPaid';

/** 自分の順位（1始まり。決勝の結果で1・2位を決める） */
export function cupPlace(res: Pick<CupResult, 'champion' | 'final' | 'table'>, me: string): number {
  if (res.champion === me) return 1;
  if (res.final && (res.final.a === me || res.final.b === me)) return 2;
  const i = res.table.findIndex((r) => r.key === me);
  return i < 0 ? 0 : i + 1;
}

/** まだ受け取っていなければ賞金額を返し、受け取り済みにする */
export function claimCupPrize(res: Pick<CupResult, 'week' | 'champion' | 'final' | 'table'>, me: string): number {
  const place = cupPlace(res, me);
  const prize = cupPrizes(res.week)[place - 1] ?? 0;
  if (!prize) return 0;
  try {
    const paid: number[] = JSON.parse(localStorage.getItem(PAID_KEY) || '[]');
    if (paid.includes(res.week)) return 0;
    localStorage.setItem(PAID_KEY, JSON.stringify([...paid, res.week]));
    return prize;
  } catch {
    return 0;
  }
}
