import { SODE_PLAYERS } from '../data/sodegaura';
import { LEGENDS } from './legend';
import { squadOf } from './lineup';
import { sendMail } from './mail';
import { teamById } from './season';
import { overall } from './stats';
import type { GameState, Player, Position } from './types';

/* ======================= 選手図鑑 ======================= */

export type DexCat = 'normal' | 'youth' | 'gem' | 'mystery' | 'legend' | 'heir' | 'sode';

export interface DexEntry {
  key: string;
  name: string;
  pos: Position;
  nat: string;
  cat: DexCat;
  peak: number;
  first: number;
  number: number;
  club: string;
  colors?: [string, string];
}

export const DEX_CATS: { id: DexCat; label: string; rare?: boolean; total?: () => number }[] = [
  { id: 'normal', label: '選手' },
  { id: 'youth', label: 'ユース出身' },
  { id: 'gem', label: '掘り出し物', rare: true },
  { id: 'mystery', label: '謎の代理人', rare: true },
  { id: 'legend', label: 'レジェンド', rare: true, total: () => LEGENDS.length },
  { id: 'heir', label: '2世', rare: true, total: () => LEGENDS.length },
  { id: 'sode', label: '袖ヶ浦高等学校', rare: true, total: () => SODE_PLAYERS.length },
];

export function dexCat(p: Player): DexCat {
  if (p.sode) return 'sode';
  if (p.legend?.heir) return 'heir';
  if (p.legend) return 'legend';
  if (p.mystery) return 'mystery';
  if (p.gem) return 'gem';
  if (p.academy) return 'youth';
  return 'normal';
}

function dexKey(p: Player): string {
  if (p.sode) return `sode:${p.sode.name}`;
  if (p.legend?.seedId) return `${p.legend.heir ? 'heir' : 'legend'}:${p.legend.seedId}`;
  return `p:${p.id}`;
}

/** 自分のクラブの選手を図鑑に登録・更新する（解除すべき実績の id を返す） */
export function registerDex(state: GameState): string[] {
  state.dex = state.dex ?? {};
  const team = teamById(state, state.userTeamId);
  const club = team.name;
  let added = 0;
  for (const p of squadOf(state, state.userTeamId)) {
    // 掘り出し物は正体が分かってから載せる
    if (p.gem && !p.gem.revealed) continue;
    const key = dexKey(p);
    const ovr = overall(p);
    const e = state.dex[key];
    if (e) {
      e.peak = Math.max(e.peak, ovr);
      continue;
    }
    state.dex[key] = { key, name: p.name, pos: p.position, nat: p.nationality, cat: dexCat(p), peak: ovr, first: state.season, number: p.number, club, colors: [team.color, team.color2] };
    added++;
  }
  const n = Object.keys(state.dex).length;
  const ach: string[] = [];
  if (n >= 50) ach.push('dex50');
  if (n >= 100) ach.push('dex100');
  for (const c of DEX_CATS) {
    if (!c.total) continue;
    const got = Object.values(state.dex).filter((e) => e.cat === c.id).length;
    if (got >= c.total()) ach.push(`dexAll-${c.id}`);
  }
  void added;
  return ach;
}

/** 図鑑のカテゴリをそろえた数（ホーム画面のバッジ用） */
export function dexBadges(state: GameState): DexCat[] {
  const dex = Object.values(state.dex ?? {});
  return DEX_CATS.filter((c) => c.total && dex.filter((e) => e.cat === c.id).length >= c.total()).map((c) => c.id);
}

/* ======================= 監督レベルと称号 ======================= */

export const MAX_LEVEL = 50;

export function managerLevel(state: GameState): number {
  const xp = state.manager?.xp ?? 0;
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(xp / 10)));
}

/** 次のレベルまでの経験値 [今, 必要] */
export function levelProgress(state: GameState): [number, number] {
  const lv = managerLevel(state);
  if (lv >= MAX_LEVEL) return [1, 1];
  const xp = state.manager?.xp ?? 0;
  const base = 10 * (lv - 1) ** 2;
  const next = 10 * lv ** 2;
  return [xp - base, next - base];
}

