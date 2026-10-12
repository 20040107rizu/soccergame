import { RANKING_URL } from '../config';
import { plTable } from './competitions';
import { squadOf } from './lineup';
import { teamById, today } from './season';
import { overall } from './stats';
import type { GameState } from './types';
import { APP_VERSION } from '../version';

/** ランキングに送るプレー状況（個人情報は含めない） */
export interface RankingRow {
  playerId: string;
  slot: number;
  nickname: string;
  club: string;
  season: number;
  progress: string;
  plRank: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  points: number;
  gf: number;
  ga: number;
  money: number;
  spirit: number;
  topPlayer: string;
  achievements: number;
  clResult: string;
  titles: number;
  clTitles: number;
  version: string;
  updatedAt?: string;
}

const ID_KEY = 'masterleague.playerId';

/** 端末ごとのランダムな ID（個人を特定する情報ではない） */
export function playerId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function rankingEnabled(): boolean {
  return RANKING_URL.startsWith('https://');
}

export function rankingSummary(state: GameState, slot: number): RankingRow {
  const team = teamById(state, state.userTeamId);
  const row = plTable(state).map((r, i) => ({ ...r, rank: i + 1 })).find((r) => r.teamId === team.id);
  const top = squadOf(state, team.id).sort((a, b) => overall(b) - overall(a))[0];
  const titles = state.history.filter((h) => h.rank === 1).length;
  const clTitles = state.history.filter((h) => h.userCl === '優勝').length;
  const lastCl = state.history[state.history.length - 1]?.userCl ?? '';
  return {
    playerId: playerId(),
    slot,
    nickname: (state.managerName || 'ゲスト').slice(0, 16),
    club: team.name.slice(0, 24),
    season: state.season,
    progress: today(state)?.label ?? 'シーズン終了',
    plRank: row?.rank ?? 0,
    played: row?.played ?? 0,
    win: row?.win ?? 0,
    draw: row?.draw ?? 0,
    loss: row?.loss ?? 0,
    points: row?.points ?? 0,
    gf: row?.gf ?? 0,
    ga: row?.ga ?? 0,
    money: Math.round(state.money * 1.6), // 億円
    spirit: Math.round(team.spirit),
    topPlayer: top ? `${top.name}(${overall(top)})` : '',
    achievements: Object.keys(state.achievements ?? {}).length,
    clResult: lastCl,
    titles,
    clTitles,
    version: APP_VERSION,
  };
}

let lastSent = '';

/** 状況を送る（同じ内容なら送らない。失敗してもゲームには影響させない） */
export function sendRanking(state: GameState, slot: number) {
  if (!rankingEnabled()) return;
  const row = rankingSummary(state, slot);
  const key = JSON.stringify(row);
  if (key === lastSent) return;
  lastSent = key;
  try {
    // text/plain で送ると、ブラウザの事前確認（CORS）が要らない
    fetch(RANKING_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: key }).catch(() => {});
  } catch {
    // オフラインなど
  }
}

export async function fetchRanking(): Promise<RankingRow[]> {
  if (!rankingEnabled()) return [];
  const res = await fetch(RANKING_URL);
  const data = (await res.json()) as { rows?: RankingRow[] };
  return (data.rows ?? []).filter((r) => r && r.playerId);
}
