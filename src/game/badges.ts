import { SODE_PLAYERS } from '../data/sodegaura';
import { LEGENDS } from './legend';
import { squadOf } from './lineup';
import { overall } from './stats';
import type { GameState } from './types';

/** バッジのレア度（右ほど珍しい） */
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'legend' | 'mythic' | 'divine';

export const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'ノーマル',
  silver: 'レア',
  gold: 'スーパーレア',
  legend: 'レジェンド',
  mythic: 'ミシック',
  divine: 'ゴッド',
};
const TIER_RANK: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2, legend: 3, mythic: 4, divine: 5 };

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  tier: BadgeTier;
  /** 運が絡む珍しいバッジ */
  luck?: boolean;
  /** 隠し実績にからむバッジ（見る人も持っていないと名前は伏せる） */
  hidden?: boolean;
  /** 同じ系統のバッジ（上位を持っていれば下位は並べない） */
  group?: string;
}

const tiered = (group: string, icon: string, name: string, unit: string, steps: [number, BadgeTier][]): BadgeDef[] =>
  steps.map(([n, tier]) => ({ id: `${group}-${n}`, icon, name: `${name} ${n}${unit}`, desc: `${name}を${n}${unit}達成`, tier, group }));

export const BADGES: BadgeDef[] = [
  ...tiered('league', '🏆', 'リーグ優勝', '回', [[1, 'bronze'], [5, 'silver'], [10, 'gold'], [30, 'legend'], [50, 'mythic']]),
  ...tiered('cl', '⭐', 'CL優勝', '回', [[1, 'silver'], [3, 'gold'], [10, 'legend'], [30, 'mythic']]),
  ...tiered('level', '📈', '監督レベル', '', [[10, 'bronze'], [50, 'silver'], [100, 'gold'], [300, 'legend'], [999, 'mythic']]),
  ...tiered('dex', '📖', '図鑑', '人', [[50, 'bronze'], [100, 'silver'], [300, 'gold']]),
  { id: 'stadium-5', icon: '🏟', name: '大スタジアム', desc: 'スタジアムをLv.5に拡張', tier: 'silver', group: 'stadium' },
  { id: 'stadium-10', icon: '🏟', name: '聖地', desc: 'スタジアムをLv.10に拡張', tier: 'legend', group: 'stadium' },
  { id: 'stadium-20', icon: '🏟', name: '天空の聖地', desc: 'スタジアムをLv.20に拡張', tier: 'mythic', group: 'stadium' },
  { id: 'facilities', icon: '🏗', name: '最新鋭のクラブ', desc: 'すべての施設をLv.10に', tier: 'legend', group: 'facilities' },
  { id: 'facilities20', icon: '🏰', name: '黄金郷', desc: 'すべての施設をLv.20に', tier: 'mythic', group: 'facilities' },
  { id: 'museum', icon: '🏛', name: 'クラブ博物館', desc: 'クラブ博物館を建てた', tier: 'gold' },
  { id: 'statue-1', icon: '🗿', name: '銅像', desc: '殿堂の選手の銅像を建てた', tier: 'silver', group: 'statue' },
  { id: 'statue-5', icon: '🗿', name: '銅像の並ぶ街', desc: '銅像を5体建てた', tier: 'gold', group: 'statue' },
  { id: 'goldkit', icon: '👑', name: '黄金のユニフォーム', desc: '黄金のユニフォームを手に入れた', tier: 'legend' },
  { id: 'invincible', icon: '🛡', name: '無敗優勝', desc: 'リーグ戦無敗で優勝', tier: 'legend', hidden: true },
  { id: 'double', icon: '👑', name: '二冠', desc: 'リーグとCLを同じシーズンに制覇', tier: 'gold', hidden: true },
  { id: 'legend', icon: '🌟', name: '伝説との契約', desc: 'レジェンド選手を獲得', tier: 'legend', luck: true },
  { id: 'secondGen', icon: '🧬', name: '伝説の再来', desc: '〇〇2世を獲得', tier: 'legend', luck: true, hidden: true },
  { id: 'legendSlayer', icon: '⚔️', name: '伝説を超えた日', desc: 'レジェンドXIに勝利', tier: 'legend', hidden: true },
  { id: 'sode', icon: '⚡', name: '運命の1人', desc: 'ひみつのチームの選手を獲得', tier: 'mythic', luck: true, hidden: true },
  { id: 'sodeSlayer', icon: '⚡', name: '若き才能を倒した', desc: 'ひみつのチームに勝利', tier: 'legend', hidden: true },
  { id: 'gemJackpot', icon: '💎', name: '大当たり', desc: '掘り出し物がとんでもない逸材だった', tier: 'gold', luck: true, hidden: true },
  { id: 'mysteryJackpot', icon: '🃏', name: '怪しい話に乗ってみた', desc: '謎の代理人の選手が大当たり', tier: 'gold', luck: true, hidden: true },
  { id: 'coachSlayer', icon: '🎩', name: '名将越え', desc: '伝説の監督に勝利', tier: 'gold', hidden: true },
  { id: 'aceHeir', icon: '🔟', name: '魂の継承', desc: 'エースナンバーの魂を若手が受け継いだ', tier: 'gold', luck: true, hidden: true },
  { id: 'miracle', icon: '✨', name: '奇跡の夜', desc: '2点差以上をひっくり返して勝利', tier: 'silver', hidden: true },
  { id: 'awaken', icon: '🔥', name: '覚醒の目撃者', desc: '選手の覚醒を目撃', tier: 'silver', luck: true },
  { id: 'golden', icon: '🎓', name: '黄金世代', desc: 'ユースの黄金世代が昇格', tier: 'gold', luck: true },
  // 試合・記録
  { id: 'bigWin', icon: '⚽', name: '大量得点', desc: '5点差以上で勝利', tier: 'silver' },
  { id: 'streak10', icon: '🔥', name: '連勝街道', desc: 'リーグ戦で10連勝', tier: 'gold' },
  { id: 'wall', icon: '🧱', name: '鉄壁', desc: '1シーズンのリーグ失点を20以下に', tier: 'gold' },
  { id: 'points100', icon: '💯', name: '勝ち点100', desc: '1シーズンで勝ち点100以上', tier: 'legend' },
  { id: 'topScorer', icon: '🎯', name: '得点王を輩出', desc: '自分の選手がリーグ得点王に', tier: 'silver' },
  { id: 'goals40', icon: '👟', name: '40ゴールの怪物', desc: '1人の選手が1シーズンで40得点', tier: 'gold' },
  // クラブ運営
  { id: 'billionaire', icon: '💰', name: '億万長者', desc: '資金が1兆円に到達', tier: 'gold' },
  { id: 'miser', icon: '🪙', name: 'ケチの極み', desc: '移籍金を1円も使わずにリーグ優勝', tier: 'legend' },
  { id: 'fullHouse', icon: '🏟', name: '満員御礼', desc: 'Lv.10以上のスタジアムでリーグ優勝', tier: 'legend' },
  { id: 'threeClubs', icon: '🔁', name: '名将のタクト', desc: '3つ以上のクラブでリーグ優勝', tier: 'legend' },
  { id: 'underdog', icon: '⬆️', name: '下剋上', desc: '格★1〜2のクラブでリーグ優勝', tier: 'mythic' },
  { id: 'underdogCL', icon: '🌠', name: '奇跡の戴冠', desc: '格★1〜2のクラブでCL優勝', tier: 'divine', hidden: true },
  // 育成・選手
  { id: 'homegrown90', icon: '🌱', name: '叩き上げ', desc: 'ユース出身の選手が総合値90に到達', tier: 'gold' },
  { id: 'raised', icon: '🌳', name: '育ての親', desc: '15歳から育てた選手が25歳までに総合値90に到達', tier: 'legend' },
  { id: 'ironman', icon: '🧓', name: '鉄人', desc: '38歳以上の選手がリーグ戦に出場', tier: 'silver' },
  { id: 'mentor', icon: '🤝', name: '師弟の絆', desc: '師弟関係が生まれた', tier: 'silver' },
  { id: 'oilMoney', icon: '🛢', name: 'オイルマネー', desc: 'サウジアラビアの超高額オファーを受けた', tier: 'gold', luck: true, hidden: true },
  { id: 'notForSale', icon: '🙅', name: '金では買えない', desc: 'サウジアラビアの超高額オファーを3回断った', tier: 'legend', luck: true, hidden: true },
  { id: 'beloved', icon: '📣', name: '愛されクラブ', desc: '愛称の付いた選手が5人同時に在籍', tier: 'gold' },
  { id: 'camp100', icon: '🏕', name: '鬼コーチ', desc: '特訓キャンプを100回', tier: 'silver' },
  // 運・レア
  { id: 'legend5', icon: '🌟', name: '伝説コレクター', desc: 'レジェンドを5人獲得', tier: 'mythic', luck: true, hidden: true },
  { id: 'heir3', icon: '🧬', name: '血統書つき', desc: '2世を3人獲得', tier: 'legend', luck: true, hidden: true },
  { id: 'sodeTop', icon: '⚡', name: '黄金の世代交代', desc: 'ひみつのチームの上位4人のうち誰かを獲得', tier: 'mythic', luck: true, hidden: true },
  { id: 'jackpot3', icon: '🃏', name: '二度目の賭け', desc: '掘り出し物・謎の代理人の大当たりを合計3回', tier: 'legend', luck: true, hidden: true },
  { id: 'zone', icon: '✨', name: 'ゾーン突入', desc: 'チームがゾーンに入った', tier: 'gold', luck: true, hidden: true },
  // 図鑑・コンプリート
  { id: 'dexLegendAll', icon: '👑', name: 'レジェンド全員集合', desc: '図鑑のレジェンドをすべてそろえた', tier: 'divine', luck: true, hidden: true },
  { id: 'dexSodeAll', icon: '⚡', name: '袖ヶ浦コンプリート', desc: 'ひみつのチームの18人をすべて図鑑にそろえた', tier: 'divine', luck: true, hidden: true },
  { id: 'badges30', icon: '🎖', name: 'バッジ30個', desc: 'バッジを30個集めた', tier: 'legend' },
];

