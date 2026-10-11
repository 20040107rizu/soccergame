import { aptitudeMultiplier } from './positions';
import { clamp, gauss } from './rng';
import type { Player, Position, StatKey, Stats } from './types';

export const STAT_KEYS: StatKey[] = [
  'offense', 'ballControl', 'dribbling', 'tightPossession', 'lowPass', 'loftedPass', 'finishing', 'heading',
  'setPiece', 'curl', 'speed', 'acceleration', 'kickingPower', 'jump', 'physical', 'balance', 'stamina',
  'defense', 'ballWinning', 'aggression', 'gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach',
];

export const STAT_LABEL: Record<StatKey, string> = {
  offense: 'オフェンスセンス',
  ballControl: 'ボールコントロール',
  dribbling: 'ドリブル',
  tightPossession: 'ボールキープ',
  lowPass: 'グラウンダーパス',
  loftedPass: 'フライパス',
  finishing: '決定力',
  heading: 'ヘディング',
  setPiece: 'プレースキック',
  curl: 'カーブ',
  speed: 'スピード',
  acceleration: '瞬発力',
  kickingPower: 'キック力',
  jump: 'ジャンプ',
  physical: 'フィジカルコンタクト',
  balance: 'ボディコントロール',
  stamina: 'スタミナ',
  defense: 'ディフェンスセンス',
  ballWinning: 'ボール奪取',
  aggression: 'アグレッシブネス',
  gkAwareness: 'GKセンス',
  gkCatching: 'キャッチング',
  gkClearing: 'クリアリング',
  gkReflexes: 'コラプシング',
  gkReach: 'ディフレクティング',
};

export const STAT_GROUPS: { label: string; keys: StatKey[] }[] = [
  { label: '攻撃', keys: ['offense', 'finishing', 'heading', 'kickingPower', 'curl', 'setPiece'] },
  { label: 'テクニック', keys: ['ballControl', 'dribbling', 'tightPossession'] },
  { label: 'パス', keys: ['lowPass', 'loftedPass'] },
  { label: 'フィジカル', keys: ['speed', 'acceleration', 'physical', 'balance', 'jump', 'stamina'] },
  { label: '守備', keys: ['defense', 'ballWinning', 'aggression'] },
  { label: 'GK', keys: ['gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach'] },
];

export const GK_KEYS: StatKey[] = ['gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach'];

/** 総合値の計算に使う、ポジション別の重み */
export const OVR_WEIGHTS: Record<Position, Partial<Record<StatKey, number>>> = {
  GK: { gkAwareness: 4, gkCatching: 2, gkClearing: 2, gkReflexes: 3, gkReach: 3, jump: 1 },
  CB: { defense: 4, ballWinning: 3, physical: 2, heading: 2, jump: 2, aggression: 1, speed: 1, lowPass: 1 },
  LB: { defense: 2, ballWinning: 2, speed: 2, stamina: 2, acceleration: 1, lowPass: 1, loftedPass: 1, dribbling: 1 },
  RB: { defense: 2, ballWinning: 2, speed: 2, stamina: 2, acceleration: 1, lowPass: 1, loftedPass: 1, dribbling: 1 },
  DMF: { defense: 3, ballWinning: 3, lowPass: 2, stamina: 2, physical: 1, aggression: 1, loftedPass: 1 },
  CMF: { lowPass: 3, ballControl: 2, stamina: 2, loftedPass: 1, offense: 1, defense: 1, tightPossession: 1, ballWinning: 1 },
  LMF: { speed: 2, stamina: 2, dribbling: 2, lowPass: 1, loftedPass: 2, acceleration: 1, ballControl: 1 },
  RMF: { speed: 2, stamina: 2, dribbling: 2, lowPass: 1, loftedPass: 2, acceleration: 1, ballControl: 1 },
  AMF: { lowPass: 2, ballControl: 2, dribbling: 2, offense: 2, tightPossession: 1, finishing: 1, balance: 1 },
  LWF: { speed: 2, acceleration: 2, dribbling: 3, ballControl: 1, offense: 2, finishing: 1, balance: 1 },
  RWF: { speed: 2, acceleration: 2, dribbling: 3, ballControl: 1, offense: 2, finishing: 1, balance: 1 },
  SS: { offense: 2, ballControl: 2, dribbling: 1, finishing: 2, lowPass: 1, acceleration: 1, tightPossession: 1 },
  CF: { finishing: 4, offense: 3, physical: 1, heading: 1, kickingPower: 1, speed: 1, ballControl: 1, acceleration: 1 },
};