const LEVEL_TITLES: [number, string][] = [
  [1, '新米監督'],
  [5, '期待の若手監督'],
  [10, '戦術家'],
  [15, '勝負師'],
  [20, '名将'],
  [25, '智将'],
  [30, '闘将'],
  [40, '世界的名将'],
  [50, '生ける伝説'],
];

/** 実績で手に入る特別な称号 */
const SPECIAL_TITLES: { id: string; title: string; ach: string }[] = [
  { id: 'king', title: '王者の指揮官', ach: 'champion' },
  { id: 'europe', title: '欧州の覇者', ach: 'clWinner' },
  { id: 'double', title: '二冠の名将', ach: 'double' },
  { id: 'invincible', title: '無敗の帝王', ach: 'invincible' },
  { id: 'youth', title: '育成の魔術師', ach: 'youth11' },
  { id: 'golden', title: '黄金世代の父', ach: 'golden' },
  { id: 'slayer', title: '伝説を超えし者', ach: 'legendSlayer' },
  { id: 'wander', title: '渡り鳥', ach: 'jobChange' },
  { id: 'giant', title: '巨人殺し', ach: 'giantKill' },
];

/** 手に入れた称号（レベルの称号＋特別な称号） */
export function earnedTitles(state: GameState): string[] {
  const lv = managerLevel(state);
  const out = LEVEL_TITLES.filter(([l]) => lv >= l).map(([, t]) => t);
  for (const s of SPECIAL_TITLES) if (state.achievements?.[s.ach]) out.push(s.title);
  return out;
}

export function managerTitle(state: GameState): string {
  const titles = earnedTitles(state);
  const chosen = state.manager?.title;
  if (chosen && titles.includes(chosen)) return chosen;
  return [...LEVEL_TITLES].reverse().find(([l]) => managerLevel(state) >= l)![1];
}

/** レベルに応じた小さな有利 */
export function managerPerks(state: GameState): { interest: number; special: number; scout: boolean } {
  const lv = managerLevel(state);
  return {
    // 選手が「この監督の下でやりたい」と思いやすい
    interest: lv >= 30 ? 10 : lv >= 20 ? 6 : lv >= 10 ? 3 : 0,
    // レジェンドなど特別な交渉が少しだけ成立しやすい
    special: lv >= 40 ? 0.04 : lv >= 25 ? 0.02 : 0,
    // スカウトの見立てが正確になる
    scout: lv >= 15,
  };
}

export const PERK_TEXT: [number, string][] = [
  [10, '選手が移籍に乗り気になりやすい'],
  [15, 'スカウトの見立てが正確になる'],
  [20, '選手がさらに移籍に乗り気になりやすい'],
  [25, '特別な選手との交渉が少し成立しやすい'],
  [30, '選手がとても移籍に乗り気になりやすい'],
  [40, '特別な選手との交渉がさらに成立しやすい'],
];

/** 経験値を足す（レベルが上がればメール） */
export function addXp(state: GameState, n: number) {
  const before = managerLevel(state);
  state.manager = { ...(state.manager ?? { xp: 0 }), xp: (state.manager?.xp ?? 0) + n };
  const after = managerLevel(state);
  if (after > before) {
    const newTitle = LEVEL_TITLES.find(([l]) => l > before && l <= after);
    sendMail(state, {
      from: 'board',
      sender: 'クラブ会長',
      subject: `📈 監督レベル ${after} に到達${newTitle ? `・称号「${newTitle[1]}」` : ''}`,
      body: `監督としての経験が積み重なり、レベル ${after} になりました。${newTitle ? `\n\n新しい称号「${newTitle[1]}」を手に入れました。クラブ画面で表示する称号を選べます。` : ''}${PERK_TEXT.filter(([l]) => l > before && l <= after)
        .map(([, t]) => `\n\n新しい効果：${t}`)
        .join('')}`,
    });
  }
}

/** 試合後の経験値 */
export function matchXp(state: GameState, gf: number, ga: number, comp: 'PL' | 'CL') {
  const base = gf > ga ? 10 : gf === ga ? 4 : 1;
  addXp(state, comp === 'CL' ? base + 2 : base);
}
