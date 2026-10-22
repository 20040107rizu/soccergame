import { RANKING_URL } from '../config';
import { plTable } from './competitions';
import { squadOf } from './lineup';
import { teamById, today } from './season';
import { overall } from './stats';
import type { GameState } from './types';
import { APP_VERSION } from '../version';
import { teamSnapshot } from './friendly';
import { cupRowFrom, missingCupRows, myCupWinCount } from './cup';

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
  /** チームのスナップショット（JSON 文字列。親善試合用） */
  team?: string;
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
    team: JSON.stringify({ ...teamSnapshot(state), cw: myCupWinCount() }),
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
  post(key);
  // 今週のフレンドカップにも、この時点のチームで登録（締め切りまでは遊ぶたびに上書き）
  post(JSON.stringify(cupRowFrom(row)));
}

function post(body: string) {
  try {
    // text/plain で送ると、ブラウザの事前確認（CORS）が要らない
    fetch(RANKING_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }).catch(() => {});
  } catch {
    // オフラインなど
  }
}

/** フレンドカップ：今週まだ登録されていない人を、その人の最新のチームで登録する（全員参加） */
export function syncCupEntries(rows: RankingRow[]) {
  if (!rankingEnabled()) return;
  for (const r of missingCupRows(rows)) post(JSON.stringify(r));
}

export async function fetchRanking(): Promise<RankingRow[]> {
  if (!rankingEnabled()) return [];
  const res = await fetch(RANKING_URL);
  const data = (await res.json()) as { rows?: RankingRow[] };
  return (data.rows ?? []).filter((r) => r && r.playerId);
}

/** 最終プレイ（最後にデータが届いた時刻）の表示 */
export function lastPlayed(updatedAt: string | undefined, now = Date.now()): { label: string; exact: string; tier: 'live' | 'recent' | 'week' | 'old' } | null {
  const t = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const exact = `${sameYear ? '' : d.getFullYear() + '年'}${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 1) return { label: 'プレイ中（たった今）', exact, tier: 'live' };
  if (min < 10) return { label: `プレイ中（${min}分前）`, exact, tier: 'live' };
  if (min < 60) return { label: `${min}分前`, exact, tier: 'recent' };
  const h = Math.floor(min / 60);
  if (h < 24) return { label: `${h}時間${min % 60 ? `${min % 60}分` : ''}前`, exact, tier: 'week' };
  const days = Math.floor(h / 24);
  if (days < 7) return { label: `${days}日${h % 24 ? `${h % 24}時間` : ''}前`, exact, tier: 'week' };
  if (days < 60) return { label: `${days}日前`, exact, tier: 'old' };
  return { label: `${Math.floor(days / 30)}か月前`, exact, tier: 'old' };
}
