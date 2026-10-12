import { aptitudeMultiplier } from './positions';
import { clamp, gauss } from './rng';
import type { Player, Position, StatKey, Stats } from './types';

export const STAT_KEYS: StatKey[] = [
  'offense', 'ballControl', 'dribbling', 'tightPossession', 'lowPass', 'loftedPass', 'finishing', 'heading',
  'setPiece', 'curl', 'speed', 'acceleration', 'kickingPower', 'jump', 'physical', 'balance', 'stamina',
  'defense', 'ballWinning', 'aggression', 'defEngagement', 'gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach',
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
  defEngagement: '守備意識',
  gkAwareness: 'GKセンス',
  gkCatching: 'キャッチング',
  gkClearing: 'クリアリング',
  gkReflexes: 'コラプシング',
  gkReach: 'ディフレクティング',
};

/** ヘルプ用：能力値の説明 */
export const STAT_DESC: Record<StatKey, string> = {
  offense: 'この値が高いほど、攻撃時のボールに対する反応が早くなります。また、裏への飛び出しなど攻撃時の動き出しがすばやくなります。',
  ballControl: 'この値が高いほど、トラップとフェイントでのボールタッチが正確になります。また、トラップやフェイントの際に、よりスムーズに次のプレーに移れるようになります。',
  dribbling: 'この値が高いほど、速く正確なドリブルができます。ドリブル時の最高速度、加速に影響します。',
  tightPossession: 'この値が高いほど、低速でのドリブルターンを機敏に行うことができます。',
  lowPass: 'この値が高いほど、速く正確なグラウンダーパスができます。難しい体勢やワンタッチでも精度や速度が落ちにくくなります。グラウンダースルーパス、グラウンダークロスにも影響します。',
  loftedPass: 'この値が高いほど、速く正確なフライパスができます。難しい体勢やワンタッチでも精度や速度が落ちにくくなります。フライスルーパス、クロスにも影響します。',
  finishing: 'この値が高いほど、シュートが正確になります。難しい体勢やワンタッチでも枠内率の高いシュートを打つことができます。',
  heading: 'この値が高いほど、速く正確なヘディングができます。ヘディングでのシュートやパス、クリアに影響します。',
  setPiece: 'この値が高いほど、狙い通りの位置にフリーキックやPKを蹴ることができます。',
  curl: 'この値が高いほど、カーブが掛かりやすくなります。シュートやパス、プレースキックに影響します。',
  speed: 'この値が高いほど、速く走ることができます。移動時、ドリブル時に影響します。',
  acceleration: 'この値が高いほど、動き出しがすばやくなり、最高速度に達するまでの時間が短くなります。移動時、ドリブル時に影響します。',
  kickingPower: 'この値が高いほど、強いキックができます。シュートやパス、プレースキックに影響します。',
  jump: 'この値が高いほど、ジャンプ力が高くなります。ヘディングの高さに影響し、空中戦で勝ちやすくなります。',
  physical: 'この値が高いほど、競り合いに強く、接触してもバランスを崩しにくくなります。',
  balance: 'この値が高いほど、タックルを避けやすく、接触でバランスを崩しても耐えて転びにくくなります。',
  stamina: 'この値が高いほど、体力を維持することができます。',
  defense: 'この値が高いほど、守備時のボールに対する反応が早くなります。また、ボールホルダーと対峙した際の動き出しがすばやくなります。',
  ballWinning: 'この値が高いほど、タックルやスライディングで届く範囲が広がり、相手からボールを奪いやすくなります。',
  aggression: 'この値が高いほど、激しいプレスやタックルで相手からボールを奪いやすくなります。',
  defEngagement: 'この値が高いほど、守備に参加する意識が高くなります。すばやく自陣方向にポジショニングするなど、献身的に守備を行うようになります。',
  gkAwareness: 'この値が高いほど、ゴールキーパー時にボールに対する反応が早くなります。ポジショニングや起き上がりの早さにも影響します。',
  gkCatching: 'この値が高いほど、ゴールキーパー時にキャッチの成功率が上がり、強烈なシュートもキャッチができるようになります。',
  gkClearing: 'この値が高いほど、ゴールキーパー時にセービングで安全な方向へボールを弾きやすくなります。コーナーや相手のいない方向にボールを弾きやすくなり、セカンドボールでゴールされにくくなります。',
  gkReflexes: 'この値が高いほど、ゴールキーパー時に至近距離からのシュートに対する対応能力が上がります。1対1などの場面でシュートを止めやすくなります。',
  gkReach: 'この値が高いほど、ゴールキーパー時にセービングできる範囲が広くなります。速いシュートや際どいコースへのシュートを止めやすくなります。',
};

