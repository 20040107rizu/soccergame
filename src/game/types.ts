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
  /** 身長（cm） */
  height?: number;
  appearance: Appearance;
  /** 今季の評価点の合計（ベストイレブン用） */
  ratingSum?: number;
  /** 適性外ポジションでの出場数（適性拡大用） */
  roleApps?: Partial<Record<Position, number>>;
  /** 実在選手（初期データ由来） */
  real?: boolean;
  /** レジェンド（極稀に現れるレア選手） */
  legend?: LegendInfo;
  /** ひみつのチーム出身（試合を重ねるほど本来の能力に近づく） */
  sode?: { name: string; mailedOvr?: number; extra?: number };
  /** サポーターが付けた愛称と、そのための活躍ポイント */
  nickname?: string;
  fanPoints?: number;
  /** 特訓キャンプの回数と、最後に特訓した日 */
  campCount?: number;
  campDay?: number;
  campSeason?: number;
  /** 背番号の魂を受け継いだ（その番号） */
  aceOf?: number;
  /** 謎の代理人から獲得した選手 */
  mystery?: { tier: 'jackpot' | 'normal' | 'bust'; revealed?: boolean };
  /** 直前に所属していたクラブ（恩返し弾用） */
  exTeamId?: string;
  /** 現クラブに加入したシーズン */
  joinedSeason?: number;
  /** 判明した隠し特性 */
  knownTraits?: string[];
  /** 覚醒の予兆メールを送った */
  awakenHint?: boolean;
  /** 覚醒済み */
  awakened?: boolean;
  /** 師匠（ベテラン）の選手 ID */
  mentorId?: string;
  /** 自前のユース出身 */
  academy?: boolean;
  /** 自クラブでの出場数・得点（殿堂用） */
  clubApps?: number;
  clubGoals?: number;
  /** 自クラブ在籍中の最高総合値 */
  peakOvr?: number;
  /** 出場機会の約束 */
  promise?: { left: number; need: number; got: number };
  /** 移籍リスト入り（市場が開いたら売却先を探す） */
  listed?: boolean;
  /** 無名の掘り出し物 */
  gem?: { origin: string; tier: GemTier; revealed?: boolean };
  /** 自クラブのユースチームで育った（古いセーブには無い） */
  youth?: YouthInfo;
}

export type YouthTalent = 'genius' | 'hard' | 'late' | 'grand' | 'normal';
export type YouthFocus = 'auto' | 'shoot' | 'pass' | 'dribble' | 'defense' | 'physical' | 'gk';

export interface YouthInfo {
  talent: YouthTalent;
  focus: YouthFocus;
  /** 入団したシーズン */
  join: number;
  /** 年齢ごとの総合値（成長アルバム） */
  hist: [number, number][];
  /** 代理人の見立て */
  hints: { season: number; text: string; paid?: boolean }[];
  /** 代理人に相談したシーズン */
  consulted?: number;
  /** 師匠（トップチームの選手 ID） */
  mentor?: string;
  /** 伸び悩み */
  slump?: { until: number; choice?: 'talk' | 'watch' };
  /** 成長期が来た */
  spurt?: boolean;
  /** ビッグクラブからの引き抜き */
  offer?: { club: string; fee: number; expires: number };
  /** トップチームでデビュー済み */
  debut?: boolean;
  /** 成長の端数 */
  acc?: number;
  /** 個人差 */
  var?: number;
}

export type GemTier = 'jackpot' | 'normal' | 'bust';

export interface GemOffer {
  playerId: string;
  fee: number;
  salary: number;
  /** スカウトの推定総合値 */
  estLow: number;
  estHigh: number;
  expires: number;
}

export interface DemandEvent {
  playerId: string;
  kind: 'playtime' | 'raise';
  expires: number;
  /** 話し合いに失敗した回数（古いセーブには無い） */
  tries?: number;
}

export interface JobOffer {
  teamIds: string[];
  expires: number;
}

export interface HallEntry {
  name: string;
  position: Position;
  nationality: string;
  apps: number;
  goals: number;
  peak: number;
  season: number;
  note: string;
  /** 在籍したクラブ・背番号・ユニフォームの色（古い記録には無い） */
  club?: string;
  clubId?: string;
  number?: number;
  colors?: [string, string];
}

export type LegendKind = 'prodigy' | 'monster';

