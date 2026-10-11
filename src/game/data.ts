import { fairSalary, overallFor, autoLineup } from './rating';
import { clamp, gauss, pick, rand, randInt, uid } from './rng';
import type { GameState, GrowthType, Player, Position, Stats, Team } from './types';
import { makeSchedule } from './season';

/**
 * 初期データ。いまは架空のクラブ・選手。
 * エディット画面や JSON インポートで実在の名前に置き換えられる。
 */
export const DEFAULT_TEAMS: Omit<Team, 'lineup'>[] = [
  { id: 't1', name: 'トーキョー・ブルーウイング', short: 'TBW', color: '#1d4ed8', color2: '#ffffff', formation: '4-3-3' },
  { id: 't2', name: 'オオサカ・レッドファイア', short: 'ORF', color: '#dc2626', color2: '#111111', formation: '4-4-2' },
  { id: 't3', name: 'ヨコハマ・マリナーズFC', short: 'YMF', color: '#0ea5e9', color2: '#f8fafc', formation: '4-2-3-1' },
  { id: 't4', name: 'ナゴヤ・グランパスター', short: 'NGS', color: '#ea580c', color2: '#fde68a', formation: '4-4-2' },
  { id: 't5', name: 'サッポロ・ノーススター', short: 'SNS', color: '#111827', color2: '#ef4444', formation: '3-5-2' },
  { id: 't6', name: 'フクオカ・アビスパーク', short: 'FAP', color: '#4338ca', color2: '#cbd5e1', formation: '4-3-3' },
  { id: 't7', name: 'センダイ・ゴールデンイーグル', short: 'SGE', color: '#ca8a04', color2: '#1e3a8a', formation: '4-2-3-1' },
  { id: 't8', name: 'ヒロシマ・パープルアローズ', short: 'HPA', color: '#7c3aed', color2: '#f5f3ff', formation: '3-5-2' },
];

const FIRST = ['アンドレ', 'ヴィクトル', 'セルゲイ', 'エミル', 'ディエゴ', 'パオロ', 'ハビエル', 'ジェローム', 'ロッシ', 'カッツ', 'サンドロ', 'マルコ', 'ルーカス', 'ダニエル', 'ユーリ', 'アラン', 'ペドロ', 'トマス', 'ケンタ', 'ショウ', 'リク', 'ハヤト', 'ソラ', 'レオ', 'ノア', 'イーサン', 'マテオ', 'ラファ', 'ファビオ', 'ニコ', 'オスカル', 'ジャン', 'ミゲル', 'カイ', 'ユウマ', 'タクミ'];
const LAST = ['ベルナルド', 'カステロ', 'ミュラー', 'シルヴァ', 'フェレイラ', 'モレッティ', 'ガルシア', 'ロペス', 'ヤマダ', 'サトウ', 'タナカ', 'スズキ', 'ナカムラ', 'コバヤシ', 'ドゥボワ', 'ヤンセン', 'ノヴァク', 'ペトロフ', 'オルセン', 'ブラウン', 'カルバハル', 'ルッソ', 'コスタ', 'メンデス', 'ハートマン', 'ワグナー', 'ゴメス', 'フィッシャー', 'アンドラーデ', 'ベッカー', 'イトウ', 'ワタナベ', 'オカダ', 'モリ', 'クロース', 'ヴェルデ'];
const NATIONS = ['日本', '日本', '日本', 'ブラジル', 'アルゼンチン', 'スペイン', 'イタリア', 'ドイツ', 'フランス', 'オランダ', 'イングランド', 'ポルトガル', '韓国', 'クロアチア'];

export function randomName(): string {
  return `${pick(FIRST)}・${pick(LAST)}`;
}

/** ポジションごとに伸ばす能力の傾向 */
const PROFILE: Record<Position, Partial<Stats>> = {
  GK: { keeper: 14, physical: 4, offense: -20, shoot: -22, dribble: -18, speed: -8 },
  CB: { defense: 12, physical: 10, offense: -10, shoot: -10, dribble: -8, keeper: -40 },
  SB: { defense: 6, speed: 8, stamina: 8, shoot: -8, keeper: -40 },
  DMF: { defense: 8, pass: 6, stamina: 6, physical: 4, shoot: -6, keeper: -40 },
  CMF: { pass: 10, stamina: 6, dribble: 2, keeper: -40 },
  OMF: { pass: 8, dribble: 8, offense: 6, defense: -12, keeper: -40 },
  WG: { speed: 10, dribble: 10, offense: 4, defense: -12, physical: -4, keeper: -40 },
  CF: { shoot: 12, offense: 10, physical: 4, defense: -16, keeper: -40 },
};

