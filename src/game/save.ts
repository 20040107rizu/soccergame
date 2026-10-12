import type { GameState } from './types';
import { ensureHeight } from './height';
import { backfillXp } from './collection';

/**
 * セーブデータ。スロット制で端末内（localStorage）に保存。
 * JSON ファイルへの書き出し・読み込みで機種変更やバックアップにも対応。
 */
const PREFIX = 'masterleague.save.';
const BACKUP = 'masterleague.backup.';
export const SAVE_VERSION = 3;
export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

export interface SlotInfo {
  slot: Slot;
  managerName: string;
  teamName: string;
  season: number;
  day: number;
  updatedAt: number;
}

export function saveGame(slot: Slot, state: GameState): void {
  state.updatedAt = Date.now();
  state.version = SAVE_VERSION;
  const json = JSON.stringify(state);
  try {
    localStorage.setItem(PREFIX + slot, json);
  } catch {
    // 容量不足：古いメールやニュースを削って再挑戦（セーブ自体は必ず残す）
    state.mails = (state.mails ?? []).slice(0, 60);
    state.news = (state.news ?? []).slice(0, 60);
    localStorage.setItem(PREFIX + slot, JSON.stringify(state));
  }
  localStorage.setItem(PREFIX + 'last', String(slot));
}

/** 起動時に、各スロットの直前の状態をバックアップしておく（アップデートで壊れても戻せるように） */
export function backupAll(): void {
  for (const slot of SLOTS) {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) continue;
    try {
      JSON.parse(raw);
      localStorage.setItem(BACKUP + slot, raw);
    } catch {
      // 壊れたデータでバックアップを上書きしない
    }
  }
}

export function loadGame(slot: Slot): GameState | null {
  for (const key of [PREFIX + slot, BACKUP + slot]) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      return migrate(JSON.parse(raw));
    } catch {
      // 本体が読めなければバックアップを試す
    }
  }
  return null;
}

export function deleteGame(slot: Slot): void {
  localStorage.removeItem(PREFIX + slot);
  localStorage.removeItem(BACKUP + slot);
}

export function slotInfo(slot: Slot): SlotInfo | null {
  const s = loadGame(slot);
  if (!s) return null;
  return {
    slot,
    managerName: s.managerName,
    teamName: s.teams.find((t) => t.id === s.userTeamId)?.name ?? '',
    season: s.season,
    day: s.day,
    updatedAt: s.updatedAt,
  };
}

/**
 * 古いセーブを今のデータ構造に変換する。
 * アップデート（メンテナンス）でプレイ中のデータを消さないため、どの版のセーブも捨てずに補完する。
 * データ構造を変える時は、ここに変換処理を足していく。
 */
function migrate(s: GameState): GameState {
  if (!s || !Array.isArray(s.teams) || typeof s.players !== 'object') throw new Error('broken');
  // v0.2 以前（公開前の試作版）はデータ構造が大きく違うため読み込まない。v0.3 以降のセーブは必ず引き継ぐ
  if (!s.version || s.version < 3) throw new Error('prototype save');
  s.mails = s.mails ?? [];
  s.watchlist = s.watchlist ?? [];
  s.news = s.news ?? [];
  s.offers = s.offers ?? [];
  s.negotiations = s.negotiations ?? {};
  s.history = s.history ?? [];
  s.flags = s.flags ?? {};
  for (const t of s.teams) {
    t.spirit = t.spirit ?? 75;
  }
  // v0.8：身長を追加（実在選手は調べた値、それ以外はポジションに合わせて設定）
  for (const p of Object.values(s.players)) ensureHeight(p);
  // v0.17：監督レベルの実装前のセーブは、これまでの記録から経験値を計算する
  backfillXp(s);
  // ここから下に、将来のバージョンごとの変換を追加する
  // if (s.version < 4) { ... }
  s.version = SAVE_VERSION;
  return s;
}

/** 端末に「このサイトのデータを消さないで」とお願いする（対応ブラウザのみ） */
export function requestPersistence(): void {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // 非対応
  }
}
