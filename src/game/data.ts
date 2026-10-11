import { EU1 } from '../data/eu1';
import { EU2 } from '../data/eu2';
import type { ClubSeed } from '../data/format';
import { PL1 } from '../data/pl1';
import { PL2 } from '../data/pl2';
import { fairSalary } from './economy';
import { NEIGHBORS } from './positions';
import { clamp, pick, rand, randInt, uid } from './rng';
import { autoSkills, defaultStyle, generateStats, overallFor, seededRandom } from './stats';
import type { Aptitudes, Condition, GrowthType, Player, Position, Team } from './types';
import { POSITIONS } from './types';

export const PL_SEEDS: ClubSeed[] = [...PL1, ...PL2];
export const EU_SEEDS: ClubSeed[] = [...EU1, ...EU2];

/** 2026-27 CL リーグフェーズの出場クラブ（ポット順） */
export const CL_2026: string[] = [
  // Pot 1
  'psg', 'fcb', 'rma', 'liv', 'int', 'mci', 'ars', 'bar', 'atm',
  // Pot 2
  'bvb', 'rom', 'scp', 'avl', 'fcp', 'mun', 'cbr', 'bet', 'psv',
  // Pot 3
  'fey', 'lil', 'nap', 'rbl', 'vil', 'sha', 'gal', 'fen', 'bod',
  // Pot 4
  'vik', 'sla', 'vfb', 'aek', 'las', 'com', 'len', 'sab', 'slo',
];

export function emptyStats() {
  return { apps: 0, goals: 0, assists: 0, clApps: 0, clGoals: 0 };
}

function growthFromAge(age: number, r: () => number): GrowthType {
  const x = r();
  if (age <= 22) return x < 0.3 ? 'early' : x < 0.75 ? 'normal' : 'late';
  return x < 0.25 ? 'early' : x < 0.8 ? 'normal' : 'late';
}

function potentialFor(ovr: number, age: number, r: () => number): number {
  const bonus = age <= 18 ? 12 : age <= 20 ? 9 : age <= 22 ? 6 : age <= 24 ? 3 : age <= 26 ? 1 : 0;
  return clamp(Math.round(ovr + bonus + r() * (bonus > 0 ? 6 : 1)), ovr, 97);
}

/** 初期データ 1 行から選手を作る */
export function playerFromSeed(line: string, teamId: string): Player {
  const [num, name, nameEn, pos, subs, age, nat, ovr, style, foot] = line.split('|');
  const position = pos as Position;
  const r = seededRandom(nameEn + name);
  const aptitudes: Aptitudes = { [position]: 3 };
  for (const s of (subs || '').split(',').filter(Boolean)) aptitudes[s as Position] = 2;
  const st = style || defaultStyle(position);
  const target = Number(ovr);
  const stats = generateStats(position, target, st, r);
  const a = Number(age);
  const p: Player = {
    id: 'r_' + teamId + '_' + nameEn.replace(/[^A-Za-z]/g, '').slice(0, 16) + num,
    name,
    nameEn,
    nationality: nat,
    age: a,
    position,
    aptitudes,
    foot: foot === 'L' ? 'L' : 'R',
    number: Number(num),
    stats,
    traits: {
      weakFootUse: 1 + Math.floor(r() * 4),
      weakFootAcc: 1 + Math.floor(r() * 4),
      form: clamp(Math.round(3 + (target - 70) / 6 + r() * 3), 2, 8),
      injuryRes: 1 + Math.floor(r() * 3),
    },
    skills: autoSkills(stats, position, st, r),
    style: st,
    potential: potentialFor(target, a, r),
    growth: growthFromAge(a, r),
    teamId,
    contractYears: 1 + Math.floor(r() * 5),
    salary: 0,
    condition: (2 + Math.floor(r() * 3)) as Condition,
    injury: 0,
    suspension: 0,
    ambition: Math.round(30 + r() * 70),
    loyalty: Math.round(r() * 100),
    season: emptyStats(),
    career: emptyStats(),
    real: true,
  };
  p.salary = fairSalary(p);
  return p;
}

export function teamFromSeed(seed: ClubSeed): Team {
  return {
    id: seed.id,
    name: seed.name,
    en: seed.en,
    short: seed.short,
    color: seed.color,
    color2: seed.color2,
    rep: seed.rep,
    country: seed.country,
    league: seed.league,
    formation: '4-3-3',
    tactic: 'balance',
    lineup: [],
    bench: [],
    budget: seed.budget,
  };
}

