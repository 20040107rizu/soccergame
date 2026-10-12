import { describe, expect, it } from 'vitest';
import { clLeagueTable, plTable } from '../competitions';
import { squadOf } from '../lineup';
import { endSeason, isSeasonOver, newGame, playDay, prepareDay, teamById, updateCondition } from '../season';
import { overall } from '../stats';

describe('マスターリーグ進行', () => {
  it('2シーズン（PL38節＋CL）を回しても破綻しない', { timeout: 120000 }, () => {
    const s = newGame('テスト', 'ars');
    expect(s.teams.filter((t) => t.league === 'PL')).toHaveLength(20);
    expect(s.clTeams).toHaveLength(36);
    expect(s.fixtures.filter((f) => f.comp === 'PL')).toHaveLength(380);
    expect(s.fixtures.filter((f) => f.comp === 'CL')).toHaveLength(144);
    for (let season = 0; season < 2; season++) {
      let goals = 0;
      let games = 0;
      while (!isSeasonOver(s)) {
        prepareDay(s);
        playDay(s);
      }
      for (const f of s.fixtures.filter((x) => x.comp === 'PL')) {
        goals += f.result!.home + f.result!.away;
        games++;
      }
      const final = s.ties.find((t) => t.stage === 'F');
      expect(final?.winner).toBeTruthy();
      const tbl = plTable(s);
      console.log(
        `S${s.season} 平均得点 ${(goals / games).toFixed(2)} 優勝 ${teamById(s, tbl[0].teamId).name}(${tbl[0].points}) 最下位 ${teamById(s, tbl[19].teamId).name}(${tbl[19].points})`,
        'CL優勝', teamById(s, final!.winner!).name, 'CL1位', teamById(s, clLeagueTable(s)[0].teamId).name,
        '資金', s.money.toFixed(1),
        '上位:', tbl.slice(0, 6).map((r) => teamById(s, r.teamId).short + r.points).join(' '),
      );
      expect(goals / games).toBeGreaterThan(1.8);
      expect(goals / games).toBeLessThan(3.8);
      endSeason(s);
      for (const t of s.teams) {
        expect(new Set(t.lineup.filter(Boolean)).size).toBe(11);
        expect(squadOf(s, t.id).length).toBeGreaterThanOrEqual(18);
      }
    }
  });

  it('実在選手の総合値が狙いどおり', () => {
    const s = newGame('テスト', 'ars');
    const haaland = Object.values(s.players).find((p) => p.nameEn === 'Erling Haaland')!;
    expect(Math.abs(overall(haaland) - 91)).toBeLessThanOrEqual(1);
    const ids = new Set(Object.keys(s.players));
    expect(ids.size).toBe(Object.keys(s.players).length);
  });

  it('オリジナルチームで開始できる', () => {
    const s = newGame('テスト', '', { name: 'FCテスト', short: 'FCT', color: '#123456', color2: '#ffffff', replaces: 'hul' });
    expect(s.userTeamId).toBe('orig');
    expect(s.teams.some((t) => t.id === 'hul')).toBe(false);
    expect(squadOf(s, 'orig').every((p) => p.custom)).toBe(true);
  });

  it('調子は毎試合変わり、絶不調が長く続かない。安定度が高いほど好調が多い', () => {
    const s = newGame('テスト', 'ars');
    const p = Object.values(s.players)[0];
    const avg = (form: number) => {
      p.traits.form = form;
      let sum = 0;
      let streak = 0;
      let worst = 0;
      for (let i = 0; i < 3000; i++) {
        updateCondition(p);
        sum += p.condition;
        streak = p.condition === 1 ? streak + 1 : 0;
        worst = Math.max(worst, streak);
      }
      expect(worst).toBeLessThan(8);
      return sum / 3000;
    };
    expect(avg(8)).toBeGreaterThan(avg(1));
  });
});