/** 条件を満たしたバッジを記録する（一度取れば消えない） */
export function earnBadge(state: GameState, id: string) {
  state.flags = state.flags ?? {};
  state.flags[`bd-${id}`] = true;
}

export function addCounter(state: GameState, key: string, n = 1): number {
  state.counters = { ...(state.counters ?? {}), [key]: (state.counters?.[key] ?? 0) + n };
  return state.counters[key];
}

export function badgeDef(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/** 自分のバッジを、セーブの記録から数える */
export function computeBadges(state: GameState, level: number, dexCount: number): string[] {
  const out: string[] = [];
  const ach = state.achievements ?? {};
  const hist = state.history ?? [];
  const league = hist.filter((h) => h.rank === 1).length;
  const cl = hist.filter((h) => h.userCl === '優勝').length;
  const add = (group: string, v: number) => {
    for (const b of BADGES) if (b.group === group && v >= Number(b.id.split('-')[1])) out.push(b.id);
  };
  add('league', league);
  add('cl', cl);
  add('level', level);
  add('dex', dexCount);
  add('stadium', state.stadium?.level ?? 0);
  add('statue', state.cosmetics?.statues?.length ?? 0);
  const f = state.facilities ?? {};
  const facs = ['training', 'scout', 'academy', 'medical', 'science', 'analysis'] as const;
  if (facs.every((k) => (f[k] ?? 0) >= 10)) out.push('facilities');
  if (facs.every((k) => (f[k] ?? 0) >= 20)) out.push('facilities20');
  if (state.cosmetics?.museum) out.push('museum');
  if (state.cosmetics?.kits?.includes('gold')) out.push('goldkit');
  for (const id of ['invincible', 'double', 'legend', 'secondGen', 'legendSlayer', 'gemJackpot', 'mysteryJackpot', 'coachSlayer', 'aceHeir', 'miracle', 'awaken', 'golden', 'bigWin', 'mentor']) if (ach[id]) out.push(id);
  const flags = state.flags ?? {};
  if (Object.keys(flags).some((k) => k.startsWith('sode-'))) out.push('sode');
  if (flags.sodeWin) out.push('sodeSlayer');
  for (const k of Object.keys(flags)) if (k.startsWith('bd-') && flags[k]) out.push(k.slice(3));
  // 図鑑から分かるもの
  const dex = Object.values(state.dex ?? {});
  const cat = (c: string) => dex.filter((e) => e.cat === c).length;
  if (cat('legend') >= 5) out.push('legend5');
  if (cat('heir') >= 3) out.push('heir3');
  if (cat('legend') >= LEGENDS.length) out.push('dexLegendAll');
  if (cat('sode') >= SODE_PLAYERS.length) out.push('dexSodeAll');
  if (SODE_PLAYERS.some((p) => p.efo >= 99 && flags[`sode-${p.name}`])) out.push('sodeTop');
  if ((state.counters?.camp ?? 0) >= 100) out.push('camp100');
  if ((state.counters?.jackpot ?? 0) >= 3) out.push('jackpot3');
  const winClubs = new Set(hist.filter((h) => h.rank === 1 && h.club).map((h) => h.club));
  if (winClubs.size >= 3) out.push('threeClubs');
  const uniq = [...new Set(out)];
  if (uniq.length >= 30) uniq.push('badges30');
  return uniq;
}

/** 並べる順（珍しい順）。同じ系統は一番上だけ */
export function sortBadges(ids: string[]): BadgeDef[] {
  const defs = ids.map(badgeDef).filter((b): b is BadgeDef => !!b);
  const best = new Map<string, BadgeDef>();
  const solo: BadgeDef[] = [];
  for (const b of defs) {
    if (!b.group) solo.push(b);
    else if (!best.has(b.group) || TIER_RANK[b.tier] > TIER_RANK[best.get(b.group)!.tier]) best.set(b.group, b);
  }
  return [...solo, ...best.values()].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || Number(!!b.luck) - Number(!!a.luck));
}