export function generateStats(pos: Position, level: number): Stats {
  const prof = PROFILE[pos];
  const s = (k: keyof Stats) => clamp(Math.round(level + (prof[k] ?? 0) + gauss() * 5), 30, 99);
  return {
    offense: s('offense'),
    defense: s('defense'),
    speed: s('speed'),
    stamina: s('stamina'),
    dribble: s('dribble'),
    pass: s('pass'),
    shoot: s('shoot'),
    physical: s('physical'),
    keeper: s('keeper'),
  };
}

export function generatePlayer(opts: {
  position: Position;
  level: number;
  age?: number;
  teamId: string | null;
  number?: number;
}): Player {
  const age = opts.age ?? randInt(18, 33);
  const growth: GrowthType = pick(['early', 'normal', 'normal', 'late']);
  // 若いほど伸びしろが大きい
  const youthBonus = Math.max(0, 27 - age) * randInt(1, 3) * 0.6;
  const stats = generateStats(opts.position, opts.level);
  const ovr = overallFor(stats, opts.position);
  const p: Player = {
    id: uid('p'),
    name: randomName(),
    nationality: pick(NATIONS),
    age,
    position: opts.position,
    foot: rand() < 0.75 ? 'R' : 'L',
    number: opts.number ?? randInt(2, 40),
    stats,
    potential: clamp(Math.round(ovr + youthBonus + rand() * 4), ovr, 97),
    growth,
    appearance: { skin: randInt(0, 4), hairStyle: randInt(0, 5), hairColor: randInt(0, 5) },
    teamId: opts.teamId,
    contractYears: randInt(1, 4),
    salary: 0,
    season: { apps: 0, goals: 0, assists: 0 },
    career: { apps: 0, goals: 0, assists: 0 },
  };
  p.salary = fairSalary(p);
  return p;
}

/** 1クラブの選手構成（22人） */
const SQUAD_TEMPLATE: Position[] = [
  'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'SB', 'SB', 'SB', 'DMF', 'DMF',
  'CMF', 'CMF', 'CMF', 'OMF', 'OMF', 'WG', 'WG', 'WG', 'CF', 'CF', 'CF',
];

export function generateSquad(teamId: string, level: number): Player[] {
  const used = new Set<number>();
  return SQUAD_TEMPLATE.map((pos, i) => {
    let num = pos === 'GK' && i === 0 ? 1 : randInt(2, 40);
    while (used.has(num)) num = randInt(2, 99);
    used.add(num);
    // 先頭のレギュラー格は少し強く
    const lv = level + (i % 2 === 0 ? 3 : -3) + gauss() * 3;
    return generatePlayer({ position: pos, level: lv, teamId, number: num });
  });
}

/** マスターリーグ恒例の「弱小スタート」。ユーザーのクラブは控えめな戦力から始まる */
export function newGame(managerName: string, userTeamId: string): GameState {
  const players: Record<string, Player> = {};
  const teams: Team[] = DEFAULT_TEAMS.map((t, i) => {
    const level = t.id === userTeamId ? 53 : 54 + (i % 4) * 1.5 + randInt(0, 2);
    const squad = generateSquad(t.id, level);
    for (const p of squad) players[p.id] = p;
    return { ...t, lineup: autoLineup(squad, t.formation) };
  });
  // フリー選手（移籍市場）
  for (let i = 0; i < 30; i++) {
    const p = generatePlayer({ position: pick(SQUAD_TEMPLATE), level: 46 + randInt(0, 14), teamId: null });
    players[p.id] = p;
  }
  const now = Date.now();
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    managerName,
    userTeamId,
    season: 1,
    round: 0,
    points: 12000,
    teams,
    players,
    fixtures: makeSchedule(teams.map((t) => t.id)),
    news: [
      { id: uid('n'), season: 1, round: 0, text: `${managerName}監督が就任。シーズン1が開幕！` },
    ],
    history: [],
  };
}
