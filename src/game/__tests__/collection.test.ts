import { describe, expect, it } from 'vitest';
import { addXp, backfillXp, dexBadges, earnedTitles, managerLevel, managerPerks, managerTitle, MAX_LEVEL, registerDex, xpForLevel } from '../collection';
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
    addXp(s, xpForLevel(20));
    expect(managerLevel(s)).toBe(20);
    expect(earnedTitles(s)).toContain('名将');
    expect(managerPerks(s).interest).toBeGreaterThan(0);
    expect(s.mails[0].subject).toContain('監督レベル 20');
    s.manager!.title = '戦術家';
    expect(managerTitle(s)).toBe('戦術家');
    // 上限は 999
    addXp(s, xpForLevel(MAX_LEVEL) * 2);
    expect(managerLevel(s)).toBe(999);
    expect(earnedTitles(s)).toContain('フットボールそのもの');
  });

  it('監督レベルの実装前から遊んでいたセーブは、これまでの記録からレベルが決まる', () => {
    const s = newGame('テスト', 'ars');
    delete s.manager;
    s.history = [
      { season: 1, rank: 1, champion: 'ars', userCl: '優勝' },
      { season: 2, rank: 3, champion: 'mci', userCl: '準決勝' },
      { season: 3, rank: 2, champion: 'liv', userCl: 'ラウンド16' },
    ];
    s.achievements = { firstWin: { season: 1 }, champion: { season: 1 }, clWinner: { season: 1 } };
    backfillXp(s);
    expect(managerLevel(s)).toBeGreaterThanOrEqual(15);
    const lv = managerLevel(s);
    backfillXp(s); // 二重には足さない
    expect(managerLevel(s)).toBe(lv);
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

describe('お金の使い道', async () => {
  const club = await import('../club');
  const tr = await import('../transfer');
  const ev = await import('../events');
  it('スタジアムを拡張すると入場収入と格が上がる', () => {
    const s = newGame('テスト', 'bou');
    s.money = 1000;
    const rep = s.teams.find((t) => t.id === 'bou')!.rep;
    expect(club.startStadium(s).ok).toBe(true);
    s.day += 6;
    club.stadiumTick(s);
    expect(club.stadiumLevel(s)).toBe(1);
    expect(club.gateIncome(s)).toBeGreaterThan(0);
    expect(s.teams.find((t) => t.id === 'bou')!.rep).toBe(rep + 1);
  });

  it('施設は Lv10 まで、新しい施設もある', () => {
    const s = newGame('テスト', 'ars');
    s.facilities = { medical: 9 };
    expect(club.upgradeCost(s, 'medical')?.cost).toBe(650);
    s.facilities = { medical: 10 };
    expect(club.upgradeCost(s, 'medical')).toBeNull();
    expect(club.medicalBoost(s)).toBeGreaterThan(0.5);
  });

  it('特訓キャンプは使うほど高くなり、1日1回まで', () => {
    const s = newGame('テスト', 'ars');
    s.money = 1000;
    const p = Object.values(s.players).find((x) => x.teamId === 'ars' && x.position === 'CMF')!;
    const c1 = club.campCost(p, 'stat');
    expect(club.runCamp(s, p.id, 'stat').ok).toBe(true);
    expect(club.runCamp(s, p.id, 'stat').ok).toBe(false);
    s.day++;
    expect(club.campCost(p, 'stat')).toBeGreaterThan(c1);
    const n = p.skills.length;
    if (n < 12) {
      expect(club.runCamp(s, p.id, 'skill').ok).toBe(true);
      expect(p.skills.length).toBe(n + 1);
    }
  });

  it('海外遠征から帰ると掘り出し物の話が届き、お金持ちには移籍金が高くなる', () => {
    const s = newGame('テスト', 'ars');
    s.money = 100;
    expect(club.startExpedition(s, 'samerica').ok).toBe(true);
    s.day += 6;
    club.expeditionTick(s, (st, o) => ev.spawnGem(st, o));
    expect(s.gemOffer).toBeTruthy();
    expect(s.mails[0].subject).toContain('南米遠征');
    const target = Object.values(s.players).find((x) => x.teamId === 'ful' && x.position === 'CF')!;
    s.money = 100;
    const cheap = tr.askingPrice(s, target);
    s.money = 2000;
    expect(tr.askingPrice(s, target)).toBeGreaterThan(cheap * 1.8);
  });
});
