export type Position = 'GK' | 'LSB' | 'CB' | 'RSB' | 'DMF' | 'CMF' | 'OMF' | 'LMF' | 'RMF' | 'LWG' | 'RWG' | 'ST' | 'CF';

export const POSITIONS: Position[] = ['GK', 'LSB', 'CB', 'RSB', 'DMF', 'CMF', 'OMF', 'LMF', 'RMF', 'LWG', 'RWG', 'ST', 'CF'];

/** eFootball の能力値 26 項目 */
export interface Stats {
  offense: number; // オフェンスセンス
  ballControl: number; // ボールコントロール
  dribbling: number; // ドリブル
  tightPossession: number; // ボールキープ
  lowPass: number; // グラウンダーパス
  loftedPass: number; // フライパス
  finishing: number; // 決定力
  heading: number; // ヘディング
  setPiece: number; // プレースキック
  curl: number; // カーブ
  speed: number; // スピード
  acceleration: number; // 瞬発力
  kickingPower: number; // キック力
  jump: number; // ジャンプ
  physical: number; // フィジカルコンタクト
  balance: number; // ボディコントロール
  stamina: number; // スタミナ
  defense: number; // ディフェンスセンス
  ballWinning: number; // ボール奪取
  aggression: number; // アグレッシブネス
  defEngagement: number; // 守備意識
  gkAwareness: number; // GKセンス
  gkCatching: number; // キャッチング
  gkClearing: number; // クリアリング
  gkReflexes: number; // コラプシング
  gkReach: number; // ディフレクティング
}

export type StatKey = keyof Stats;

/** 能力値以外の特性 */
export interface Traits {
  weakFootUse: number; // 逆足頻度 1-4
  weakFootAcc: number; // 逆足精度 1-4
  form: number; // コンディション安定度 1-8
  injuryRes: number; // ケガ耐性 1-3
}

export type GrowthType = 'early' | 'normal' | 'late';

export interface Appearance {
  skin: number;
  hairStyle: number;
  hairColor: number;
  /** ひげ 0:なし 1:無精ひげ 2:口ひげ 3:あごひげ 4:フル */
  beard?: number;
  /** 顔の形 0:卵形 1:丸 2:面長 3:角ばり */
  face?: number;
  /** 眉 0:普通 1:太い 2:細い */
  brow?: number;
}

/** ポジション適性：3=メイン 2=サブ（高い） 1=サブ（可） */
export type Aptitudes = Partial<Record<Position, 1 | 2 | 3>>;

/** 調子 1(⬇)〜5(⬆) */
export type Condition = 1 | 2 | 3 | 4 | 5;

export interface Player {
  id: string;
  name: string;
  nameEn: string;
  nationality: string;
  age: number;
  position: Position;
  aptitudes: Aptitudes;
  foot: 'R' | 'L';
  number: number;
  stats: Stats;
  traits: Traits;
  skills: string[];
  style: string;
  potential: number;
  growth: GrowthType;
  teamId: string | null;
  contractYears: number;
  /** 年俸（百万ユーロ） */
  salary: number;
  condition: Condition;
  /** 離脱する残り試合日数 */
  injury: number;
  /** 出場停止の残り試合数 */
  suspension: number;
  /** 移籍に対する性格 0-100（野心） */
  ambition: number;
  /** 現所属への愛着 0-100 */
  loyalty: number;
  season: SeasonStats;
  career: SeasonStats;
  /** オリジナルチーム用に作成された選手（エディット可能） */
  custom?: boolean;
  appearance: Appearance;
  /** 今季の評価点の合計（ベストイレブン用） */
  ratingSum?: number;
  /** 適性外ポジションでの出場数（適性拡大用） */
  roleApps?: Partial<Record<Position, number>>;
  /** 実在選手（初期データ由来） */
  real?: boolean;
}

export interface SeasonStats {
  apps: number;
  goals: number;
  assists: number;
  clApps: number;
  clGoals: number;
}

export type Formation = '4-3-3' | '4-2-3-1' | '4-4-2' | '3-5-2' | '3-4-3' | '4-1-2-3';

export type FormationLabel = Formation | 'カスタム';
export type Tactic = 'attack' | 'balance' | 'defense';

export interface Team {
  id: string;
  name: string;
  en: string;
  short: string;
  color: string;
  color2: string;
  rep: number;
  country: string;
  league: 'PL' | 'EU';
  formation: FormationLabel;
  tactic: Tactic;
  /** スタメン11人 */
  lineup: string[];
  /** スタメン11人のピッチ上の位置（x:左→右, y:自陣→敵陣 0-100）。位置からポジションが決まる */
  slots: { x: number; y: number }[];
  /** チームスピリット 0-99 */
  spirit: number;
  /** 前の試合のスタメンと役割（スピリットの計算用） */
  lastLineup?: string[];
  /** 控え（ベンチ入り）最大 9 人 */
  bench: string[];
  /** CPU クラブの移籍資金（百万ユーロ） */
  budget: number;
  original?: boolean;
}

export type Competition = 'PL' | 'CL';
export type CLStage = 'LP' | 'PO' | 'R16' | 'QF' | 'SF' | 'F';

export interface Fixture {
  id: string;
  comp: Competition;
  /** カレンダー上の日付インデックス */
  day: number;
  home: string;
  away: string;
  stage?: CLStage;
  tieId?: string;
  leg?: 1 | 2;
  result?: { home: number; away: number; pkHome?: number; pkAway?: number };
}

export interface CalendarDay {
  type: Competition;
  /** PL: 節番号(0-37) / CL: リーグフェーズは 0-7 */
  round: number;
  stage?: CLStage;
  leg?: 1 | 2;
  label: string;
}

export interface Tie {
  id: string;
  stage: CLStage;
  a: string;
  b: string;
  winner?: string;
}

export interface Offer {
  id: string;
  playerId: string;
  fromTeam: string;
  fee: number;
  day: number;
}

export interface NewsItem {
  id: string;
  season: number;
  day: number;
  text: string;
  kind?: 'transfer' | 'match' | 'info' | 'injury';
}

export interface NegotiationRecord {
  /** この移籍期間に交渉が打ち切られた */
  closed: boolean;
  clubTries: number;
  playerTries: number;
  /** クラブとの移籍金合意額 */
  agreedFee?: number;
}

export type MailFrom = 'club' | 'agent' | 'advisor' | 'medical' | 'league' | 'coach' | 'scout' | 'board';

export interface Mail {
  id: string;
  season: number;
  day: number;
  from: MailFrom;
  sender: string;
  subject: string;
  body: string;
  read: boolean;
  playerId?: string;
  offerId?: string;
  /** 補強アドバイスなどで紹介する選手 */
  players?: string[];
  important?: boolean;
}

export interface GameState {
  version: number;
  createdAt: number;
  updatedAt: number;
  managerName: string;
  userTeamId: string;
  season: number;
  /** 次に行うカレンダー日付 */
  day: number;
  calendar: CalendarDay[];
  /** 移籍資金（百万ユーロ） */
  money: number;
  teams: Team[];
  players: Record<string, Player>;
  fixtures: Fixture[];
  clTeams: string[];
  ties: Tie[];
  offers: Offer[];
  negotiations: Record<string, NegotiationRecord>;
  news: NewsItem[];
  mails: Mail[];
  watchlist: string[];
  flags?: Record<string, boolean>;
  history: { season: number; rank: number; champion: string; clWinner?: string; userCl?: string }[];
}