export function overallFor(stats: Stats, pos: Position): number {
  const w = OVR_WEIGHTS[pos];
  let sum = 0;
  let total = 0;
  for (const k in w) {
    const key = k as StatKey;
    sum += stats[key] * w[key]!;
    total += w[key]!;
  }
  return Math.round(sum / total);
}

export function overall(p: Player): number {
  return overallFor(p.stats, p.position);
}

/** 指定ポジションでプレーした時の能力（適性込み） */
export function ratingAt(p: Player, pos: Position): number {
  const base = overallFor(p.stats, pos);
  return Math.round(base * aptitudeMultiplier(p.aptitudes[pos], pos, p.position));
}

/* ---------------- プレースタイル ---------------- */

export const STYLES: Record<string, { label: string; pos: Position[]; boost: Partial<Record<StatKey, number>> }> = {
  GKO: { label: '攻撃的GK', pos: ['GK'], boost: { lowPass: 10, loftedPass: 8, speed: 6 } },
  GKD: { label: '守備的GK', pos: ['GK'], boost: { gkReflexes: 2, gkCatching: 2 } },
  BU: { label: 'ビルドアップ', pos: ['CB'], boost: { lowPass: 8, loftedPass: 8, ballControl: 6 } },
  DES: { label: 'デストロイヤー', pos: ['CB', 'DMF'], boost: { ballWinning: 4, aggression: 8, physical: 4 } },
  EF: { label: '攻撃参加', pos: ['CB'], boost: { offense: 10, heading: 4 } },
  OFB: { label: '攻撃的サイドバック', pos: ['LB', 'RB'], boost: { offense: 8, speed: 3, loftedPass: 4 } },
  DFB: { label: '守備的サイドバック', pos: ['LB', 'RB'], boost: { defense: 4, ballWinning: 3 } },
  IFB: { label: 'インナーラップサイドバック', pos: ['LB', 'RB'], boost: { lowPass: 6, ballControl: 4 } },
  ANC: { label: 'アンカー', pos: ['DMF'], boost: { defense: 4, lowPass: 3 } },
  ORC: { label: 'オーケストレーター', pos: ['CMF', 'DMF'], boost: { lowPass: 6, loftedPass: 6, ballControl: 3 } },
  B2B: { label: 'ボックストゥボックス', pos: ['CMF', 'DMF'], boost: { stamina: 8, ballWinning: 4, offense: 3 } },
  HOLE: { label: '2列目からの飛び出し', pos: ['CMF', 'AMF'], boost: { offense: 6, finishing: 4 } },
  C10: { label: 'クラシックNo.10', pos: ['AMF', 'SS'], boost: { ballControl: 5, lowPass: 5, speed: -4 } },
  CPM: { label: 'チャンスメイカー', pos: ['AMF', 'SS', 'CMF'], boost: { lowPass: 6, dribbling: 4 } },
  PW: { label: 'プロリフィックウインガー', pos: ['LWF', 'RWF'], boost: { dribbling: 4, finishing: 5 } },
  RF: { label: 'ローミングフランク', pos: ['LWF', 'RWF', 'LMF', 'RMF'], boost: { dribbling: 5, ballControl: 4 } },
  CS: { label: 'クロサー', pos: ['LMF', 'RMF', 'LB', 'RB', 'RWF', 'LWF'], boost: { loftedPass: 8, curl: 6 } },
  GP: { label: 'ゴールハンター', pos: ['CF'], boost: { finishing: 4, offense: 5, acceleration: 3 } },
  FOX: { label: 'ボックスストライカー', pos: ['CF'], boost: { finishing: 5, heading: 3, speed: -4 } },
  TM: { label: 'ターゲットマン', pos: ['CF'], boost: { heading: 8, physical: 8, jump: 6, speed: -5 } },
  DLF: { label: 'ディープライイングフォワード', pos: ['CF', 'SS'], boost: { lowPass: 6, ballControl: 5 } },
  DR: { label: 'ダミーランナー', pos: ['CF', 'SS'], boost: { offense: 6, acceleration: 4, speed: 3 } },
};

