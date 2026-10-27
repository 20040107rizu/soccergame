import { describe, expect, it } from 'vitest';
import { cupEntrants, cupRowFrom, isCupRow, missingCupRows, runCup, weekDeadline, weekId } from '../cup';
import { rankingSummary, type RankingRow } from '../ranking';
import { newGame } from '../season';

function rowFor(team: string, pid: string, slot = 1, at = '2026-10-20T00:00:00Z'): RankingRow {
  const s = newGame(pid, team);
  return { ...rankingSummary(s, slot), playerId: pid, nickname: pid, updatedAt: at };
}

describe('フレンドカップ', () => {
  it('週は日本時間の月曜0時で切り替わる（日曜24時締め）', () => {
    const sunNight = Date.parse('2026-10-25T23:59:00+09:00');
    const monMorning = Date.parse('2026-10-26T00:00:00+09:00');
    expect(weekId(monMorning)).toBe(weekId(sunNight) + 1);
    expect(weekDeadline(weekId(sunNight))).toBe(monMorning);
  });

  it('全員参加：登録の無い人は最新のチームで登録される。1人1チーム', () => {
    const w = 3000;
    const a = rowFor('ars', 'aaa');
    const b = rowFor('liv', 'bbb');
    const b2 = rowFor('mci', 'bbb', 2, '2026-10-21T00:00:00Z');
    const rows = [a, b, b2, cupRowFrom(a, w)];
    const add = missingCupRows(rows, w);
    expect(add.map((r) => r.playerId)).toEqual(['cup:bbb:2']);
    expect(add.every(isCupRow)).toBe(true);
    const es = cupEntrants([...rows, ...add], w);
    expect(es.map((e) => e.key)).toEqual(['aaa', 'bbb']);
    expect(es[1].club).toBe('マンチェスター・シティ');
    // 違う週の行は使わない
    expect(cupEntrants([...rows, ...add], w + 1)).toEqual([]);
  });

  it('誰の端末でも同じ結果になる（総当たり＋決勝）', () => {
    const w = 3000;
    const rows = ['ars', 'liv', 'mci', 'che'].map((t, i) => cupRowFrom(rowFor(t, 'p' + i), w));
    const es = cupEntrants(rows, w);
    const t0 = Date.now();
    const r1 = runCup(es, w);
    const ms = Date.now() - t0;
    const r2 = runCup(es, w);
    console.log('cup 4 teams ms', ms, r1.table.map((x) => `${x.key}:${x.points}`).join(' '), r1.final);
    expect(r1.games.length).toBe(6);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    expect(r1.champion).toBeTruthy();
    expect([r1.table[0].key, r1.table[1].key]).toContain(r1.champion);
  });
});

describe('フレンドカップの賞金', () => {
  it('上位3人に少しだけ。同じ週は1回だけ', async () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Partial<Storage> }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const { claimCupPrize, CUP_PRIZE, cupPlace } = await import('../cup');
    const res = { week: 1, entrants: [], games: [], table: [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }], final: { a: 'a', b: 'b', ga: 0, gb: 1, goals: [] }, champion: 'b' } as never;
    expect(cupPlace(res, 'b')).toBe(1);
    expect(cupPlace(res, 'a')).toBe(2);
    expect(cupPlace(res, 'c')).toBe(3);
    expect(claimCupPrize(res, 'b')).toBe(CUP_PRIZE[0]);
    expect(claimCupPrize(res, 'b')).toBe(0);
    expect(claimCupPrize(res, 'd')).toBe(0);
  });
});

describe('フレンドカップ（毎日1節）', () => {
  it('毎日の結果が出て、日曜24時の決勝で優勝が決まる。結果は保存して消えない', async () => {
    const d = await import('../cupDaily');
    const w = d.DAILY_START;
    const at = (day: number, h = 12) => d.dayEnd(w, day) - (24 - h) * 3600000;
    const people = ['ars', 'liv', 'mci', 'che', 'tot'].map((t, i) => rowFor(t, 'p' + i));
    // 月曜：全員が登録（4人は本人、1人は他の人の端末から自動で）
    let rows: RankingRow[] = [...people, ...people.slice(0, 4).map((r) => d.dailyRowFrom(r, w, 0))];
    rows = [...rows, ...d.missingDailyRows(rows, at(0))];
    expect(rows.filter(isCupRow).length).toBe(5);
    // 月曜の昼：まだ結果は出ていない
    const mon = d.runDailyCup(rows, w, at(0))!;
    expect(mon.entrants.length).toBe(5);
    expect(mon.days[0].done).toBe(false);
    // 火曜：月曜の分だけ結果が出ている（5人は奇数なので1節2試合・1人お休み）
    const tue = d.runDailyCup(rows, w, at(1))!;
    expect(tue.days[0].done).toBe(true);
    expect(tue.days[0].games.length).toBe(2);
    expect(tue.days[1].done).toBe(false);
    expect(tue.complete).toBe(false);
    // 月曜のあとに登録した人は参加しない（参加者は最初の日で決まる）
    const late = rowFor('new', 'zz');
    const withLate = [...rows, late, d.dailyRowFrom(late, w, 2)];
    expect(d.runDailyCup(withLate, w, at(3))!.entrants.length).toBe(5);
    // 日曜24時を過ぎると全試合が終わる（5節＋決勝）
    const end = d.runDailyCup(rows, w, d.dayEnd(w, 6) + 1000)!;
    expect(end.complete).toBe(true);
    expect(end.days.filter((x) => !x.final).length).toBe(5);
    expect(end.table.every((r) => r.played === 4)).toBe(true);
    expect([end.table[0].key, end.table[1].key]).toContain(end.champion);
    // 途中の日を、後から計算しても同じ結果
    expect(JSON.stringify(d.runDailyCup(rows, w, at(1) + 99999)!.days[0])).toBe(JSON.stringify(end.days[0]));
    // 保存した結果は、元の行が無くなっても読める
    const arch = d.archiveRow(end);
    const later = d.finishedCup([arch], w, d.dayEnd(w, 6) + 14 * 86400000);
    expect(later.res?.champion).toBe(end.champion);
    expect(later.needArchive).toBe(false);
  }, 30000);

  it('火曜に始まった週は、残りの日に総当たりを詰めて日曜に決勝', async () => {
    const d = await import('../cupDaily');
    const w = d.DAILY_START + 1;
    const people = ['ars', 'liv', 'mci', 'che', 'tot', 'new', 'bha', 'avl'].map((t, i) => rowFor(t, 'q' + i));
    const rows = [...people, ...people.map((r) => d.dailyRowFrom(r, w, 1))];
    const end = d.runDailyCup(rows, w, d.dayEnd(w, 6) + 1000)!;
    expect(end.startDay).toBe(1);
    // 8人＝7節を火〜土の5日に割り振る（1日2節まで）
    const league = end.days.filter((x) => !x.final);
    expect(league.every((x) => x.d >= 1 && x.d <= 5)).toBe(true);
    expect(league.reduce((a, x) => a + x.games.length, 0)).toBe(28);
    expect(end.complete).toBe(true);
  }, 60000);
});

describe('賞金100倍の週', () => {
  it('2026年10月26日の週だけ100倍', async () => {
    const { cupPrizes, CUP_PRIZE } = await import('../cup');
    expect(cupPrizes(2964)).toEqual(CUP_PRIZE.map((x) => x * 100));
    expect(cupPrizes(2965)).toEqual(CUP_PRIZE);
  });
});