export interface LegendInfo {
  kind: LegendKind;
  /** 元になったレジェンド */
  seedId?: string;
  /** 〇〇2世 */
  heir?: boolean;
  /** 入団済み */
  signed?: boolean;
  /** 最後に成長メールを送った総合値 */
  mailedOvr?: number;
}

/** 代理人から届いたレジェンド選手の極秘情報 */
export interface LegendOffer {
  playerId: string;
  kind: LegendKind;
  /** 移籍金（契約金） */
  fee: number;
  salary: number;
  years: number;
  /** 入団の確率 0〜1 */
  chance: number;
  conditions: string[];
  /** この日まで有効 */
  expires: number;
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
  /** 結果のみで試合を進める時に、ハーフタイムで行う交代の予約（古いセーブには無い） */
  halftimeSubs?: { out: string; in: string }[];
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
  /** 買い手が出せる上限（非公開） */
  maxFee?: number;
  /** こちらから条件を提示した回数 */
  tries?: number;
  /** 提示額で合意済み */
  agreed?: boolean;
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
  /** レジェンド選手の極秘情報 */
  legend?: boolean;
  /** メール内で選択する操作 */
  action?: 'gem' | 'demand' | 'job' | 'legendMatch' | 'legendPick' | 'sodeMatch' | 'sodePick' | 'coachMatch' | 'coachPick' | 'mystery' | 'youthSlump' | 'youthOffer';
  /** ユースの選手 */
  youthId?: string;
  /** ひみつのチーム関係 */
  sode?: boolean;
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
  legendOffer?: LegendOffer;
  /** レジェンドXI との対戦イベント */
  legendChallenge?: { status: 'invited' | 'won'; expires: number };
  /** ひみつのチームからの挑戦（古いセーブには無い） */
  sodeChallenge?: { status: 'invited' | 'won'; expires: number; pick?: number; revealed?: boolean };
  gemOffer?: GemOffer;
  demand?: DemandEvent;
  jobOffer?: JobOffer;
  /** 対戦成績の因縁（連敗数・因縁の相手） */
  rivals?: Record<string, { streak: number; rival: boolean }>;
  achievements?: Record<string, { season: number }>;
  hallOfFame?: HallEntry[];
  /** 選手図鑑（古いセーブには無い） */
  dex?: Record<string, import('./collection').DexEntry>;
  /** 伝説の監督からの挑戦状（古いセーブには無い） */
  coachChallenge?: { status: 'invited' | 'won'; coach: string; expires: number; snap: string };
  /** クラブを去ったエースの背番号 */
  aceNumbers?: Record<number, { name: string; keys: string[]; skills: string[]; season: number }>;
  /** 大逆転した試合の記録と、ゾーンの残り試合数 */
  miracles?: { season: number; opp: string; score: string; from: number }[];
  zone?: number;
  /** 謎の代理人からの話 */
  mysteryOffer?: { playerId: string; fee: number; expires: number };
  /** クラブの施設（古いセーブには無い） */
  facilities?: { training?: number; scout?: number; academy?: number; medical?: number; science?: number; analysis?: number; building?: { kind: 'training' | 'scout' | 'academy' | 'medical' | 'science' | 'analysis'; done: number } };
  /** 回数の記録（バッジ用。古いセーブには無い） */
  counters?: Record<string, number>;
  /** 見た目・自慢用（古いセーブには無い） */
  cosmetics?: { kits?: string[]; kit?: string; statues?: string[]; museum?: boolean };
  /** スタジアム（古いセーブには無い） */
  stadium?: { level: number; building?: number; name?: string };
  /** 海外スカウト遠征 */
  expedition?: { region: 'samerica' | 'africa' | 'asia' | 'eeurope'; done: number };
  /** 監督の経験値と表示する称号 */
  manager?: { xp: number; title?: string; backfilled?: boolean };
  /** 殿堂の歴代ベストイレブン（殿堂の名前＋シーズン） */
  hofXI?: (string | null)[];
  /** 師弟関係の進み具合（ベテランID|若手ID → 一緒に先発した試合数） */
  mentorProgress?: Record<string, number>;
  /** ユースチーム（トップチームの登録人数には含まない。古いセーブには無い） */
  youth?: { kids: Record<string, Player> };
  /** 〇〇2世の予定 */
  heirs?: { seedId: string; season: number; done?: boolean }[];
  history: { season: number; rank: number; champion: string; clWinner?: string; userCl?: string; club?: string }[];
}
