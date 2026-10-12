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
