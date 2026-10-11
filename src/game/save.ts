import type { GameState } from './types';

/**
 * セーブデータ。スロット制で端末内（localStorage）に保存。
 * JSON ファイルへの書き出し・読み込みで機種変更やバックアップにも対応。
 */
const PREFIX = 'masterleague.save.';
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
  localStorage.setItem(PREFIX + slot, JSON.stringify(state));
  localStorage.setItem(PREFIX + 'last', String(slot));
}

export function loadGame(slot: Slot): GameState | null {
  const raw = localStorage.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteGame(slot: Slot): void {
  localStorage.removeItem(PREFIX + slot);
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

export function exportJson(state: GameState): string {
  return JSON.stringify(state);
}

export function importJson(text: string): GameState {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.teams) || typeof data.players !== 'object' || !data.userTeamId) {
    throw new Error('セーブデータの形式が正しくありません');
  }
  const s = migrate(data);
  if (!s) throw new Error('このセーブデータは古いバージョンのため読み込めません');
  return s;
}

/** 将来データ構造を変えた時に古いセーブを変換する場所 */
function migrate(s: GameState): GameState {
  if (!s.version || s.version < SAVE_VERSION) {
    throw new Error('old version');
  }
  return s;
}