export function defaultStyle(pos: Position): string {
  switch (pos) {
    case 'GK':
      return 'GKD';
    case 'CB':
      return 'BU';
    case 'LB':
    case 'RB':
      return 'OFB';
    case 'DMF':
      return 'ANC';
    case 'CMF':
      return 'B2B';
    case 'LMF':
    case 'RMF':
      return 'CS';
    case 'AMF':
      return 'CPM';
    case 'LWF':
    case 'RWF':
      return 'PW';
    case 'SS':
      return 'DLF';
    default:
      return 'GP';
  }
}

/* ---------------- 特殊スキル ---------------- */

export const SKILLS: { id: string; label: string; cat: 'dribble' | 'shoot' | 'pass' | 'defense' | 'gk' | 'other' }[] = [
  { id: 'scissors', label: 'シザーズフェイント', cat: 'dribble' },
  { id: 'doubleTouch', label: 'ダブルタッチ', cat: 'dribble' },
  { id: 'flipFlap', label: 'エラシコ', cat: 'dribble' },
  { id: 'marseille', label: 'マルセイユルーレット', cat: 'dribble' },
  { id: 'sombrero', label: 'ソンブレロ', cat: 'dribble' },
  { id: 'cutBehind', label: '軸裏ターン', cat: 'dribble' },
  { id: 'soleControl', label: 'ソールコントロール', cat: 'dribble' },
  { id: 'heading', label: 'ヘディング', cat: 'shoot' },
  { id: 'longCurler', label: 'ロングレンジカーブ', cat: 'shoot' },
  { id: 'chipShot', label: 'ループシュート', cat: 'shoot' },
  { id: 'knuckle', label: 'ドライブシュート', cat: 'shoot' },
  { id: 'longShot', label: 'ロングシュート', cat: 'shoot' },
  { id: 'acrobatic', label: 'アクロバティックシュート', cat: 'shoot' },
  { id: 'firstTime', label: 'ダイレクトシュート', cat: 'shoot' },
  { id: 'pkTaker', label: 'PKキッカー', cat: 'shoot' },
  { id: 'oneTouch', label: 'ワンタッチパス', cat: 'pass' },
  { id: 'throughPass', label: 'スルーパス', cat: 'pass' },
  { id: 'weightedPass', label: 'ウェイテッドパス', cat: 'pass' },
  { id: 'pinpointCross', label: 'ピンポイントクロス', cat: 'pass' },
  { id: 'outsideCurler', label: 'アウトサイドカーブ', cat: 'pass' },
  { id: 'noLook', label: 'ノールックパス', cat: 'pass' },
  { id: 'manMarking', label: 'マンマーク', cat: 'defense' },
  { id: 'interception', label: 'インターセプト', cat: 'defense' },
  { id: 'blocker', label: 'ブロッカー', cat: 'defense' },
  { id: 'aerial', label: 'エアバトル', cat: 'defense' },
  { id: 'sliding', label: 'スライディングタックル', cat: 'defense' },
  { id: 'acroClear', label: 'アクロバティッククリア', cat: 'defense' },
  { id: 'trackBack', label: '戻りディフェンス', cat: 'defense' },
  { id: 'gkLongThrow', label: 'GKロングスロー', cat: 'gk' },
  { id: 'gkPenalty', label: 'GKペナルティセーバー', cat: 'gk' },
  { id: 'captaincy', label: 'キャプテンシー', cat: 'other' },
  { id: 'superSub', label: 'スーパーサブ', cat: 'other' },
  { id: 'fighting', label: '闘争心', cat: 'other' },
];

export const SKILL_LABEL: Record<string, string> = Object.fromEntries(SKILLS.map((s) => [s.id, s.label]));

/* ---------------- 能力値の生成 ---------------- */