/* ---------------- 架空の選手（新人・オリジナルチーム） ---------------- */

const FIRST = ['アンドレ', 'ヴィクトル', 'セルゲイ', 'エミル', 'ディエゴ', 'パオロ', 'ハビエル', 'ジェローム', 'サンドロ', 'マルコ', 'ルーカス', 'ダニエル', 'ユーリ', 'アラン', 'ペドロ', 'トマス', 'レオ', 'ノア', 'イーサン', 'マテオ', 'ラファ', 'ファビオ', 'ニコ', 'オスカル', 'ジャン', 'ミゲル', 'カイ', 'ケンタ', 'ショウ', 'リク', 'ハヤト', 'ソラ', 'タクミ', 'ユウマ'];
const LAST = ['ベルナルド', 'カステロ', 'ミュラー', 'シウヴァ', 'フェレイラ', 'モレッティ', 'ガルシア', 'ロペス', 'ドゥボワ', 'ヤンセン', 'ノヴァク', 'ペトロフ', 'オルセン', 'ブラウン', 'カルバハル', 'ルッソ', 'コスタ', 'メンデス', 'ハートマン', 'ワグナー', 'ゴメス', 'フィッシャー', 'アンドラーデ', 'ベッカー', 'ヤマダ', 'サトウ', 'タナカ', 'スズキ', 'ナカムラ', 'コバヤシ', 'クロース', 'ヴェルデ', 'リベイロ', 'サンタナ'];
const NATIONS = ['イングランド', 'イングランド', 'スペイン', 'フランス', 'ドイツ', 'イタリア', 'ブラジル', 'アルゼンチン', 'オランダ', 'ポルトガル', 'ベルギー', '日本', 'ナイジェリア', 'デンマーク', 'クロアチア'];

export function randomName(): string {
  return `${pick(FIRST)}・${pick(LAST)}`;
}

/** 架空の選手を作る */
export function generatePlayer(opts: { position: Position; level: number; age?: number; teamId: string | null; number?: number; custom?: boolean }): Player {
  const age = opts.age ?? randInt(18, 32);
  const style = defaultStyle(opts.position);
  const stats = generateStats(opts.position, Math.round(opts.level), style);
  const ovr = overallFor(stats, opts.position);
  const aptitudes: Aptitudes = { [opts.position]: 3 };
  for (const n of NEIGHBORS[opts.position]) if (rand() < 0.3) aptitudes[n] = rand() < 0.5 ? 2 : 1;
  const p: Player = {
    id: uid('p'),
    name: randomName(),
    nameEn: '',
    nationality: pick(NATIONS),
    age,
    position: opts.position,
    aptitudes,
    foot: rand() < 0.75 ? 'R' : 'L',
    number: opts.number ?? randInt(2, 40),
    stats,
    traits: { weakFootUse: randInt(1, 3), weakFootAcc: randInt(1, 3), form: randInt(3, 6), injuryRes: randInt(1, 3) },
    skills: autoSkills(stats, opts.position, style),
    style,
    potential: potentialFor(ovr, age, rand),
    growth: growthFromAge(age, rand),
    teamId: opts.teamId,
    contractYears: randInt(1, 4),
    salary: 0,
    condition: 3,
    injury: 0,
    suspension: 0,
    ambition: randInt(20, 90),
    loyalty: randInt(10, 90),
    season: emptyStats(),
    career: emptyStats(),
    custom: opts.custom,
    appearance: { skin: randInt(0, 4), hairStyle: randInt(0, 5), hairColor: randInt(0, 5) },
  };
  p.salary = fairSalary(p);
  return p;
}

/** オリジナルチームの初期メンバー構成 */
export const ORIGINAL_TEMPLATE: Position[] = [
  'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'RB', 'LB', 'DMF', 'DMF', 'CMF', 'CMF', 'CMF',
  'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF', 'CF',
];

export function generateOriginalSquad(teamId: string, level = 71): Player[] {
  return ORIGINAL_TEMPLATE.map((pos, i) => {
    const p = generatePlayer({ position: pos, level: level + randInt(-4, 4), teamId, number: i + 1, custom: true });
    p.contractYears = 3;
    return p;
  });
}

export function isPosition(x: string): x is Position {
  return (POSITIONS as string[]).includes(x);
}
