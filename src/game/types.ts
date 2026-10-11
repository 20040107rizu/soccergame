export type Position = 'GK' | 'CB' | 'SB' | 'DMF' | 'CMF' | 'OMF' | 'WG' | 'CF';

export const POSITIONS: Position[] = ['GK', 'CB', 'SB', 'DMF', 'CMF', 'OMF', 'WG', 'CF'];

export const POSITION_LABEL: Record<Position, string> = {
  GK: 'GK',
  CB: 'CB',
  SB: 'SB',
  DMF: 'DMF',
  CMF: 'CMF',
  OMF: 'OMF',
  WG: 'WG',
  CF: 'CF',
};

/** 能力値（40〜99） */
export interface Stats {
  offense: number; // オフェンスセンス
  defense: number; // ディフェンスセンス
  speed: number; // スピード
  stamina: number; // スタミナ
  dribble: number; // ドリブル
  pass: number; // パス
  shoot: number; // シュート
  physical: number; // フィジカル
  keeper: number; // GK能力
}

export type StatKey = keyof Stats;

export const STAT_KEYS: StatKey[] = [
  'offense',
  'defense',
  'speed',
  'stamina',
  'dribble',
  'pass',
  'shoot',
  'physical',
  'keeper',
];

export const STAT_LABEL: Record<StatKey, string> = {
  offense: 'オフェンス',
  defense: 'ディフェンス',
  speed: 'スピード',
  stamina: 'スタミナ',
  dribble: 'ドリブル',
  pass: 'パス',
  shoot: 'シュート',
  physical: 'フィジカル',
  keeper: 'GK',
};

/** 成長タイプ（マスターリーグの早熟/晩成をイメージ） */
export type GrowthType = 'early' | 'normal' | 'late';

export const GROWTH_LABEL: Record<GrowthType, string> = {
  early: '早熟',
  normal: '標準',
  late: '晩成',
};

export interface Appearance {
  skin: number; // 0..4
  hairStyle: number; // 0..5
  hairColor: number; // 0..5
}

export interface Player {
  id: string;
  name: string;
  nationality: string;
  age: number;
  position: Position;
  foot: 'R' | 'L';
  number: number;
  stats: Stats;
  /** 能力の上限の目安（総合値ベース、ユーザーには伏せる） */
  potential: number;
  growth: GrowthType;
  appearance: Appearance;
  teamId: string | null; // null = フリー
  contractYears: number;
  salary: number; // 1シーズンあたりのポイント
  /** 今季の記録 */
  season: { apps: number; goals: number; assists: number };
  /** 通算 */
  career: { apps: number; goals: number; assists: number };
  /** ユーザーが作成・エディットした選手か */
  custom?: boolean;
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  color2: string;
  formation: Formation;
  /** スタメン11人（フォーメーションの枠順） */
  lineup: string[];
}

export interface Fixture {
  round: number;
  home: string;
  away: string;
  result?: { home: number; away: number };
}

export interface StandingRow {
  teamId: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  points: number;
}

export interface NewsItem {
  id: string;
  season: number;
  round: number;
  text: string;
}

export interface GameState {
  version: number;
  createdAt: number;
  updatedAt: number;
  managerName: string;
  userTeamId: string;
  season: number; // 1年目, 2年目...
  round: number; // 次に行う節（0始まり）
  points: number; // マスターリーグのポイント（予算）
  teams: Team[];
  players: Record<string, Player>;
  fixtures: Fixture[];
  news: NewsItem[];
  history: { season: number; rank: number; champion: string }[];
}