/** ポジション別の能力の傾向（総合値からの差） */
const PROFILE: Record<Position, Partial<Record<StatKey, number>>> = {
  GK: { offense: -40, ballControl: -25, dribbling: -30, tightPossession: -25, lowPass: -15, loftedPass: -15, finishing: -40, heading: -30, setPiece: -30, curl: -30, speed: -20, acceleration: -15, kickingPower: -5, jump: -5, physical: -10, balance: -15, stamina: -25, defense: -40, ballWinning: -40, aggression: -30 },
  CB: { offense: -25, ballControl: -12, dribbling: -18, tightPossession: -12, lowPass: -8, loftedPass: -10, finishing: -30, heading: 0, setPiece: -25, curl: -25, speed: -8, acceleration: -10, kickingPower: -8, jump: 0, physical: 2, balance: -8, stamina: -6, defense: 3, ballWinning: 2, aggression: -2 },
  LB: { offense: -12, ballControl: -8, dribbling: -8, tightPossession: -12, lowPass: -5, loftedPass: -3, finishing: -25, heading: -15, setPiece: -18, curl: -10, speed: 2, acceleration: 0, kickingPower: -10, jump: -12, physical: -8, balance: -4, stamina: 3, defense: -2, ballWinning: -2, aggression: -8 },
  RB: {},
  DMF: { offense: -15, ballControl: -6, dribbling: -10, tightPossession: -6, lowPass: 0, loftedPass: -4, finishing: -22, heading: -10, setPiece: -18, curl: -15, speed: -10, acceleration: -10, kickingPower: -6, jump: -8, physical: -2, balance: -4, stamina: 0, defense: 1, ballWinning: 2, aggression: -4 },
  CMF: { offense: -6, ballControl: 0, dribbling: -6, tightPossession: -2, lowPass: 2, loftedPass: -2, finishing: -12, heading: -16, setPiece: -12, curl: -10, speed: -8, acceleration: -6, kickingPower: -6, jump: -14, physical: -10, balance: -4, stamina: 0, defense: -8, ballWinning: -6, aggression: -10 },
  LMF: { offense: -6, ballControl: -2, dribbling: 0, tightPossession: -10, lowPass: -4, loftedPass: 0, finishing: -12, heading: -20, setPiece: -12, curl: -6, speed: 0, acceleration: -2, kickingPower: -8, jump: -18, physical: -15, balance: -2, stamina: 0, defense: -18, ballWinning: -18, aggression: -14 },
  RMF: {},
  AMF: { offense: -2, ballControl: 1, dribbling: 0, tightPossession: -3, lowPass: 0, loftedPass: -6, finishing: -6, heading: -20, setPiece: -10, curl: -6, speed: -8, acceleration: -4, kickingPower: -6, jump: -20, physical: -16, balance: 0, stamina: -8, defense: -30, ballWinning: -28, aggression: -18 },
  LWF: { offense: -2, ballControl: -2, dribbling: 1, tightPossession: -8, lowPass: -8, loftedPass: -10, finishing: -6, heading: -20, setPiece: -14, curl: -6, speed: 1, acceleration: 0, kickingPower: -6, jump: -20, physical: -18, balance: 0, stamina: -8, defense: -35, ballWinning: -32, aggression: -18 },
  RWF: {},
  SS: { offense: 1, ballControl: 0, dribbling: -2, tightPossession: -1, lowPass: -4, loftedPass: -10, finishing: 0, heading: -14, setPiece: -12, curl: -8, speed: -6, acceleration: -2, kickingPower: -4, jump: -16, physical: -12, balance: -2, stamina: -10, defense: -35, ballWinning: -32, aggression: -18 },
  CF: { offense: 1, ballControl: -4, dribbling: -6, tightPossession: -4, lowPass: -12, loftedPass: -18, finishing: 1, heading: -6, setPiece: -18, curl: -12, speed: -4, acceleration: -4, kickingPower: 0, jump: -6, physical: -6, balance: -6, stamina: -10, defense: -40, ballWinning: -36, aggression: -14 },
};
PROFILE.RB = PROFILE.LB;
PROFILE.RMF = PROFILE.LMF;
PROFILE.RWF = PROFILE.LWF;

