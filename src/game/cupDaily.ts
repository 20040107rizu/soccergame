import { ownerOf, playCupGame, weekId, type CupEntrant, type CupGame, type CupRow } from './cup';
import { parseSnapshot } from './friendly';
import type { RankingRow } from './ranking';

/* ======================= フレンドカップ（毎日1節・日曜に決勝） ======================= */

/**
 * 毎日の24時（日本時間）に、その日の試合の結果が出る。
 * - その日の24時の時点のチームで戦う。「cupd:端末ID:セーブ」の行に、その日のチームを保存する
 *   （slot = (週の偶奇)×7 + 曜日。2週間分を使い回すので、先週の分は今週いっぱい残る）。
 * - 週が終わったら、誰かの端末が結果を「cupres:」の行に保存する（8週間分）。
 *   なので、しばらく開かなくても先週の結果は消えない。
 * - 参加者は、その週で最初に誰かが登録された日に決まる（ふつうは月曜）。
 */
const DAY = 86400000;
const JST = 9 * 3600000;
const DPREFIX = 'cupd:';
const RPREFIX = 'cupres:';
/** 毎日形式が始まる週（2026年10月26日の週） */
export const DAILY_START = 2964;

/** その週の何日目か（0=月曜 … 6=日曜） */
export function dayIndex(now = Date.now()): number {
  const days = Math.floor((now + JST) / DAY);
  return days - 4 - weekId(now) * 7;
}

/** その週の d 日目が終わる時刻（その日の24時） */
export function dayEnd(w: number, d: number): number {
  return (w * 7 + 4 + d + 1) * DAY - JST;
}

const slotOf = (w: number, d: number) => (w % 2) * 7 + d;

/** 親善試合に要らない情報（監督の実績など）を外して、行を軽くする */
function slim(team?: string): string {
  try {
    const t = JSON.parse(team || '');
    delete t.prof;
    delete t.mgr;
    return JSON.stringify(t);
  } catch {
    return team ?? '';
  }
}

/** 今日のチームとして登録する行 */
export function dailyRowFrom(row: RankingRow, w = weekId(), d = dayIndex()): RankingRow {
  return { ...row, playerId: `${DPREFIX}${row.playerId}:${row.slot}`, slot: slotOf(w, d), season: w, team: slim(row.team) };
}

function dailyRowsOf(rows: RankingRow[], w: number, d: number): Map<string, RankingRow> {
  const out = new Map<string, RankingRow>();
  for (const r of rows) {
    if (!String(r.playerId).startsWith(DPREFIX) || Number(r.season) !== w || Number(r.slot) !== slotOf(w, d)) continue;
    if (!parseSnapshot(r.team)) continue;
    const k = ownerOf(r);
    const cur = out.get(k);
    if (!cur || String(r.updatedAt ?? '') > String(cur.updatedAt ?? '')) out.set(k, r);
  }
  return out;
}

/**
 * 全員参加：今日まだ登録されていない人を、その人の最新のチームで登録する（誰の端末からでも）。
 * 本人が遊べば本人の端末が上書きするので、その日の24時の時点のチームが残る。
 */
export function missingDailyRows(rows: RankingRow[], now = Date.now()): RankingRow[] {
  const w = weekId(now);
  const d = dayIndex(now);
  const today = dailyRowsOf(rows, w, d);
  const latest = new Map<string, RankingRow>();
  for (const r of rows) {
    if (/^cup/.test(String(r.playerId)) || !parseSnapshot(r.team)) continue;
    const cur = latest.get(r.playerId);
    if (!cur || String(r.updatedAt ?? '') > String(cur.updatedAt ?? '')) latest.set(r.playerId, r);
  }
  return [...latest.values()].filter((r) => !today.has(r.playerId)).map((r) => dailyRowFrom(r, w, d));
}

/* ---------------- 日程 ---------------- */

/** 総当たりの組み合わせ（サークル方式）。人数が奇数なら毎節1人お休み */
export function roundRobin(keys: string[]): [string, string][][] {
  const ks = [...keys];
  if (ks.length % 2) ks.push('');
  const n = ks.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const games: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ks[i];
      const b = ks[n - 1 - i];
      if (a && b) games.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(games);
    ks.splice(1, 0, ks.pop()!);
  }
  return rounds;
}

export interface DailyDay {
  d: number;
  games: CupGame[];
  final?: boolean;
  /** 結果が出ているか */
  done: boolean;
}

export interface DailyCup {
  week: number;
  entrants: CupEntrant[];
  startDay: number;
  days: DailyDay[];
  table: CupRow[];
  final?: CupGame;
  champion?: string;
  /** 全試合が終わった */
  complete: boolean;
}

/** その日のチーム（その日に登録が無ければ、前の日のチーム） */
function teamOn(rows: RankingRow[], w: number, d: number, key: string, start: number): CupEntrant | null {
  for (let x = d; x >= start; x--) {
    const r = dailyRowsOf(rows, w, x).get(key);
    if (r) return { key, nickname: String(r.nickname), club: String(r.club), snap: parseSnapshot(r.team)! };
  }
  return null;
}

function emptyRow(key: string): CupRow {
  return { key, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0 };
}

