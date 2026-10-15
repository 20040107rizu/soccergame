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

  it('施設は Lv20 まで、新しい施設もある', () => {
    const s = newGame('テスト', 'ars');
    s.facilities = { medical: 9 };
    expect(club.upgradeCost(s, 'medical')?.cost).toBe(650);
    s.facilities = { medical: 10 };
    expect(club.upgradeCost(s, 'medical')?.cost).toBe(1000);
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

describe('見た目・バッジ', async () => {
  const club = await import('../club');
  const bd = await import('../badges');
  it('ユニフォーム・スタジアム名・銅像・博物館を買える', () => {
    const s = newGame('テスト', 'ars');
    s.money = 1000;
    expect(club.buyKit(s, 'gold').ok).toBe(true);
    expect(club.currentKit(s)).toBe('gold');
    expect(club.renameStadium(s, 'ドリームアリーナ').ok).toBe(true);
    expect(s.stadium?.name).toBe('ドリームアリーナ');
    expect(club.buildStatue(s, 'x@1').ok).toBe(true);
    expect(club.buildStatue(s, 'x@1').ok).toBe(false);
    expect(club.buildMuseum(s).ok).toBe(true);
    const ids = bd.computeBadges(s, 1, 0);
    expect(ids).toEqual(expect.arrayContaining(['goldkit', 'museum', 'statue-1']));
  });

  it('タイトルの数で上位のバッジになり、珍しい順に並ぶ', () => {
    const s = newGame('テスト', 'ars');
    s.history = Array.from({ length: 12 }, (_, i) => ({ season: i + 1, rank: 1, champion: 'ars', userCl: i < 3 ? '優勝' : '準決勝' }));
    s.achievements = { legend: { season: 2 } };
    s.flags = { ...(s.flags ?? {}), 'sode-根本陸': true };
    const list = bd.sortBadges(bd.computeBadges(s, 120, 0));
    expect(list[0].id).toBe('sode'); // ミシック
    expect(list.find((b) => b.group === 'league')?.id).toBe('league-10');
    expect(list.filter((b) => b.group === 'league').length).toBe(1);
  });
});

describe('追加バッジとゴッド', async () => {
  const bd = await import('../badges');
  const { LEGENDS } = await import('../legend');
  it('シーズンの記録・連勝・ケチ・下剋上でバッジが付く', () => {
    const s = newGame('テスト', 'bou');
    for (let i = 0; i < 10; i++) bd.matchBadges(s, true, 'PL', []);
    bd.seasonBadges(s, 1, { ga: 18, points: 101 }, 55);
    const ids = bd.computeBadges(s, 1, 0);
    expect(ids).toEqual(expect.arrayContaining(['streak10', 'wall', 'points100', 'miser', 'underdog']));
    // 移籍金を使ったシーズンはケチにならない
    const t = newGame('テスト', 'ars');
    bd.markSpent(t, 10);
    bd.seasonBadges(t, 1, { ga: 30, points: 90 }, 92);
    expect(bd.computeBadges(t, 1, 0)).not.toContain('miser');
    expect(bd.computeBadges(t, 1, 0)).not.toContain('underdog');
  });

  it('レジェンドを図鑑で全員そろえるとゴッドのバッジ', () => {
    const s = newGame('テスト', 'ars');
    s.dex = Object.fromEntries(LEGENDS.map((l) => [`legend:${l.id}`, { key: `legend:${l.id}`, name: l.name, pos: l.pos, nat: l.nat, cat: 'legend' as const, peak: 90, first: 1, number: 10, club: 'x' }]));
    const list = bd.sortBadges(bd.computeBadges(s, 1, LEGENDS.length));
    expect(list[0].id).toBe('dexLegendAll');
    expect(list[0].tier).toBe('divine');
    expect(list.map((b) => b.id)).toContain('legend5');
  });
});

describe('まとめて操作', async () => {
  const club = await import('../club');
  const tr = await import('../transfer');
  it('スタメンをまとめて特訓し、同じ日はもうできない', () => {
    const s = newGame('テスト', 'ars');
    s.money = 5000;
    const n = club.campTargets(s, 'xi').length;
    expect(n).toBe(11);
    const r = club.runCampAll(s, 'xi');
    expect(r.done).toBe(11);
    expect(club.campTargets(s, 'xi').length).toBe(0);
  });

  it('お金が足りない時は途中まで', () => {
    const s = newGame('テスト', 'ars');
    s.money = 20;
    expect(club.runCampAll(s, 'all').done).toBe(2);
  });

  it('残り1年以下の選手とまとめて契約を更新する', () => {
    const s = newGame('テスト', 'ars');
    for (const t of s.teams) if (t.id === 'ars') t.rep = 99;
    const squad = Object.values(s.players).filter((p) => p.teamId === 'ars');
    squad.slice(0, 4).forEach((p) => (p.contractYears = 1));
    const plan = tr.bulkRenewPlan(s, 1);
    expect(plan.length).toBeGreaterThanOrEqual(4);
    const r = tr.bulkRenew(s, 1);
    expect(r.done.length + r.skipped.length).toBe(plan.length);
    expect(squad.slice(0, 4).every((p) => p.contractYears >= 1)).toBe(true);
    expect(r.done.length).toBeGreaterThan(0);
  });
});

describe('施設Lv.20・クラブの全景', async () => {
  const club = await import('../club');
  const { computeBadges } = await import('../badges');
  it('Lv.11からはとんでもなく高く、効果はLv.20でLv.10の1.5倍', () => {
    const s = newGame('テスト', 'ars');
    s.facilities = { training: 10, medical: 20 };
    expect(club.upgradeCost(s, 'training')!.cost).toBe(1000);
    expect(club.upgradeCost(s, 'medical')).toBeNull();
    expect(club.effectLevel(10)).toBe(10);
    expect(club.effectLevel(15)).toBe(12.5);
    expect(club.effectLevel(20)).toBe(15);
    expect(club.medicalBoost(s)).toBeCloseTo(10 * 0.07 * 1.5);
    s.stadium = { level: 10 };
    expect(club.stadiumCost(s)!.cost).toBe(1500);
    s.stadium = { level: 20 };
    expect(club.stadiumCost(s)).toBeNull();
    expect(club.gateIncome(s)).toBeCloseTo(10 * 0.35 * 1.5);
  });

  it('全部Lv.20で黄金郷・天空の聖地', () => {
    const s = newGame('テスト', 'ars');
    s.facilities = { training: 20, scout: 20, academy: 20, medical: 20, science: 20, analysis: 20 };
    s.stadium = { level: 20 };
    const b = computeBadges(s, 1, 0);
    expect(b).toContain('facilities20');
    expect(b).toContain('facilities');
    expect(b).toContain('stadium-20');
  });

  it('全景の情報に施設・博物館・銅像（名前と背番号）が入る', () => {
    const s = newGame('テスト', 'ars');
    s.facilities = { training: 12, analysis: 3 };
    s.stadium = { level: 4, name: '夢の劇場' };
    s.hallOfFame = [{ name: 'ティエリ・アンリ', position: 'CF', nationality: 'フランス', apps: 200, goals: 150, peak: 92, season: 5, note: '', number: 14 }];
    s.cosmetics = { statues: ['ティエリ・アンリ@5'], museum: true };
    const snap = club.sceneSnap(s);
    const d = club.sceneData(JSON.parse(JSON.stringify(snap)), '夢の劇場', ['#f00', '#fff']);
    expect(d.stadium).toBe(4);
    expect(d.fac.training).toBe(12);
    expect(d.fac.analysis).toBe(3);
    expect(d.museum).toBe(true);
    expect(d.statues).toEqual([{ name: 'ティエリ・アンリ', number: 14 }]);
  });
});

describe('平均年齢', async () => {
  const { teamAges, squadOf } = await import('../lineup');
  const { teamSnapshot } = await import('../friendly');
  it('スタメンとチーム全体の平均年齢が分かり、フレンドにも送られる', () => {
    const s = newGame('テスト', 'ars');
    const team = s.teams.find((t) => t.id === 'ars')!;
    const xi = team.lineup.map((id) => s.players[id]);
    const all = squadOf(s, 'ars');
    const a = teamAges(s, 'ars');
    expect(a.xi).toBeCloseTo(xi.reduce((x, p) => x + p.age, 0) / 11, 1);
    expect(a.all).toBeCloseTo(all.reduce((x, p) => x + p.age, 0) / all.length, 1);
    expect(teamSnapshot(s).ages).toEqual([a.xi, a.all]);
  });
});
