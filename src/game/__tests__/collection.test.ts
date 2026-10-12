import { describe, expect, it } from 'vitest';
import { addXp, dexBadges, earnedTitles, managerLevel, managerPerks, managerTitle, registerDex } from '../collection';
import { makeLegend, LEGENDS } from '../legend';
import { newGame } from '../season';

describe('図鑑・監督レベル', () => {
  it('自分の選手が図鑑に載り、レジェンドは特別な枠に入る', () => {
    const s = newGame('テスト', 'ars');
    registerDex(s);
    const n = Object.keys(s.dex!).length;
    expect(n).toBeGreaterThan(15);
    const p = makeLegend(LEGENDS[0], 'prodigy');
    p.teamId = 'ars';
    s.players[p.id] = p;
    registerDex(s);
    expect(Object.values(s.dex!).filter((e) => e.cat === 'legend').length).toBe(1);
    // 同じ選手は二重に載らない
    registerDex(s);
    expect(Object.keys(s.dex!).length).toBe(n + 1);
    expect(dexBadges(s)).toEqual([]);
  });

  it('経験値でレベルが上がり、称号と効果が増える', () => {
    const s = newGame('テスト', 'ars');
    expect(managerLevel(s)).toBe(1);
    expect(managerTitle(s)).toBe('新米監督');
    addXp(s, 10 * 19 ** 2);
    expect(managerLevel(s)).toBe(20);
    expect(earnedTitles(s)).toContain('名将');
    expect(managerPerks(s).interest).toBeGreaterThan(0);
    expect(s.mails[0].subject).toContain('監督レベル 20');
    s.manager!.title = '戦術家';
    expect(managerTitle(s)).toBe('戦術家');
  });
});

describe('施設・愛称', async () => {
  const club = await import('../club');
  it('施設は資金を使って工事し、工期が過ぎると完成する', () => {
    const s = newGame('テスト', 'ars');
    s.money = 100;
    expect(club.startUpgrade(s, 'training').ok).toBe(true);
    expect(s.money).toBe(85);
    expect(club.startUpgrade(s, 'scout').ok).toBe(false); // 工事は1つずつ
    s.day += 3;
    club.facilityTick(s);
    expect(club.facilityLevel(s, 'training')).toBe(1);
    expect(club.trainingBoost(s)).toBeGreaterThan(1);
    expect(s.mails[0].subject).toContain('練習場');
  });

  it('ホームで活躍を続けると愛称が付く', () => {
    const s = newGame('テスト', 'ars');
    const p = Object.values(s.players).find((x) => x.teamId === 'ars' && x.position === 'CF')!;
    for (let i = 0; i < 5; i++) club.fanTick(s, [p.id], { [p.id]: 8 }, [p.id], false);
    expect(p.nickname).toBeTruthy();
    expect(s.mails[0].subject).toContain(p.nickname!);
  });
});
