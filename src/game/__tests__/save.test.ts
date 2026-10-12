import { beforeEach, describe, expect, it } from 'vitest';
import { backupAll, loadGame, saveGame } from '../save';
import { newGame } from '../season';

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
    expect(haaland?.height).toBe(195);
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