export const TRAIT_DESC: { label: string; desc: string }[] = [
  { label: '逆足頻度', desc: '利き足と逆の足を使う頻度です。高いほど、逆足でボールを扱う場面が増えます（4段階）。' },
  { label: '逆足精度', desc: '逆足でキックした時の精度です。高いほど、逆足でも正確なシュートやパスができます（4段階）。' },
  { label: 'コンディション安定度', desc: '調子の変わりにくさです。高いほど調子の波が小さく、安定して力を発揮します（8段階）。' },
  { label: 'ケガ耐性', desc: 'ケガのしにくさです。A が最もケガをしにくく、ケガをしても離脱期間が短くなります。' },
];

export const STAT_GROUPS: { label: string; keys: StatKey[] }[] = [
  { label: 'オフェンス', keys: ['offense', 'ballControl', 'dribbling', 'tightPossession', 'lowPass', 'loftedPass', 'finishing', 'heading', 'setPiece', 'curl'] },
  { label: 'ディフェンス', keys: ['defense', 'ballWinning', 'aggression', 'defEngagement'] },
  { label: 'GK', keys: ['gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach'] },
  { label: 'フィジカル', keys: ['speed', 'acceleration', 'kickingPower', 'jump', 'physical', 'balance', 'stamina'] },
];

export const GK_KEYS: StatKey[] = ['gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach'];

/** 総合値の計算に使う、ポジション別の重み */
export const OVR_WEIGHTS: Record<Position, Partial<Record<StatKey, number>>> = {
  GK: { gkAwareness: 4, gkCatching: 2, gkClearing: 2, gkReflexes: 3, gkReach: 3, jump: 1 },
  CB: { defense: 4, ballWinning: 3, physical: 2, heading: 2, jump: 2, aggression: 1, speed: 1, lowPass: 1, defEngagement: 1 },
  LSB: { defense: 2, ballWinning: 2, speed: 2, stamina: 2, acceleration: 1, lowPass: 1, loftedPass: 1, dribbling: 1, defEngagement: 1 },
  RSB: { defense: 2, ballWinning: 2, speed: 2, stamina: 2, acceleration: 1, lowPass: 1, loftedPass: 1, dribbling: 1, defEngagement: 1 },
  DMF: { defense: 3, ballWinning: 3, lowPass: 2, stamina: 2, physical: 1, aggression: 1, loftedPass: 1, defEngagement: 1 },
  CMF: { lowPass: 3, ballControl: 2, stamina: 2, loftedPass: 1, offense: 1, defense: 1, tightPossession: 1, ballWinning: 1 },
  LMF: { speed: 2, stamina: 2, dribbling: 2, lowPass: 1, loftedPass: 2, acceleration: 1, ballControl: 1 },
  RMF: { speed: 2, stamina: 2, dribbling: 2, lowPass: 1, loftedPass: 2, acceleration: 1, ballControl: 1 },
  OMF: { lowPass: 2, ballControl: 2, dribbling: 2, offense: 2, tightPossession: 1, finishing: 1, balance: 1 },
  LWG: { speed: 2, acceleration: 2, dribbling: 3, ballControl: 1, offense: 2, finishing: 1, balance: 1 },
  RWG: { speed: 2, acceleration: 2, dribbling: 3, ballControl: 1, offense: 2, finishing: 1, balance: 1 },
  ST: { offense: 2, ballControl: 2, dribbling: 1, finishing: 2, lowPass: 1, acceleration: 1, tightPossession: 1 },
  CF: { finishing: 4, offense: 3, physical: 1, heading: 1, kickingPower: 1, speed: 1, ballControl: 1, acceleration: 1 },
};

/** 総合値の最大（全能力値 99 の時） */
export const OVR_MAX = 109;
/** これを超えたところから総合値が伸びやすくなる */
const OVR_KNEE = 88;

/**
 * 総合値：そのポジションに関係する能力値の加重平均。
 * 平均が 88 を超えると伸びが大きくなり、全て 99 で 109 になる（88 以下はそのまま）。
 */
export function overallFor(stats: Stats, pos: Position): number {
  const w = OVR_WEIGHTS[pos];
  let sum = 0;
  let total = 0;
  for (const k in w) {
    const key = k as StatKey;
    sum += (stats[key] ?? 50) * w[key]!;
    total += w[key]!;
  }
  const avg = sum / total;
  const over = Math.max(0, avg - OVR_KNEE);
  return Math.round(avg + ((OVR_MAX - 99) * over * over) / ((99 - OVR_KNEE) * (99 - OVR_KNEE)));
}