function sortTable(t: CupRow[]): CupRow[] {
  return t.sort((x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || (x.key < y.key ? -1 : 1));
}

/**
 * その週の大会を、結果が出ている日まで計算する（誰の端末でも同じ結果）。
 * 日程は、参加者が決まった日から土曜までに総当たりを割り振り、日曜に上位2人で決勝。
 */
export function runDailyCup(rows: RankingRow[], w: number, now = Date.now()): DailyCup | null {
  let start = -1;
  for (let d = 0; d < 7; d++) {
    if (dailyRowsOf(rows, w, d).size) {
      start = d;
      break;
    }
  }
  if (start < 0 || now < dayEnd(w, start) - DAY) return null;
  const keys = [...dailyRowsOf(rows, w, start).keys()].sort();
  const entrants = keys.map((k) => teamOn(rows, w, start, k, start)!);
  const rounds = keys.length >= 2 ? roundRobin(keys) : [];
  // 総当たりは土曜まで（日曜しか無ければ日曜にまとめて）
  const leagueDays = Math.max(1, 6 - start);
  const perDay = Math.max(1, Math.ceil(rounds.length / leagueDays));
  const days: DailyDay[] = [];
  const tbl = new Map(keys.map((k) => [k, emptyRow(k)]));
  for (let i = 0; i < rounds.length; i += perDay) {
    const d = Math.min(6, start + i / perDay);
    const done = now >= dayEnd(w, d);
    const games: CupGame[] = [];
    for (const [ka, kb] of rounds.slice(i, i + perDay).flat()) {
      if (!done) {
        games.push({ a: ka, b: kb, ga: -1, gb: -1, goals: [] });
        continue;
      }
      const a = teamOn(rows, w, d, ka, start)!;
      const b = teamOn(rows, w, d, kb, start)!;
      const g = playCupGame(a, b, `${w}:${d}:${ka}:${kb}`);
      games.push(g);
      const ra = tbl.get(ka)!;
      const rb = tbl.get(kb)!;
      ra.played++;
      rb.played++;
      ra.gf += g.ga;
      ra.ga += g.gb;
      rb.gf += g.gb;
      rb.ga += g.ga;
      if (g.ga > g.gb) (ra.win++, rb.loss++, (ra.points += 3));
      else if (g.ga < g.gb) (rb.win++, ra.loss++, (rb.points += 3));
      else (ra.draw++, rb.draw++, ra.points++, rb.points++);
    }
    days.push({ d, games, done });
  }
  const table = sortTable([...tbl.values()]);
  const res: DailyCup = { week: w, entrants, startDay: start, days, table, complete: false };
  const leagueDone = days.every((x) => x.done);
  if (keys.length === 1) {
    res.champion = keys[0];
    res.complete = now >= dayEnd(w, 6);
  } else if (keys.length >= 2) {
    const fdone = now >= dayEnd(w, 6);
    const [k1, k2] = [table[0].key, table[1].key];
    if (fdone && leagueDone) {
      const f = playCupGame(teamOn(rows, w, 6, k1, start)!, teamOn(rows, w, 6, k2, start)!, `${w}:final`, true);
      res.final = f;
      res.champion = f.ga > f.gb || (f.ga === f.gb && f.pk && f.pk[0] > f.pk[1]) ? f.a : f.b;
      res.complete = true;
      days.push({ d: 6, games: [f], final: true, done: true });
    } else {
      days.push({ d: 6, games: [{ a: k1, b: k2, ga: -1, gb: -1, goals: [] }], final: true, done: false });
    }
  }
  return res;
}

/* ---------------- 終わった大会の保存（消えないように） ---------------- */

/** 終わった大会の結果を保存する行（8週間分を使い回す） */
export function archiveRow(res: DailyCup): RankingRow {
  return {
    playerId: `${RPREFIX}${res.week % 8}`,
    slot: 0,
    nickname: '',
    club: '',
    season: res.week,
    progress: '',
    plRank: 0,
    played: 0,
    win: 0,
    draw: 0,
    loss: 0,
    points: 0,
    gf: 0,
    ga: 0,
    money: 0,
    spirit: 0,
    topPlayer: '',
    achievements: 0,
    clResult: '',
    titles: 0,
    clTitles: 0,
    version: '',
    team: JSON.stringify({ ...res, entrants: res.entrants.map((e) => ({ key: e.key, nickname: e.nickname, club: e.club })) }),
  };
}

/** 保存してある大会の結果 */
export function archived(rows: RankingRow[], w: number): DailyCup | null {
  const r = rows.find((x) => String(x.playerId) === `${RPREFIX}${w % 8}` && Number(x.season) === w);
  if (!r) return null;
  try {
    return JSON.parse(String(r.team)) as DailyCup;
  } catch {
    return null;
  }
}

const CACHE = 'masterleague.cupCache';

/** 端末にも覚えておく（念のため） */
export function cacheCup(res: DailyCup) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) || '{}');
    all[res.week] = { ...res, entrants: res.entrants.map((e) => ({ key: e.key, nickname: e.nickname, club: e.club })) };
    for (const k of Object.keys(all)) if (Number(k) < res.week - 8) delete all[k];
    localStorage.setItem(CACHE, JSON.stringify(all));
  } catch {
    // 容量不足など
  }
}

export function cachedCup(w: number): DailyCup | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || '{}')[w] ?? null;
  } catch {
    return null;
  }
}

/** 先週（終わった大会）の結果：保存 → 端末 → その場で計算 の順に探す */
export function finishedCup(rows: RankingRow[], w: number, now = Date.now()): { res: DailyCup | null; needArchive: boolean } {
  const a = archived(rows, w);
  if (a) return { res: a, needArchive: false };
  const c = cachedCup(w);
  if (c?.complete) return { res: c, needArchive: true };
  const r = runDailyCup(rows, w, now);
  return { res: r?.complete ? r : null, needArchive: !!r?.complete };
}
