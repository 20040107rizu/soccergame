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
