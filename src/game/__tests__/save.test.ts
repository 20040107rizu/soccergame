import { beforeEach, describe, expect, it } from 'vitest';
import { backupAll, loadGame, saveGame } from '../save';
import { newGame } from '../season';
import { sceneSnap, startUpgrade } from '../club';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

describe('セーブデータの引き継ぎ', () => {
  it('新しい項目がない古い v0.3 のセーブも読み込める', () => {
    const s = newGame('テスト', 'ars');
    const old = JSON.parse(JSON.stringify(s));
    delete old.mails;
    delete old.watchlist;
    delete old.flags;
    old.version = 3;
    store.set('masterleague.save.1', JSON.stringify(old));
    const g = loadGame(1)!;
    expect(g).not.toBeNull();
    expect(g.mails).toEqual([]);
    expect(g.userTeamId).toBe('ars');
  });

  it('v0.6 のセーブも v0.7（総合値109対応）で読み込める', () => {
    const s = newGame('テスト', 'mci');
    s.version = 3;
    store.set('masterleague.save.2', JSON.stringify(s));
    const g = loadGame(2)!;
    expect(g.userTeamId).toBe('mci');
    expect(Object.keys(g.players).length).toBe(Object.keys(s.players).length);
  });

  it('身長のない v0.7 のセーブを読み込むと、全選手に身長が入る', () => {
    const s = newGame('テスト', 'mci');
    for (const p of Object.values(s.players)) delete p.height;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(Object.values(g.players).every((p) => (p.height ?? 0) >= 155)).toBe(true);
    const haaland = Object.values(g.players).find((p) => p.nameEn === 'Erling Haaland');
    expect(haaland?.height).toBe(194);
  });

  it('年俸アップ要求の途中（回数の記録なし）の v0.12.1 セーブも読める', () => {
    const s = newGame('テスト', 'ars');
    const pid = Object.values(s.players).find((p) => p.teamId === 'ars')!.id;
    s.demand = { playerId: pid, kind: 'raise', expires: 99 };
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.demand?.playerId).toBe(pid);
    expect(g.demand?.tries).toBeUndefined();
  });

  it('交代予約の項目がない v0.12.8 のセーブも読める', () => {
    const s = newGame('テスト', 'che');
    for (const t of s.teams) delete t.halftimeSubs;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.teams.find((t) => t.id === 'che')?.halftimeSubs).toBeUndefined();
    expect(g.userTeamId).toBe('che');
  });

  it('ひみつのチームの項目がない v0.12.9 のセーブも読める', () => {
    const s = newGame('テスト', 'tot');
    delete s.sodeChallenge;
    for (const m of s.mails) delete m.sode;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.sodeChallenge).toBeUndefined();
    expect(g.userTeamId).toBe('tot');
  });

  it('図鑑・監督レベル・殿堂の新しい項目がない v0.13 のセーブも読める', () => {
    const s = newGame('テスト', 'new');
    delete s.dex;
    delete s.manager;
    delete s.hofXI;
    delete s.facilities;
    delete s.coachChallenge;
    delete s.aceNumbers;
    delete s.miracles;
    delete s.zone;
    delete s.mysteryOffer;
    delete s.stadium;
    delete s.cosmetics;
    delete s.counters;
    delete s.expedition;
    s.hallOfFame = [{ name: '昔の名選手', position: 'CF', nationality: '日本', apps: 120, goals: 50, peak: 85, season: 3, note: '名選手' }];
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.hallOfFame?.[0].name).toBe('昔の名選手');
    expect(g.dex).toBeUndefined();
    expect(g.userTeamId).toBe('new');
  });

  it('監督レベル実装前（v0.13）のセーブを読むと、過去の記録からレベルが計算される', () => {
    const s = newGame('テスト', 'liv');
    delete s.manager;
    s.history = Array.from({ length: 10 }, (_, i) => ({ season: i + 1, rank: 2, champion: 'mci', userCl: '準々決勝' }));
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.manager?.backfilled).toBe(true);
    expect(g.manager!.xp).toBeGreaterThan(5000);
    expect(g.mails[0].subject).toContain('監督レベル');
  });

  it('シーズン履歴にクラブ名がない古いセーブも読める', () => {
    const s = newGame('テスト', 'mun');
    s.history = [{ season: 1, rank: 4, champion: 'mci', userCl: '出場なし' }];
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.history[0].club).toBeUndefined();
    expect(g.history[0].rank).toBe(4);
  });

  it('ユースチーム実装前（v0.19）のセーブを読むと、ユースに最初の子たちが入る', () => {
    const s = newGame('テスト', 'ars');
    delete s.youth;
    for (const p of Object.values(s.players)) delete p.youth;
    const before = Object.keys(s.players).length;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(Object.keys(g.youth!.kids).length).toBe(3);
    // トップチーム・選手データはそのまま
    expect(Object.keys(g.players).length).toBe(before);
    expect(g.userTeamId).toBe('ars');
  });

  it('施設Lv.10が上限だった頃（v0.20）のセーブも読め、Lv.11に強化できる', () => {
    const s = newGame('テスト', 'ars');
    s.facilities = { training: 10, scout: 10, academy: 10, medical: 10, science: 10, analysis: 10 };
    s.stadium = { level: 10, name: '夢の劇場' };
    s.cosmetics = { statues: ['昔の名選手@3'], museum: true };
    s.money = 5000;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.facilities?.training).toBe(10);
    expect(g.stadium?.name).toBe('夢の劇場');
    expect(startUpgrade(g, 'training').ok).toBe(true);
    expect(sceneSnap(g).st[0][0]).toBe('昔の名選手');
  });

  it('ひみつのチームの出現記録が無い古いセーブでも、次の選手を選べる', async () => {
    const { nextSodePick } = await import('../sodegaura');
    const s = newGame('テスト', 'ars');
    s.flags = { sodeWin: true };
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(nextSodePick(g)).not.toBeNull();
  });

  it('サウジのオファーが無い古いセーブも読め、オファーが届く', async () => {
    const { spawnSaudi } = await import('../saudi');
    const s = newGame('テスト', 'ars');
    delete s.saudiOffer;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.saudiOffer).toBeUndefined();
    expect(spawnSaudi(g)).toBe(true);
  });

  it('経歴の記録が無い古いセーブも読め、経歴を表示できる', async () => {
    const { careerOf } = await import('../career');
    const s = newGame('テスト', 'ars');
    for (const p of Object.values(s.players)) delete p.log;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    const p = Object.values(g.players).find((x) => x.teamId === 'ars')!;
    expect(careerOf(g, p).length).toBeGreaterThan(0);
  });

  it('ワールドカップ実装前（v0.25）のセーブも読め、シーズン終了時に開幕できる', async () => {
    const { maybeStartWorldCup } = await import('../worldcup');
    const s = newGame('テスト', 'ars');
    delete s.worldCup;
    delete s.wcHistory;
    store.set('masterleague.save.3', JSON.stringify(s));
    const g = loadGame(3)!;
    expect(g.worldCup).toBeUndefined();
    maybeStartWorldCup(g, 8);
    expect(g.worldCup?.nations.length).toBe(32);
  });

  it('本体が壊れていてもバックアップから復旧する', () => {
    const s = newGame('テスト', 'liv');
    saveGame(1, s);
    backupAll();
    store.set('masterleague.save.1', '{壊れたデータ');
    backupAll(); // 壊れたデータでバックアップを上書きしない
    expect(loadGame(1)?.userTeamId).toBe('liv');
  });
});