/** その能力値が、このポジションの総合値に影響するか */
export function affectsOverall(pos: Position, key: StatKey): boolean {
  return OVR_WEIGHTS[pos][key] !== undefined;
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

export interface PlayStyle {
  label: string;
  pos: Position[];
  desc: string;
  boost: Partial<Record<StatKey, number>>;
}

export const STYLES: Record<string, PlayStyle> = {
  GKD: { label: '守備的GK', pos: ['GK'], desc: '自陣ゴールマウス近くにポジショニングします。', boost: { gkReflexes: 2, gkCatching: 2 } },
  GKO: { label: '攻撃的GK', pos: ['GK'], desc: '積極的に飛び出して、ディフェンスラインの裏をカバーします。', boost: { lowPass: 10, loftedPass: 8, speed: 6 } },
  IFB: { label: 'インナーラップサイドバック', pos: ['RSB', 'LSB'], desc: '高めのポジションを取り、相手ゴール近くでは中に入って攻撃に参加します。', boost: { lowPass: 6, ballControl: 4, offense: 4 } },
  DFB: { label: '守備的サイドバック', pos: ['RSB', 'LSB'], desc: '常に低めのポジションを取り、守備を重視して行動します。', boost: { defense: 4, ballWinning: 3, defEngagement: 8 } },
  OFB: { label: '攻撃的サイドバック', pos: ['RSB', 'LSB'], desc: '常に高めのポジションを取り、積極的に攻撃に参加します。', boost: { offense: 8, speed: 3, loftedPass: 4 } },
  OL: { label: 'オーバーラップ', pos: ['CB'], desc: '前線での攻撃参加を好むディフェンダーです。', boost: { offense: 10, heading: 4, dribbling: 4 } },
  BU: { label: 'ビルドアップ', pos: ['CB'], desc: '後ろから攻撃の組み立てに参加し、前線へのロングフィードも狙います。', boost: { lowPass: 8, loftedPass: 8, ballControl: 6 } },
  PM: { label: 'プレーメイカー', pos: ['CMF', 'DMF'], desc: '攻撃時は低めのポジションから攻撃の起点となります。', boost: { lowPass: 6, loftedPass: 6, ballControl: 3 } },
  HP: { label: 'ハードプレス', pos: ['CMF', 'DMF', 'CB'], desc: '激しい当たりで攻撃の芽を摘みます。', boost: { ballWinning: 4, aggression: 8, physical: 4 } },
  ANC: { label: 'アンカー', pos: ['DMF'], desc: '中盤の底に位置して守備を安定させます。', boost: { defense: 4, lowPass: 3, defEngagement: 6 } },
  B2B: { label: 'ボックストゥボックス', pos: ['RMF', 'LMF', 'CMF', 'DMF'], desc: 'フィールドの隅から隅まで動き回り、攻守に貢献します。', boost: { stamina: 8, ballWinning: 4, offense: 3 } },
  HOLE: { label: '2列目からの飛び出し', pos: ['ST', 'OMF', 'RMF', 'LMF', 'CMF'], desc: '攻撃時には常にゴール前に出ることを意識します。', boost: { offense: 6, finishing: 4 } },
  N10: { label: 'ナンバー10', pos: ['ST', 'OMF', 'CMF'], desc: '動き回らず、パスで試合を組み立てるタイプの司令塔です。', boost: { ballControl: 5, lowPass: 5, speed: -4 } },
  CS: { label: 'クロサー', pos: ['RWG', 'LWG', 'RMF', 'LMF'], desc: 'タッチライン際にポジションを取り、クロスを狙います。', boost: { loftedPass: 8, curl: 6 } },
  IR: { label: 'インサイドレシーバー', pos: ['RWG', 'LWG', 'RMF', 'LMF'], desc: 'サイドから中に入ってパスをもらう動きをします。', boost: { dribbling: 5, ballControl: 4 } },
  WS: { label: 'ウイングストライカー', pos: ['RWG', 'LWG'], desc: 'タッチライン際でパスを待ち、中へのドリブルを狙います。', boost: { dribbling: 4, finishing: 5 } },
  CPM: { label: 'チャンスメイカー', pos: ['ST', 'RWG', 'LWG', 'OMF', 'RMF', 'LMF'], desc: 'どこにでも顔を出して攻撃の組み立てやラストパスを狙います。', boost: { lowPass: 6, dribbling: 4 } },
  LF: { label: 'リンクフォワード', pos: ['CF', 'ST'], desc: '前線からボールをもらいに下がってきて、チャンスを作ります。', boost: { lowPass: 6, ballControl: 5 } },
  TM: { label: 'ターゲットマン', pos: ['CF'], desc: '前線の深い位置で体を張ってポストプレーをします。', boost: { heading: 8, physical: 8, jump: 6, speed: -5 } },
  BOX: { label: 'ボックスストライカー', pos: ['CF'], desc: '動き回らずに中央でボールが来るのを待ちます。', boost: { finishing: 5, heading: 3, speed: -4 } },
  DEC: { label: 'デコイラン', pos: ['CF', 'ST', 'OMF'], desc: 'おとりとなる動きを行い、味方が攻めやすくなるようにします。', boost: { offense: 6, acceleration: 4, speed: 3 } },
  LBR: { label: 'ラインブレイカー', pos: ['CF'], desc: '裏へ抜ける動きをします。', boost: { offense: 6, speed: 4, acceleration: 3 } },
};

/** そのポジションでプレースタイルが有効か（無効なら「無印」） */
export function styleActive(style: string, pos: Position): boolean {
  return !!STYLES[style]?.pos.includes(pos);
}

export function stylesFor(pos: Position): string[] {
  return Object.keys(STYLES).filter((k) => STYLES[k].pos.includes(pos));
}

export function defaultStyle(pos: Position): string {
  const d: Record<Position, string> = {
    GK: 'GKD', CB: 'BU', LSB: 'OFB', RSB: 'OFB', DMF: 'ANC', CMF: 'B2B', LMF: 'CS', RMF: 'CS',
    OMF: 'CPM', LWG: 'WS', RWG: 'WS', ST: 'LF', CF: 'LBR',
  };
  return d[pos];
}

/* ---------------- 特殊スキル ---------------- */

export type SkillCat = 'dribble' | 'shoot' | 'pass' | 'defense' | 'gk' | 'other';

export interface Skill {
  id: string;
  label: string;
  cat: SkillCat;
  desc: string;
}

export const SKILLS: Skill[] = [
  { id: 'scissors', label: 'シザーズ', cat: 'dribble', desc: 'フェイント操作でシザーズフェイントができるようになります。' },
  { id: 'doubleTouch', label: 'ダブルタッチ', cat: 'dribble', desc: 'フェイント操作でダブルタッチフェイントができるようになります。' },
  { id: 'elastico', label: 'エラシコ', cat: 'dribble', desc: 'フェイント操作でエラシコフェイントができるようになります。' },
  { id: 'roulette', label: 'ルーレット', cat: 'dribble', desc: 'フェイント操作でルーレットフェイントができるようになります。' },
  { id: 'chapeu', label: 'シャペウ', cat: 'dribble', desc: 'シャペウとヒールリフトの精度が高くなります。グラウンダーパスに対してシャペウが可能になります。' },
  { id: 'edgeTurn', label: 'エッジターン', cat: 'dribble', desc: 'フェイント操作でエッジターンフェイントができるようになります。' },
  { id: 'cutBehind', label: '軸裏ターン', cat: 'dribble', desc: 'キックフェイント(軸足裏)ができるようになります。また、角度が深いターン時に特殊なトラップモーションになります。' },
  { id: 'pivotKick', label: '軸足当て', cat: 'dribble', desc: 'フェイント操作で軸足当てフェイントができるようになります。' },
  { id: 'tapTrick', label: 'タップトリック', cat: 'dribble', desc: 'タップトリックができるようになります。体の向きに対して横方向へ、ボールを素早く動かします。' },
  { id: 'soleControl', label: '足裏コントロール', cat: 'dribble', desc: 'トラップやターン時に足裏を使ったボールコントロールが増えます。' },
  { id: 'momentumDribble', label: 'モメンタムドリブル', cat: 'dribble', desc: '敵陣の深い位置(アタッキングサード)でドリブルに関する能力が上昇します。' },
  { id: 'accelBurst', label: 'アクセルバースト', cat: 'dribble', desc: '停止中や低速での移動時に、すばやいチョップタッチができるようになります。また状況に応じて特殊なチョップタッチのモーションになります。' },
  { id: 'magneticFeet', label: 'マグネットフィート', cat: 'dribble', desc: 'ボールキープ時、自分から5m以内にいる相手選手の数に応じてボールキープに関係する能力が上昇します。(最大4人)' },
  { id: 'header', label: 'ヘッダー', cat: 'shoot', desc: 'ヘディングで正確なシュートを打つことができます。叩きつけも出やすくなります。' },
  { id: 'bulletHeader', label: 'バレットヘッド', cat: 'shoot', desc: '鋭いヘディングシュートを打つことができます。また難しい体勢からでも正確で強いヘディングシュートができます。' },
  { id: 'controlCurve', label: 'コントロールカーブ', cat: 'shoot', desc: 'カーブを掛けた鋭く正確なコントロールシュートを打つことができます。長い距離でも枠内率の高いコントロールシュートになります。' },
  { id: 'blitzCurve', label: 'ブリッツカーブ', cat: 'shoot', desc: '縦回転の鋭いコントロールシュートを打つことができます。パワーゲージの量が50%以上の場合に発動します。' },
  { id: 'oneTouchShot', label: 'ワンタッチシュート', cat: 'shoot', desc: 'ワンタッチで正確なシュートを打つことができます。' },
  { id: 'phenomFinish', label: 'フェノミナルフィニッシュ', cat: 'shoot', desc: '身体をひねりながらのシュートや、アクロバティックなシュート時に、より正確で強いキックができます。' },
  { id: 'willpower', label: 'ウィルパワー', cat: 'shoot', desc: '自身のシュート数が増えるごとに、シュートに関連した能力が上昇します。最大8回まで上昇します。' },
  { id: 'controlLoop', label: 'コントロールループ', cat: 'shoot', desc: '正確なループシュートを打つことができます。移動速度が速い状態でも、精度の高いループシュートになります。' },
  { id: 'knuckle', label: '無回転シュート', cat: 'shoot', desc: 'インパクトシュート操作で無回転シュートを打つことができます。パワーゲージの量が50%~65%の場合に発動します。フリーキックでも打つことができます。' },
  { id: 'dropShot', label: 'ドロップシュート', cat: 'shoot', desc: 'インパクトシュート操作でドロップシュートを打つことができます。パワーゲージの量が20%~50%の場合に発動します。' },
  { id: 'risingShot', label: 'ライジングシュート', cat: 'shoot', desc: 'インパクトシュート操作でライジングシュートを打つことができます。パワーゲージの量が65%~95%の場合に発動します。' },
  { id: 'middleShot', label: 'ミドルシュート', cat: 'shoot', desc: 'ペナルティエリア外からでも枠内率の高いミドルシュートを打つことができます。' },
  { id: 'lowScreamer', label: 'ロースクリーマー', cat: 'shoot', desc: 'インパクトシュート操作でより速いインパクトシュートを打つことができます。パワーゲージの量が50%未満の場合に発動します。ドロップシュートを所持している場合、こちらが優先されます。' },
  { id: 'snapStrike', label: 'スナップストライク', cat: 'shoot', desc: 'インパクトシュートを撃つ際にボールを蹴るまでの時間が短くなります。' },
  { id: 'acrobaticShot', label: 'アクロバティックシュート', cat: 'shoot', desc: '難しい体勢からでも足を使って正確なシュートを打つことができます。' },
  { id: 'heelTrick', label: 'ヒールトリック', cat: 'shoot', desc: '難しい体勢からでもヒールを使って正確なシュート、パスができます。' },
  { id: 'pkTaker', label: 'PKキッカー', cat: 'shoot', desc: 'PK時にシュート精度が高くなります。' },
  { id: 'rabona', label: 'ラボーナ', cat: 'pass', desc: 'ラボーナができるようになり、ディフェンスのタイミングを外すようなキックができます。通常では逆足を使って精度が落ちてしまう状況でも、利き足を使うことで精度が高いキックができます。' },
  { id: 'noLook', label: 'ノールックパス', cat: 'pass', desc: '視線で相手を惑わせて意表をつくパスができます。' },
  { id: 'gameChanging', label: 'ゲームチェンジパス', cat: 'pass', desc: '後半のキックオフ以降、同点またはリードされている場合にパスに関する能力が上昇します。' },
  { id: 'visionary', label: 'ビジョナリーパス', cat: 'pass', desc: 'パスを受ける選手のワンタッチパス、ワンタッチシュート、トラップの精度が上がります。' },
  { id: 'phenomPass', label: 'フェノミナルパス', cat: 'pass', desc: '身体をひねりながらのパスや、アクロバティックなパス時に、より正確で強いキックができます。' },
  { id: 'lowLob', label: '低弾道ロブ', cat: 'pass', desc: '弾道が低く正確なフライパスを出すことができます。' },
  { id: 'oneTouchPass', label: 'ワンタッチパス', cat: 'pass', desc: 'ワンタッチで正確なパスを出すことができます。' },
  { id: 'throughPass', label: 'スルーパス', cat: 'pass', desc: '状況に応じて的確な弾道のスルーパスを出せるようになり、精度も高くなります。' },
  { id: 'backspinLob', label: 'バックスピンロブ', cat: 'pass', desc: '前方へのフライパス、フライスルーパスでバックスピンを掛けた正確なパスを出すことができます。' },
  { id: 'pinpointCross', label: 'ピンポイントクロス', cat: 'pass', desc: 'カーブを掛けた鋭く正確なクロスを上げることができます。' },
  { id: 'edgeCross', label: 'エッジクロス', cat: 'pass', desc: '鋭く落ちる縦回転のクロスボールを蹴ることができます。' },
  { id: 'outspin', label: 'アウトスピンキック', cat: 'pass', desc: '長い距離でもアウトサイドを使ってスピンを掛けた正確なシュート、パスができます。通常では逆足を使って精度が落ちてしまう状況でも、利き足を使うことで精度が高いキックができます。' },
  { id: 'longThrow', label: 'ロングスロー', cat: 'pass', desc: 'ロングスローインの飛距離が伸びます。' },
  { id: 'blocker', label: 'ブロッカー', cat: 'defense', desc: 'キックに対する反応がすばやくなり、パスやシュートをブロックする成功率が上がります。また、ブロック時のボールの跳ね返りが小さくなります。' },
  { id: 'aerial', label: 'エアバトル', cat: 'defense', desc: '空中戦の競り合いが有利になります。また、競り合い中でもヘディングの精度が落ちにくくなります。' },
  { id: 'sliding', label: 'スライディングタックル', cat: 'defense', desc: 'スライディングタックルの精度とスピードが上がり、ボールを奪いやすくなります。' },
  { id: 'longReach', label: 'ロングリーチタックル', cat: 'defense', desc: '停止中や低速での移動時に、遠めの位置からでも足を伸ばすスタンディングタックルが出やすくなります。' },
  { id: 'powerTackle', label: 'パワータックル', cat: 'defense', desc: '体を当てつつボールを奪うスタンディングタックルが出やすくなります。その際に相手の体勢をより崩しやすくなります。' },
  { id: 'fortress', label: 'フォートレス', cat: 'defense', desc: '後半のキックオフ以降でリードしている場合にディフェンスに関する能力が上昇します。' },
  { id: 'acroClear', label: 'アクロバティッククリア', cat: 'defense', desc: '難しい体勢からでも足を使って緊急回避のクリアができます。' },
  { id: 'aerialFort', label: 'エアリアルフォート', cat: 'defense', desc: '自陣ペナルティエリア内で空中戦に関する能力が上昇します。' },
  { id: 'shadowHunt', label: 'シャドウハント', cat: 'defense', desc: 'DMF、RSB、LSB、CBとして出場時、自分の裏に相手のパスが出された際、スピードに関する能力が上昇します。' },
  { id: 'manMarking', label: 'マンマーク', cat: 'defense', desc: '相手の動きに対する反応がすばやくなり、マークを外されにくくなります。' },
  { id: 'chasing', label: 'チェイシング', cat: 'defense', desc: '前線から相手のボールホルダーに対して積極的にプレッシャーをかけます。' },
  { id: 'interception', label: 'インターセプト', cat: 'defense', desc: 'パスに対する反応がすばやくなり、インターセプトをしやすくなります。' },
  { id: 'gkLowPunt', label: '低弾道パントキック', cat: 'gk', desc: '弾道が低く正確なパントキックができます。' },
  { id: 'gkHighPunt', label: '高弾道パントキック', cat: 'gk', desc: '弾道が高く相手陣地深くまで届くパントキックができます。' },
  { id: 'gkLongThrow', label: 'GKロングスロー', cat: 'gk', desc: 'ゴールキーパーのスローの飛距離が伸びます。' },
  { id: 'pkStopper', label: 'PKストッパー', cat: 'gk', desc: 'PK時にセービングの反応が良くなります。' },
  { id: 'gkDirecting', label: 'GKディレクティングディフェンス', cat: 'gk', desc: 'GKとして出場中、自陣の深い位置(ディフェンシブサード)にいる味方DFのディフェンスに関する能力が上昇します。' },
  { id: 'gkSpiritRoar', label: 'GKスピリットロア', cat: 'gk', desc: 'GKとして出場中、後半のキックオフ以降でリードしている場合に味方DFのフィジカル能力が上昇します。' },
  { id: 'captaincy', label: 'キャプテンシー', cat: 'other', desc: 'キャプテンとしてピッチ上にいることで、チーム全体が疲労の影響を受けにくくなります。' },
  { id: 'attackTrigger', label: 'アタックトリガー', cat: 'other', desc: '自身がボールをキープしている際、自身以外の味方全員のオフェンスセンスが上昇します。' },
  { id: 'superSub', label: 'スーパーサブ', cat: 'other', desc: '後半のキックオフ以降に出場すると、能力が上昇します。' },
  { id: 'fighting', label: '闘争心', cat: 'other', desc: '敵のプレッシャーがある状況でも、キック、ヘディングの精度が下がりにくくなります。また、疲労の影響も受けにくくなります。' },
  { id: 'attackSurge', label: 'アタックサージ', cat: 'other', desc: '味方がボールを保持している状況で自分が敵陣にいる場合、スピードに関する能力が上昇します。' },
  { id: 'malicia', label: 'マリーシア', cat: 'other', desc: 'ボールキープ時にファウルを貰いやすくなります。' },
];

export const SKILL_CAT_LABEL: Record<SkillCat, string> = {
  dribble: 'ドリブル・テクニック',
  shoot: 'シュート',
  pass: 'パス・キック',
  defense: 'ディフェンス',
  gk: 'GK',
  other: 'その他',
};

export const SKILL_LABEL: Record<string, string> = Object.fromEntries(SKILLS.map((s) => [s.id, s.label]));

/* ---------------- 能力値の生成 ---------------- */

/** ポジション別の能力の傾向（総合値からの差） */
const PROFILE: Record<Position, Partial<Record<StatKey, number>>> = {
  GK: { offense: -40, ballControl: -25, dribbling: -30, tightPossession: -25, lowPass: -15, loftedPass: -15, finishing: -40, heading: -30, setPiece: -30, curl: -30, speed: -20, acceleration: -15, kickingPower: -5, jump: -5, physical: -10, balance: -15, stamina: -25, defense: -40, ballWinning: -40, aggression: -30, defEngagement: -30 },
  CB: { offense: -25, ballControl: -12, dribbling: -18, tightPossession: -12, lowPass: -8, loftedPass: -10, finishing: -30, heading: 0, setPiece: -25, curl: -25, speed: -8, acceleration: -10, kickingPower: -8, jump: 0, physical: 2, balance: -8, stamina: -6, defense: 3, ballWinning: 2, aggression: -2, defEngagement: 2 },
  LSB: { offense: -12, ballControl: -8, dribbling: -8, tightPossession: -12, lowPass: -5, loftedPass: -3, finishing: -25, heading: -15, setPiece: -18, curl: -10, speed: 2, acceleration: 0, kickingPower: -10, jump: -12, physical: -8, balance: -4, stamina: 3, defense: -2, ballWinning: -2, aggression: -8, defEngagement: 0 },
  RSB: {},
  DMF: { offense: -15, ballControl: -6, dribbling: -10, tightPossession: -6, lowPass: 0, loftedPass: -4, finishing: -22, heading: -10, setPiece: -18, curl: -15, speed: -10, acceleration: -10, kickingPower: -6, jump: -8, physical: -2, balance: -4, stamina: 0, defense: 1, ballWinning: 2, aggression: -4, defEngagement: 2 },
  CMF: { offense: -6, ballControl: 0, dribbling: -6, tightPossession: -2, lowPass: 2, loftedPass: -2, finishing: -12, heading: -16, setPiece: -12, curl: -10, speed: -8, acceleration: -6, kickingPower: -6, jump: -14, physical: -10, balance: -4, stamina: 0, defense: -8, ballWinning: -6, aggression: -10, defEngagement: -6 },
  LMF: { offense: -6, ballControl: -2, dribbling: 0, tightPossession: -10, lowPass: -4, loftedPass: 0, finishing: -12, heading: -20, setPiece: -12, curl: -6, speed: 0, acceleration: -2, kickingPower: -8, jump: -18, physical: -15, balance: -2, stamina: 0, defense: -18, ballWinning: -18, aggression: -14, defEngagement: -12 },
  RMF: {},
  OMF: { offense: -2, ballControl: 1, dribbling: 0, tightPossession: -3, lowPass: 0, loftedPass: -6, finishing: -6, heading: -20, setPiece: -10, curl: -6, speed: -8, acceleration: -4, kickingPower: -6, jump: -20, physical: -16, balance: 0, stamina: -8, defense: -30, ballWinning: -28, aggression: -18, defEngagement: -24 },
  LWG: { offense: -2, ballControl: -2, dribbling: 1, tightPossession: -8, lowPass: -8, loftedPass: -10, finishing: -6, heading: -20, setPiece: -14, curl: -6, speed: 1, acceleration: 0, kickingPower: -6, jump: -20, physical: -18, balance: 0, stamina: -8, defense: -35, ballWinning: -32, aggression: -18, defEngagement: -28 },
  RWG: {},
  ST: { offense: 1, ballControl: 0, dribbling: -2, tightPossession: -1, lowPass: -4, loftedPass: -10, finishing: 0, heading: -14, setPiece: -12, curl: -8, speed: -6, acceleration: -2, kickingPower: -4, jump: -16, physical: -12, balance: -2, stamina: -10, defense: -35, ballWinning: -32, aggression: -18, defEngagement: -30 },
  CF: { offense: 1, ballControl: -4, dribbling: -6, tightPossession: -4, lowPass: -12, loftedPass: -18, finishing: 1, heading: -6, setPiece: -18, curl: -12, speed: -4, acceleration: -4, kickingPower: 0, jump: -6, physical: -6, balance: -6, stamina: -10, defense: -40, ballWinning: -36, aggression: -14, defEngagement: -34 },
};
PROFILE.RSB = PROFILE.LSB;
PROFILE.RMF = PROFILE.LMF;
PROFILE.RWG = PROFILE.LWG;

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

/** 総合値・ポジション・スタイルから 26 項目の能力値を作る */
export function generateStats(pos: Position, target: number, style: string, rand: () => number = Math.random): Stats {
  const prof = PROFILE[pos];
  const boost = STYLES[style]?.boost ?? {};
  const g = rand === Math.random ? gauss : () => gaussFrom(rand);
  const s = {} as Stats;
  for (const k of STAT_KEYS) {
    let base = target + (prof[k] ?? (GK_KEYS.includes(k) ? -40 : 0)) + (boost[k] ?? 0) + g() * 3;
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
  const add = (id: string, cond: boolean, p = 0.7) => {
    if (cond && rand() < p) sk.push(id);
  };
  const s = stats;
  const def = pos === 'CB' || pos === 'LSB' || pos === 'RSB' || pos === 'DMF';
  add('scissors', s.dribbling >= 82);
  add('doubleTouch', s.dribbling >= 85 && s.ballControl >= 84);
  add('elastico', s.dribbling >= 88, 0.4);
  add('roulette', s.ballControl >= 86 && s.tightPossession >= 82, 0.4);
  add('chapeu', s.ballControl >= 87, 0.3);
  add('edgeTurn', s.tightPossession >= 84, 0.4);
  add('cutBehind', s.ballControl >= 84);
  add('tapTrick', s.dribbling >= 86, 0.3);
  add('soleControl', s.tightPossession >= 85);
  add('momentumDribble', s.dribbling >= 88 && s.offense >= 80, 0.4);
  add('accelBurst', s.acceleration >= 88 && s.dribbling >= 82, 0.4);
  add('magneticFeet', s.tightPossession >= 88, 0.4);
  add('header', s.heading >= 82);
  add('bulletHeader', s.heading >= 87, 0.4);
  add('controlCurve', s.curl >= 82 && s.finishing >= 75);
  add('blitzCurve', s.curl >= 85 && s.kickingPower >= 82, 0.3);
  add('oneTouchShot', s.finishing >= 84);
  add('phenomFinish', s.finishing >= 88 && s.balance >= 80, 0.3);
  add('willpower', s.finishing >= 87 && s.offense >= 87, 0.3);
  add('controlLoop', s.finishing >= 82, 0.4);
  add('knuckle', s.kickingPower >= 86 && s.setPiece >= 78, 0.4);
  add('dropShot', s.kickingPower >= 84, 0.3);
  add('risingShot', s.kickingPower >= 86, 0.3);
  add('middleShot', s.kickingPower >= 84 && s.finishing >= 78);
  add('lowScreamer', s.kickingPower >= 85 && s.finishing >= 82, 0.3);
  add('acrobaticShot', s.finishing >= 85 && s.balance >= 80, 0.4);
  add('heelTrick', s.ballControl >= 84 && s.offense >= 80, 0.4);
  add('pkTaker', s.setPiece >= 82 && s.finishing >= 75, 0.5);
  add('rabona', s.curl >= 85 && s.ballControl >= 85, 0.2);
  add('noLook', s.lowPass >= 88, 0.4);
  add('gameChanging', s.lowPass >= 88 && s.loftedPass >= 84, 0.3);
  add('visionary', s.lowPass >= 89, 0.3);
  add('lowLob', s.loftedPass >= 82);
  add('oneTouchPass', s.lowPass >= 82);
  add('throughPass', s.lowPass >= 84 && s.offense >= 70);
  add('backspinLob', s.loftedPass >= 85, 0.4);
  add('pinpointCross', s.loftedPass >= 82 && s.curl >= 78 && pos !== 'CB');
  add('edgeCross', s.loftedPass >= 85 && s.curl >= 82 && pos !== 'CB', 0.3);
  add('outspin', s.curl >= 86, 0.3);
  add('blocker', s.defense >= 82 && def);
  add('aerial', s.heading >= 80 && s.jump >= 80);
  add('sliding', s.ballWinning >= 84, 0.6);
  add('longReach', s.ballWinning >= 86 && def, 0.3);
  add('powerTackle', s.ballWinning >= 84 && s.physical >= 84, 0.4);
  add('fortress', s.defense >= 87 && def, 0.3);
  add('acroClear', s.defense >= 84 && pos === 'CB', 0.5);
  add('aerialFort', s.heading >= 84 && pos === 'CB', 0.4);
  add('shadowHunt', s.speed >= 84 && def, 0.3);
  add('manMarking', s.defense >= 82 && pos !== 'GK');
  add('chasing', s.defEngagement >= 72 && s.stamina >= 80 && !def, 0.5);
  add('interception', s.defense >= 80 && s.ballWinning >= 78);
  add('gkLowPunt', pos === 'GK' && s.loftedPass >= 70, 0.5);
  add('gkHighPunt', pos === 'GK' && s.kickingPower >= 78, 0.5);
  add('gkLongThrow', pos === 'GK' && s.gkClearing >= 80);
  add('pkStopper', pos === 'GK' && s.gkReflexes >= 84, 0.5);
  add('gkDirecting', pos === 'GK' && s.gkAwareness >= 86, 0.4);
  add('gkSpiritRoar', pos === 'GK' && s.gkAwareness >= 88, 0.2);
  add('fighting', s.aggression >= 82, 0.5);
  add('attackTrigger', s.offense >= 88 && s.tightPossession >= 85, 0.2);
  add('attackSurge', s.speed >= 88 && s.offense >= 84, 0.3);
  add('malicia', s.tightPossession >= 84 && s.balance >= 84, 0.3);
  if (style === 'TM' && !sk.includes('header')) sk.push('header');
  if (style === 'CS' && !sk.includes('pinpointCross')) sk.push('pinpointCross');
  return sk.slice(0, 12);
}