/** 文字列から決まる疑似乱数（同じ選手は毎回同じ能力になる） */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function gaussFrom(r: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 総合値・ポジション・スタイルから 25 項目の能力値を作る */
export function generateStats(pos: Position, target: number, style: string, rand: () => number = Math.random): Stats {
  const prof = PROFILE[pos];
  const boost = STYLES[style]?.boost ?? {};
  const g = rand === Math.random ? gauss : () => gaussFrom(rand);
  const s = {} as Stats;
  for (const k of STAT_KEYS) {
    let base = target + (prof[k] ?? (GK_KEYS.includes(k) ? -40 : 0)) + (boost[k] ?? 0) + g() * 3.5;
    if (pos !== 'GK' && GK_KEYS.includes(k)) base = 40 + g() * 4;
    s[k] = base;
  }
  // 総合値が目標に合うよう、重みのある項目を中心に調整
  for (let i = 0; i < 4; i++) {
    const cur = overallFor(roundStats(s), pos);
    const diff = target - cur;
    if (diff === 0) break;
    for (const k of STAT_KEYS) {
      if (pos !== 'GK' && GK_KEYS.includes(k)) continue;
      const weighted = OVR_WEIGHTS[pos][k] !== undefined;
      s[k] += diff * (weighted ? 1 : 0.5);
    }
  }
  return roundStats(s);
}

function roundStats(s: Stats): Stats {
  const r = {} as Stats;
  for (const k of STAT_KEYS) r[k] = clamp(Math.round(s[k]), 35, 99);
  return r;
}

/** 能力値から特殊スキルを自動で付ける（実在選手・自動生成選手用） */
export function autoSkills(stats: Stats, pos: Position, style: string, rand: () => number = Math.random): string[] {
  const sk: string[] = [];
  const add = (id: string, cond: boolean, p = 0.75) => {
    if (cond && rand() < p) sk.push(id);
  };
  const s = stats;
  add('scissors', s.dribbling >= 82);
  add('doubleTouch', s.dribbling >= 85 && s.ballControl >= 84);
  add('flipFlap', s.dribbling >= 88, 0.5);
  add('marseille', s.ballControl >= 86 && s.tightPossession >= 82, 0.5);
  add('cutBehind', s.ballControl >= 84);
  add('soleControl', s.tightPossession >= 85);
  add('heading', s.heading >= 82);
  add('longCurler', s.curl >= 82 && s.finishing >= 75);
  add('chipShot', s.finishing >= 82, 0.5);
  add('knuckle', s.kickingPower >= 86, 0.5);
  add('longShot', s.kickingPower >= 84 && s.finishing >= 78);
  add('acrobatic', s.finishing >= 86 && s.balance >= 80, 0.5);
  add('firstTime', s.finishing >= 84);
  add('pkTaker', s.setPiece >= 82 && s.finishing >= 75, 0.5);
  add('oneTouch', s.lowPass >= 82);
  add('throughPass', s.lowPass >= 84 && s.offense >= 70);
  add('weightedPass', s.loftedPass >= 84);
  add('pinpointCross', s.loftedPass >= 82 && s.curl >= 78 && pos !== 'CB');
  add('outsideCurler', s.curl >= 86, 0.4);
  add('noLook', s.lowPass >= 88, 0.4);
  add('manMarking', s.defense >= 82 && pos !== 'GK');
  add('interception', s.defense >= 80 && s.ballWinning >= 78);
  add('blocker', s.defense >= 82 && (pos === 'CB' || pos === 'DMF'));
  add('aerial', s.heading >= 80 && s.jump >= 80);
  add('sliding', s.ballWinning >= 84, 0.6);
  add('acroClear', s.defense >= 84 && pos === 'CB', 0.5);
  add('trackBack', s.stamina >= 82 && s.defense >= 60 && pos !== 'CB', 0.6);
  add('gkLongThrow', pos === 'GK' && s.gkClearing >= 80);
  add('gkPenalty', pos === 'GK' && s.gkReflexes >= 84, 0.5);
  add('fighting', s.aggression >= 82, 0.5);
  if (style === 'TM' && !sk.includes('heading')) sk.push('heading');
  if (style === 'CS' && !sk.includes('pinpointCross')) sk.push('pinpointCross');
  return sk.slice(0, 10);
}
