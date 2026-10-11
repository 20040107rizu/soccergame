import { describe, expect, it } from 'vitest';
import { newGame } from '../data';
import { overall } from '../rating';
import { parseCsv, exportRosterCsv, importRosterCsv } from '../roster';
import { endSeason, isSeasonOver, playRound, squadOf, standings, totalRounds } from '../season';
import { buyPlayer, sellPlayer, transferFee } from '../transfer';

describe('シーズン進行', () => {
  it('3シーズン回しても破綻しない', () => {
    const s = newGame('テスト', 't1');
    let goals = 0;
    let matches = 0;
    for (let season = 0; season < 3; season++) {
      expect(totalRounds(s)).toBe(14);
      while (!isSeasonOver(s)) playRound(s);
      for (const f of s.fixtures) {
        goals += f.result!.home + f.result!.away;
        matches++;
      }
      const table = standings(s);
      expect(table.reduce((a, r) => a + r.played, 0)).toBe(14 * 8);
      endSeason(s);
      for (const t of s.teams) {
        expect(new Set(t.lineup).size).toBe(11);
        expect(t.lineup.every((id) => s.players[id]?.teamId === t.id)).toBe(true);
        if (t.id !== s.userTeamId) expect(squadOf(s, t.id).length).toBeGreaterThanOrEqual(22);
      }
    }
    const avg = goals / matches;
    console.log('1試合平均得点', avg.toFixed(2), '最終ポイント', s.points);
    expect(avg).toBeGreaterThan(1.5);
    expect(avg).toBeLessThan(4.5);
  });

  it('獲得と放出でポイントが動く', () => {
    const s = newGame('テスト', 't1');
    const target = Object.values(s.players)
      .filter((p) => !p.teamId)
      .sort((a, b) => transferFee(a) - transferFee(b))[0];
    const before = s.points;
    const fee = transferFee(target);
    expect(buyPlayer(s, target.id).ok).toBe(true);
    expect(s.points).toBe(before - fee);
    expect(s.players[target.id].teamId).toBe('t1');
    const weakest = squadOf(s, 't1').sort((a, b) => overall(a) - overall(b))[0];
    expect(sellPlayer(s, weakest.id).ok).toBe(true);
    expect(s.players[weakest.id].teamId).toBeNull();
    const team = s.teams.find((t) => t.id === 't1')!;
    expect(team.lineup.includes(weakest.id)).toBe(false);
  });
});

describe('名簿CSV', () => {
  it('書き出し→名前変更→読み込み', () => {
    const s = newGame('テスト', 't1');
    const rows = parseCsv(exportRosterCsv(s));
    const id = rows[1][0];
    rows[1][2] = 'ヤマダ, "タロウ"';
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    expect(importRosterCsv(s, csv)).toBe(rows.length - 1);
    expect(s.players[id].name).toBe('ヤマダ, "タロウ"');
  });
});
