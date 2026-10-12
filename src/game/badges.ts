import type { GameState } from './types';

/** バッジのレア度（右ほど珍しい） */
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'legend' | 'mythic';

export const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'ノーマル',
  silver: 'レア',
  gold: 'スーパーレア',
  legend: 'レジェンド',
  mythic: 'ミシック',
};
const TIER_RANK: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2, legend: 3, mythic: 4 };

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
  { id: 'stadium-10', icon: '🏟', name: '聖地', desc: 'スタジアムを最大まで拡張', tier: 'legend', group: 'stadium' },
  { id: 'facilities', icon: '🏗', name: '最新鋭のクラブ', desc: 'すべての施設を最大レベルに', tier: 'legend' },
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
];

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
  if ((['training', 'scout', 'academy', 'medical', 'science', 'analysis'] as const).every((k) => (f[k] ?? 0) >= 10)) out.push('facilities');
  if (state.cosmetics?.museum) out.push('museum');
  if (state.cosmetics?.kits?.includes('gold')) out.push('goldkit');
  for (const id of ['invincible', 'double', 'legend', 'secondGen', 'legendSlayer', 'gemJackpot', 'mysteryJackpot', 'coachSlayer', 'aceHeir', 'miracle', 'awaken', 'golden']) if (ach[id]) out.push(id);
  const flags = state.flags ?? {};
  if (Object.keys(flags).some((k) => k.startsWith('sode-'))) out.push('sode');
  if (flags.sodeWin) out.push('sodeSlayer');
  return out;
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