/** シーズン終了時の記録系バッジ */
export function seasonBadges(state: GameState, rank: number, row: { ga: number; points: number } | undefined, startRep: number, userCl = '') {
  // ★1〜2（RepStars と同じ基準）
  const smallClub = Math.max(1, Math.min(5, Math.round((startRep - 40) / 12))) <= 2;
  if (userCl === '優勝' && smallClub) earnBadge(state, 'underdogCL');
  if (row && row.ga <= 20) earnBadge(state, 'wall');
  if (row && row.points >= 100) earnBadge(state, 'points100');
  const players = Object.values(state.players);
  const top = players.reduce((a, p) => (p.season.goals > a ? p.season.goals : a), 0);
  const mine = squadOf(state, state.userTeamId);
  if (top > 0 && mine.some((p) => p.season.goals === top)) earnBadge(state, 'topScorer');
  if (mine.some((p) => p.season.goals + p.season.clGoals >= 40)) earnBadge(state, 'goals40');
  if (rank === 1) {
    if (!state.flags?.[`spent-${state.season}`]) earnBadge(state, 'miser');
    if ((state.stadium?.level ?? 0) >= 10) earnBadge(state, 'fullHouse');
    if (smallClub) earnBadge(state, 'underdog');
  }
}

/** 試合後の記録系バッジ */
export function matchBadges(state: GameState, won: boolean, comp: string, used: string[]) {
  if (comp === 'PL') {
    const n = won ? addCounter(state, 'plStreak') : ((state.counters = { ...(state.counters ?? {}), plStreak: 0 }), 0);
    if (n >= 10) earnBadge(state, 'streak10');
  }
  const mine = squadOf(state, state.userTeamId);
  if (comp === 'PL' && used.some((id) => (state.players[id]?.age ?? 0) >= 38)) earnBadge(state, 'ironman');
  if (mine.filter((p) => p.nickname).length >= 5) earnBadge(state, 'beloved');
  if (mine.some((p) => p.academy && overall(p) >= 90)) earnBadge(state, 'homegrown90');
  if (mine.some((p) => p.youth && p.age <= 25 && overall(p) >= 90)) earnBadge(state, 'raised');
  if (state.money >= 6250) earnBadge(state, 'billionaire');
}

/** 移籍金を払った（ケチの極みの判定用） */
export function markSpent(state: GameState, fee: number) {
  if (fee <= 0) return;
  state.flags = state.flags ?? {};
  state.flags[`spent-${state.season}`] = true;
}
