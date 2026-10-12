import { fairSalary, fmtMoney, round2 } from './economy';
import { repairLineup, squadOf } from './lineup';
import { sendMail } from './mail';
import { clamp, pick, rand, randInt, uid } from './rng';
import { teamById } from './season';
import { autoSkills, generateStats, overall, SKILLS } from './stats';
import { MAX_SQUAD, type Result } from './transfer';
import type { Appearance, GameState, LegendKind, Player, Position, StatKey } from './types';
import { NEIGHBORS } from './positions';
import { unlock } from './events';

/**
 * レジェンド選手：極稀に代理人から極秘情報が届く、レア中のレア選手。
 * - prodigy（急成長期待）：最初は平凡だが、試合を重ねるごとにとんでもない速さで成長する
 * - monster（規格外）：最初から規格外の能力を持ち、試合で圧倒的な活躍をする
 * 厳しい条件を承諾しても、入団してくれるかは低確率。
 */

/** 1 試合日あたりの出現確率（1 シーズンでおよそ 2 割弱） */
export const LEGEND_RATE = 0.004;

export interface LegendSeed {
  id: string;
  /** 現役時代の身長（cm） */
  height: number;
  name: string;
  en: string;
  pos: Position;
  nat: string;
  foot: 'R' | 'L';
  style: string;
  /** 代名詞となる能力（規格外なら 99） */
  sig: StatKey[];
  skills: string[];
  /** 肌, 髪型, 髪色, ひげ */
  look: [number, number, number, number];
}

export const LEGENDS: LegendSeed[] = [
  { id: 'pele', height: 173, name: 'ペレ', en: 'Pelé', pos: 'CF', nat: 'ブラジル', foot: 'R', style: 'BOX', sig: ['finishing', 'offense', 'ballControl', 'dribbling'], skills: ['acrobaticShot', 'header', 'phenomFinish', 'doubleTouch', 'gameChanging'], look: [4, 0, 0, 0] },
  { id: 'maradona', height: 165, name: 'ディエゴ・マラドーナ', en: 'Diego Maradona', pos: 'OMF', nat: 'アルゼンチン', foot: 'L', style: 'N10', sig: ['dribbling', 'ballControl', 'tightPossession', 'balance'], skills: ['doubleTouch', 'magneticFeet', 'gameChanging', 'visionary', 'momentumDribble'], look: [2, 4, 0, 0] },
  { id: 'cruyff', height: 178, name: 'ヨハン・クライフ', en: 'Johan Cruyff', pos: 'ST', nat: 'オランダ', foot: 'R', style: 'N10', sig: ['offense', 'dribbling', 'acceleration', 'lowPass'], skills: ['heelTrick', 'visionary', 'captaincy', 'edgeTurn'], look: [0, 3, 1, 0] },
  { id: 'beckenbauer', height: 181, name: 'フランツ・ベッケンバウアー', en: 'Franz Beckenbauer', pos: 'CB', nat: 'ドイツ', foot: 'R', style: 'BU', sig: ['defense', 'lowPass', 'loftedPass', 'ballControl'], skills: ['captaincy', 'interception', 'visionary', 'throughPass'], look: [0, 1, 1, 0] },
  { id: 'zidane', height: 185, name: 'ジネディーヌ・ジダン', en: 'Zinedine Zidane', pos: 'OMF', nat: 'フランス', foot: 'R', style: 'N10', sig: ['ballControl', 'tightPossession', 'lowPass', 'balance'], skills: ['roulette', 'magneticFeet', 'visionary', 'oneTouchPass', 'gameChanging'], look: [1, 0, 1, 0] },
  { id: 'r9', height: 183, name: 'ロナウド・ナザリオ', en: 'Ronaldo Nazário', pos: 'CF', nat: 'ブラジル', foot: 'R', style: 'LBR', sig: ['finishing', 'speed', 'acceleration', 'dribbling'], skills: ['scissors', 'doubleTouch', 'phenomFinish', 'accelBurst', 'elastico'], look: [3, 0, 0, 0] },
  { id: 'ronaldinho', height: 182, name: 'ロナウジーニョ', en: 'Ronaldinho', pos: 'LWG', nat: 'ブラジル', foot: 'R', style: 'CPM', sig: ['dribbling', 'ballControl', 'curl', 'tightPossession'], skills: ['elastico', 'noLook', 'rabona', 'chapeu', 'heelTrick'], look: [3, 3, 0, 0] },
  { id: 'henry', height: 188, name: 'ティエリ・アンリ', en: 'Thierry Henry', pos: 'CF', nat: 'フランス', foot: 'R', style: 'LBR', sig: ['speed', 'acceleration', 'finishing', 'offense'], skills: ['controlCurve', 'accelBurst', 'oneTouchShot', 'cutBehind'], look: [4, 0, 0, 0] },
  { id: 'maldini', height: 186, name: 'パオロ・マルディーニ', en: 'Paolo Maldini', pos: 'LSB', nat: 'イタリア', foot: 'R', style: 'DFB', sig: ['defense', 'ballWinning', 'defEngagement', 'balance'], skills: ['interception', 'sliding', 'captaincy', 'manMarking'], look: [1, 3, 0, 0] },
  { id: 'baggio', height: 174, name: 'ロベルト・バッジョ', en: 'Roberto Baggio', pos: 'ST', nat: 'イタリア', foot: 'R', style: 'N10', sig: ['ballControl', 'setPiece', 'finishing', 'curl'], skills: ['pkTaker', 'controlCurve', 'chapeu', 'visionary'], look: [1, 3, 0, 3] },
  { id: 'platini', height: 178, name: 'ミシェル・プラティニ', en: 'Michel Platini', pos: 'OMF', nat: 'フランス', foot: 'R', style: 'N10', sig: ['setPiece', 'lowPass', 'curl', 'offense'], skills: ['knuckle', 'visionary', 'throughPass', 'pkTaker'], look: [1, 3, 1, 0] },
  { id: 'vanbasten', height: 188, name: 'マルコ・ファン・バステン', en: 'Marco van Basten', pos: 'CF', nat: 'オランダ', foot: 'R', style: 'BOX', sig: ['finishing', 'heading', 'offense', 'ballControl'], skills: ['acrobaticShot', 'header', 'oneTouchShot'], look: [0, 1, 2, 0] },
  { id: 'eusebio', height: 175, name: 'エウゼビオ', en: 'Eusébio', pos: 'CF', nat: 'ポルトガル', foot: 'R', style: 'BOX', sig: ['kickingPower', 'finishing', 'speed', 'acceleration'], skills: ['middleShot', 'knuckle', 'risingShot'], look: [4, 1, 0, 0] },
  { id: 'best', height: 175, name: 'ジョージ・ベスト', en: 'George Best', pos: 'RWG', nat: '北アイルランド', foot: 'R', style: 'CPM', sig: ['dribbling', 'balance', 'acceleration', 'ballControl'], skills: ['doubleTouch', 'scissors', 'cutBehind', 'momentumDribble'], look: [0, 3, 0, 1] },
  { id: 'charlton', height: 173, name: 'ボビー・チャールトン', en: 'Bobby Charlton', pos: 'CMF', nat: 'イングランド', foot: 'R', style: 'B2B', sig: ['kickingPower', 'lowPass', 'loftedPass', 'stamina'], skills: ['middleShot', 'visionary', 'lowScreamer'], look: [0, 1, 3, 0] },
  { id: 'yashin', height: 189, name: 'レフ・ヤシン', en: 'Lev Yashin', pos: 'GK', nat: 'ロシア', foot: 'R', style: 'GKO', sig: ['gkReflexes', 'gkCatching', 'gkAwareness', 'gkReach'], skills: ['pkStopper', 'gkDirecting', 'gkLongThrow'], look: [0, 1, 0, 0] },
  { id: 'baresi', height: 176, name: 'フランコ・バレージ', en: 'Franco Baresi', pos: 'CB', nat: 'イタリア', foot: 'R', style: 'BU', sig: ['defense', 'defEngagement', 'ballWinning', 'balance'], skills: ['interception', 'captaincy', 'blocker'], look: [0, 0, 0, 0] },
  { id: 'gullit', height: 191, name: 'ルート・フリット', en: 'Ruud Gullit', pos: 'OMF', nat: 'オランダ', foot: 'R', style: 'HOLE', sig: ['physical', 'offense', 'heading', 'stamina'], skills: ['header', 'fighting', 'middleShot'], look: [3, 7, 0, 2] },
  { id: 'kaka', height: 186, name: 'カカ', en: 'Kaká', pos: 'OMF', nat: 'ブラジル', foot: 'R', style: 'HOLE', sig: ['acceleration', 'dribbling', 'speed', 'finishing'], skills: ['accelBurst', 'doubleTouch', 'throughPass'], look: [1, 1, 1, 0] },
  { id: 'pirlo', height: 177, name: 'アンドレア・ピルロ', en: 'Andrea Pirlo', pos: 'DMF', nat: 'イタリア', foot: 'R', style: 'PM', sig: ['lowPass', 'loftedPass', 'setPiece', 'curl'], skills: ['knuckle', 'visionary', 'noLook', 'pinpointCross'], look: [1, 3, 1, 4] },
  { id: 'batistuta', height: 185, name: 'ガブリエル・バティストゥータ', en: 'Gabriel Batistuta', pos: 'CF', nat: 'アルゼンチン', foot: 'R', style: 'BOX', sig: ['kickingPower', 'finishing', 'heading', 'physical'], skills: ['lowScreamer', 'risingShot', 'header'], look: [1, 3, 1, 0] },
  { id: 'rcarlos', height: 168, name: 'ロベルト・カルロス', en: 'Roberto Carlos', pos: 'LSB', nat: 'ブラジル', foot: 'L', style: 'OFB', sig: ['kickingPower', 'speed', 'acceleration', 'stamina'], skills: ['knuckle', 'middleShot', 'longThrow'], look: [4, 0, 0, 0] },
  { id: 'cafu', height: 176, name: 'カフー', en: 'Cafu', pos: 'RSB', nat: 'ブラジル', foot: 'R', style: 'OFB', sig: ['stamina', 'speed', 'defense', 'acceleration'], skills: ['pinpointCross', 'fighting', 'captaincy'], look: [4, 0, 0, 0] },
  { id: 'cannavaro', height: 175, name: 'ファビオ・カンナバーロ', en: 'Fabio Cannavaro', pos: 'CB', nat: 'イタリア', foot: 'R', style: 'HP', sig: ['jump', 'defense', 'ballWinning', 'aggression'], skills: ['aerial', 'interception', 'blocker', 'captaincy'], look: [2, 1, 0, 0] },
  { id: 'kahn', height: 188, name: 'オリバー・カーン', en: 'Oliver Kahn', pos: 'GK', nat: 'ドイツ', foot: 'R', style: 'GKD', sig: ['gkReflexes', 'gkAwareness', 'gkCatching', 'gkReach'], skills: ['gkSpiritRoar', 'pkStopper', 'captaincy'], look: [0, 1, 3, 0] },
  { id: 'bergkamp', height: 183, name: 'デニス・ベルカンプ', en: 'Dennis Bergkamp', pos: 'ST', nat: 'オランダ', foot: 'R', style: 'LF', sig: ['ballControl', 'lowPass', 'finishing', 'balance'], skills: ['soleControl', 'heelTrick', 'controlCurve', 'throughPass'], look: [0, 1, 3, 0] },
  { id: 'gerrard', height: 183, name: 'スティーヴン・ジェラード', en: 'Steven Gerrard', pos: 'CMF', nat: 'イングランド', foot: 'R', style: 'B2B', sig: ['kickingPower', 'loftedPass', 'stamina', 'offense'], skills: ['middleShot', 'captaincy', 'fighting'], look: [0, 1, 1, 0] },
  { id: 'xavi', height: 170, name: 'シャビ', en: 'Xavi', pos: 'CMF', nat: 'スペイン', foot: 'R', style: 'PM', sig: ['lowPass', 'tightPossession', 'ballControl', 'balance'], skills: ['oneTouchPass', 'visionary', 'throughPass'], look: [1, 1, 0, 1] },
  { id: 'iniesta', height: 171, name: 'アンドレス・イニエスタ', en: 'Andrés Iniesta', pos: 'CMF', nat: 'スペイン', foot: 'R', style: 'N10', sig: ['dribbling', 'tightPossession', 'lowPass', 'balance'], skills: ['doubleTouch', 'visionary', 'oneTouchPass'], look: [1, 0, 1, 0] },
  { id: 'nakata', height: 175, name: '中田英寿', en: 'Hidetoshi Nakata', pos: 'OMF', nat: '日本', foot: 'R', style: 'CPM', sig: ['lowPass', 'physical', 'balance', 'offense'], skills: ['throughPass', 'visionary', 'fighting'], look: [0, 1, 3, 0] },
  { id: 'ibra', height: 195, name: 'ズラタン・イブラヒモビッチ', en: 'Zlatan Ibrahimović', pos: 'CF', nat: 'スウェーデン', foot: 'R', style: 'TM', sig: ['physical', 'finishing', 'ballControl', 'kickingPower'], skills: ['acrobaticShot', 'heelTrick', 'header', 'scissors'], look: [1, 3, 0, 1] },
  { id: 'delpiero', height: 173, name: 'アレッサンドロ・デル・ピエロ', en: 'Alessandro Del Piero', pos: 'ST', nat: 'イタリア', foot: 'R', style: 'N10', sig: ['curl', 'setPiece', 'finishing', 'ballControl'], skills: ['controlCurve', 'pkTaker', 'knuckle'], look: [1, 1, 0, 0] },
  { id: 'lampard', height: 184, name: 'フランク・ランパード', en: 'Frank Lampard', pos: 'CMF', nat: 'イングランド', foot: 'R', style: 'HOLE', sig: ['finishing', 'kickingPower', 'offense', 'lowPass'], skills: ['middleShot', 'pkTaker', 'risingShot'], look: [0, 1, 1, 0] },
  { id: 'villa', height: 175, name: 'ダビド・ビジャ', en: 'David Villa', pos: 'CF', nat: 'スペイン', foot: 'R', style: 'LBR', sig: ['finishing', 'offense', 'curl', 'acceleration'], skills: ['controlCurve', 'oneTouchShot', 'phenomFinish', 'knuckle', 'acrobaticShot'], look: [1, 1, 0, 3] },
  // メッシ・クリスティアーノ世代の大物
  { id: 'messi', height: 170, name: 'リオネル・メッシ', en: 'Lionel Messi', pos: 'RWG', nat: 'アルゼンチン', foot: 'L', style: 'CPM', sig: ['dribbling', 'ballControl', 'offense', 'curl'], skills: ['doubleTouch', 'controlCurve', 'gameChanging', 'phenomFinish', 'magneticFeet'], look: [1, 1, 1, 3] },
  { id: 'cr7', height: 187, name: 'クリスティアーノ・ロナウド', en: 'Cristiano Ronaldo', pos: 'LWG', nat: 'ポルトガル', foot: 'R', style: 'WS', sig: ['finishing', 'kickingPower', 'jump', 'speed'], skills: ['knuckle', 'header', 'bulletHeader', 'phenomFinish', 'acrobaticShot'], look: [1, 1, 0, 0] },
  { id: 'neymar', height: 175, name: 'ネイマール', en: 'Neymar', pos: 'LWG', nat: 'ブラジル', foot: 'R', style: 'CPM', sig: ['dribbling', 'ballControl', 'balance', 'acceleration'], skills: ['rabona', 'elastico', 'heelTrick', 'chapeu', 'momentumDribble'], look: [2, 3, 3, 1] },
  { id: 'modric', height: 172, name: 'ルカ・モドリッチ', en: 'Luka Modrić', pos: 'CMF', nat: 'クロアチア', foot: 'R', style: 'PM', sig: ['lowPass', 'ballControl', 'tightPossession', 'stamina'], skills: ['outspin', 'visionary', 'oneTouchPass', 'throughPass', 'middleShot'], look: [0, 3, 2, 0] },
  { id: 'benzema', height: 185, name: 'カリム・ベンゼマ', en: 'Karim Benzema', pos: 'CF', nat: 'フランス', foot: 'R', style: 'LF', sig: ['finishing', 'offense', 'ballControl', 'lowPass'], skills: ['oneTouchShot', 'oneTouchPass', 'heelTrick', 'header', 'phenomFinish'], look: [2, 0, 0, 4] },
  { id: 'lewandowski', height: 185, name: 'ロベルト・レヴァンドフスキ', en: 'Robert Lewandowski', pos: 'CF', nat: 'ポーランド', foot: 'R', style: 'BOX', sig: ['finishing', 'offense', 'heading', 'physical'], skills: ['oneTouchShot', 'header', 'phenomFinish', 'acrobaticShot', 'pkTaker'], look: [0, 1, 1, 0] },
  { id: 'suarez', height: 182, name: 'ルイス・スアレス', en: 'Luis Suárez', pos: 'CF', nat: 'ウルグアイ', foot: 'R', style: 'BOX', sig: ['finishing', 'offense', 'aggression', 'ballControl'], skills: ['oneTouchShot', 'snapStrike', 'malicia', 'fighting', 'acrobaticShot'], look: [1, 1, 0, 1] },
  { id: 'ramos', height: 184, name: 'セルヒオ・ラモス', en: 'Sergio Ramos', pos: 'CB', nat: 'スペイン', foot: 'R', style: 'BU', sig: ['defense', 'heading', 'jump', 'aggression'], skills: ['header', 'bulletHeader', 'captaincy', 'pkTaker', 'fighting'], look: [1, 3, 0, 4] },
  { id: 'buffon', height: 192, name: 'ジャンルイジ・ブッフォン', en: 'Gianluigi Buffon', pos: 'GK', nat: 'イタリア', foot: 'R', style: 'GKD', sig: ['gkAwareness', 'gkReflexes', 'gkCatching', 'gkReach'], skills: ['gkDirecting', 'gkSpiritRoar', 'captaincy', 'pkStopper', 'gkLongThrow'], look: [1, 1, 1, 1] },
  { id: 'casillas', height: 185, name: 'イケル・カシージャス', en: 'Iker Casillas', pos: 'GK', nat: 'スペイン', foot: 'R', style: 'GKD', sig: ['gkReflexes', 'gkAwareness', 'gkReach', 'acceleration'], skills: ['gkDirecting', 'pkStopper', 'captaincy', 'gkLowPunt', 'acroClear'], look: [1, 1, 0, 0] },
  { id: 'rooney', height: 176, name: 'ウェイン・ルーニー', en: 'Wayne Rooney', pos: 'ST', nat: 'イングランド', foot: 'R', style: 'LF', sig: ['finishing', 'kickingPower', 'aggression', 'offense'], skills: ['acrobaticShot', 'middleShot', 'knuckle', 'fighting', 'oneTouchShot'], look: [0, 0, 1, 0] },
  { id: 'robben', height: 180, name: 'アリエン・ロッベン', en: 'Arjen Robben', pos: 'RWG', nat: 'オランダ', foot: 'L', style: 'WS', sig: ['speed', 'dribbling', 'curl', 'acceleration'], skills: ['controlCurve', 'middleShot', 'momentumDribble', 'cutBehind', 'accelBurst'], look: [0, 0, 5, 0] },
  { id: 'ribery', height: 170, name: 'フランク・リベリー', en: 'Franck Ribéry', pos: 'LWG', nat: 'フランス', foot: 'R', style: 'CPM', sig: ['dribbling', 'acceleration', 'balance', 'ballControl'], skills: ['doubleTouch', 'scissors', 'edgeCross', 'momentumDribble', 'fighting'], look: [0, 0, 1, 0] },
  { id: 'drogba', height: 189, name: 'ディディエ・ドログバ', en: 'Didier Drogba', pos: 'CF', nat: 'コートジボワール', foot: 'R', style: 'TM', sig: ['physical', 'heading', 'kickingPower', 'finishing'], skills: ['header', 'bulletHeader', 'knuckle', 'pkTaker', 'fighting'], look: [4, 0, 0, 1] },
  { id: 'etoo', height: 180, name: 'サミュエル・エトー', en: "Samuel Eto'o", pos: 'CF', nat: 'カメルーン', foot: 'R', style: 'LBR', sig: ['speed', 'finishing', 'acceleration', 'offense'], skills: ['oneTouchShot', 'chasing', 'phenomFinish', 'accelBurst', 'fighting'], look: [4, 0, 0, 0] },
  { id: 'kroos', height: 183, name: 'トニ・クロース', en: 'Toni Kroos', pos: 'CMF', nat: 'ドイツ', foot: 'R', style: 'PM', sig: ['lowPass', 'loftedPass', 'setPiece', 'curl'], skills: ['visionary', 'outspin', 'middleShot', 'pinpointCross', 'oneTouchPass'], look: [0, 1, 3, 0] },
  { id: 'busquets', height: 189, name: 'セルヒオ・ブスケツ', en: 'Sergio Busquets', pos: 'DMF', nat: 'スペイン', foot: 'R', style: 'ANC', sig: ['lowPass', 'defense', 'tightPossession', 'ballWinning'], skills: ['interception', 'oneTouchPass', 'blocker', 'malicia', 'throughPass'], look: [1, 1, 0, 1] },
  { id: 'marcelo', height: 174, name: 'マルセロ', en: 'Marcelo', pos: 'LSB', nat: 'ブラジル', foot: 'L', style: 'OFB', sig: ['dribbling', 'ballControl', 'speed', 'lowPass'], skills: ['rabona', 'heelTrick', 'pinpointCross', 'doubleTouch', 'acrobaticShot'], look: [3, 7, 0, 0] },
  { id: 'hazard', height: 175, name: 'エデン・アザール', en: 'Eden Hazard', pos: 'LWG', nat: 'ベルギー', foot: 'R', style: 'CPM', sig: ['dribbling', 'balance', 'ballControl', 'acceleration'], skills: ['doubleTouch', 'momentumDribble', 'magneticFeet', 'throughPass', 'pkTaker'], look: [1, 1, 1, 1] },
  { id: 'aguero', height: 173, name: 'セルヒオ・アグエロ', en: 'Sergio Agüero', pos: 'CF', nat: 'アルゼンチン', foot: 'R', style: 'BOX', sig: ['finishing', 'offense', 'acceleration', 'balance'], skills: ['oneTouchShot', 'phenomFinish', 'acrobaticShot', 'lowScreamer', 'fighting'], look: [2, 1, 0, 0] },
  { id: 'tsilva', height: 181, name: 'チアゴ・シウバ', en: 'Thiago Silva', pos: 'CB', nat: 'ブラジル', foot: 'R', style: 'BU', sig: ['defense', 'ballWinning', 'jump', 'lowPass'], skills: ['interception', 'blocker', 'aerialFort', 'captaincy', 'manMarking'], look: [3, 0, 0, 0] },
  { id: 'puyol', height: 178, name: 'カルレス・プジョル', en: 'Carles Puyol', pos: 'CB', nat: 'スペイン', foot: 'R', style: 'HP', sig: ['defense', 'aggression', 'ballWinning', 'jump'], skills: ['fortress', 'captaincy', 'fighting', 'manMarking', 'acroClear'], look: [1, 3, 1, 0] },
];

export const LEGEND_LABEL: Record<LegendKind, string> = { prodigy: '急成長期待', monster: '規格外' };

/** 試合での能力補正 */
export function legendMul(p: Player): number {
  if (!p.legend) return 1;
  return p.legend.kind === 'monster' ? 1.05 : 1.02;
}

export function makeLegend(seed: LegendSeed, kind: LegendKind): Player {
  const prodigy = kind === 'prodigy';
  const age = prodigy ? randInt(17, 18) : randInt(24, 27);
  const stats = generateStats(seed.pos, prodigy ? 64 : 90, seed.style);
  for (const k of seed.sig) stats[k] = prodigy ? clamp(stats[k] + 10, 35, 85) : 99;
  if (!prodigy) for (const k of Object.keys(stats) as StatKey[]) if (!seed.sig.includes(k)) stats[k] = clamp(stats[k] + 3, 35, 99);
  const known = new Set(SKILLS.map((s) => s.id));
  const skills = [...new Set([...seed.skills.filter((s) => known.has(s)), ...(prodigy ? [] : autoSkills(stats, seed.pos, seed.style))])]
    .slice(0, prodigy ? 3 : 12);
  const aptitudes: Player['aptitudes'] = { [seed.pos]: 3 };
  for (const n of NEIGHBORS[seed.pos]) if (rand() < 0.5) aptitudes[n] = 2;
  const look: Appearance = { skin: seed.look[0], hairStyle: seed.look[1], hairColor: seed.look[2], beard: seed.look[3], face: randInt(0, 3), brow: 0 };
  const p: Player = {
    id: uid('lg'),
    name: seed.name,
    nameEn: seed.en,
    nationality: seed.nat,
    age,
    height: seed.height,
    position: seed.pos,
    aptitudes,
    foot: seed.foot,
    number: seed.pos === 'GK' ? 1 : 10,
    stats,
    traits: { weakFootUse: randInt(3, 4), weakFootAcc: randInt(3, 4), form: 8, injuryRes: 3 },
    skills,
    style: seed.style,
    potential: prodigy ? randInt(99, 105) : randInt(103, 107),
    growth: 'late',
    teamId: null,
    contractYears: 0,
    salary: 0,
    condition: 4,
    injury: 0,
    suspension: 0,
    ambition: 95,
    loyalty: 50,
    season: { apps: 0, goals: 0, assists: 0, clApps: 0, clGoals: 0 },
    career: { apps: 0, goals: 0, assists: 0, clApps: 0, clGoals: 0 },
    appearance: look,
    legend: { kind, seedId: seed.id },
  };
  p.legend!.mailedOvr = overall(p);
  return p;
}

/** 試合日ごとに極稀にレジェンドの情報が届く。期限切れの処理も行う */
export function legendTick(state: GameState) {
  const o = state.legendOffer;
  if (o && state.day >= o.expires) {
    const p = state.players[o.playerId];
    if (p && !p.teamId) {
      sendMail(state, {
        from: 'agent',
        sender: '謎の代理人',
        subject: `【続報】${p.name}は姿を消しました`,
        body: `${p.name}の件ですが、回答期限が過ぎたため、他のクラブとの話を進めることになりました。\n\nもう二度とこのような機会はないかもしれません…。`,
        legend: true,
      });
      delete state.players[p.id];
    }
    delete state.legendOffer;
    return;
  }
  if (state.legendOffer || rand() >= LEGEND_RATE) return;
  spawnLegend(state);
}

/** レジェンド選手を出現させる（テスト・デバッグ用に export） */
export function spawnLegend(state: GameState, kind?: LegendKind): Player | null {
  state.flags = state.flags ?? {};
  const pool = LEGENDS.filter((l) => !state.flags![`legend-${l.id}`]);
  if (!pool.length) return null;
  const seed = pick(pool);
  state.flags[`legend-${seed.id}`] = true;
  return offerLegend(state, seed, kind ?? (rand() < 0.6 ? 'prodigy' : 'monster'));
}

/** レジェンドの名を継ぐ「〇〇2世」の情報を届ける */
export function spawnHeir(state: GameState, seedId: string): Player | null {
  const seed = LEGENDS.find((l) => l.id === seedId);
  if (!seed || state.legendOffer) return null;
  return offerLegend(state, seed, 'prodigy', true);
}

export function legendName(seedId: string): string {
  return LEGENDS.find((l) => l.id === seedId)?.name ?? '';
}

function offerLegend(state: GameState, seed: LegendSeed, k: LegendKind, heir = false): Player {
  const p = makeLegend(seed, k);
  if (heir) {
    p.name = `${seed.name}2世`;
    p.nameEn = `${seed.en} II`;
    p.age = 16;
    p.potential = 106;
    p.legend!.heir = true;
  }
  state.players[p.id] = p;

  const user = teamById(state, state.userTeamId);
  const prodigy = k === 'prodigy';
  const fee = round2(Math.max(prodigy ? 10 : 40, state.money * (prodigy ? 0.25 + rand() * 0.2 : 0.55 + rand() * 0.25)));
  const salary = round2(Math.max(fairSalary(p) * (prodigy ? 3 : 1.6), prodigy ? 2 : 12));
  const years = prodigy ? randInt(3, 5) : randInt(2, 3);
  // 2世は父の活躍を見てきたので、少しだけ来てくれやすい
  const chance = clamp((prodigy ? 0.3 : 0.18) + (heir ? 0.15 : 0) + (user.rep - 75) * 0.004, 0.08, 0.5);
  const conditions = [
    `移籍金（契約金）${fmtMoney(fee)} を一括で支払うこと`,
    `年俸 ${fmtMoney(salary)}・${years}年契約（年俸総額の上限とは別枠）`,
    p.position === 'GK' ? '背番号1を用意すること' : '背番号10を用意すること',
  ];
  if (!prodigy || rand() < 0.5) conditions.push('スタメンでの起用を約束すること');
  state.legendOffer = { playerId: p.id, kind: k, fee, salary, years, chance, conditions, expires: state.day + 4 };

  const ovr = overall(p);
  const cond = `【条件】\n${conditions.map((c) => '・' + c).join('\n')}\n\n条件を承諾しても、入団してくれるかは本人次第です（可能性は${chanceLabel(chance)}）。\n回答期限は4日以内です。`;
  sendMail(state, {
    from: 'agent',
    sender: '謎の代理人',
    subject: heir ? `【極秘】「${p.name}」と呼ばれる少年` : prodigy ? `【極秘】急成長が期待される逸材「${p.name}」` : `【極秘】規格外の選手「${p.name}」`,
    body: heir
      ? `監督、覚えていますか。かつて貴クラブで伝説を残した${seed.name}を。\n\nその再来と呼ばれる${p.age}歳の少年がいます。地元では「${p.name}」と呼ばれ、プレーはまさに生き写しです。今の総合値は${ovr}ですが、才能は父譲り…いや、それ以上かもしれません。\n\n本人は「${user.name}でプレーしたい」と話しています。\n\n${cond}`
      : prodigy
        ? `監督、ここだけの話です。\n\n${p.nationality}に${p.age}歳の${p.name}という少年がいます。今の総合値は${ovr}と目立ちませんが、試合を重ねれば信じられない速さで成長するはずです。私はこれほどの才能を見たことがありません。\n\n本人はどこのクラブにも所属しておらず、条件次第で話を聞くと言っています。ただし、条件は厳しいですよ。\n\n${cond}`
        : `監督、とんでもない選手の情報です。\n\n${p.name}（${p.age}歳・${p.position}）。総合値${ovr}、まさに規格外です。いまはどこにも所属しておらず、新天地を探しています。\n\n各国のビッグクラブも狙っていますが、条件を飲めば貴クラブにも可能性があります。\n\n${cond}`,
    playerId: p.id,
    important: true,
    legend: true,
  });
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【極秘】代理人から${p.name}の情報が届いた` });
  return p;
}

export function chanceLabel(c: number): string {
  return c >= 0.3 ? `低い（約${Math.round(c * 100)}%）` : `かなり低い（約${Math.round(c * 100)}%）`;
}

/** 条件を承諾して入団を打診する。成否にかかわらず話はこれで終わり */
export function acceptLegend(state: GameState): Result & { joined?: boolean } {
  const o = state.legendOffer;
  if (!o) return { ok: false, message: 'この話はもう終わっています' };
  const p = state.players[o.playerId];
  if (!p) return { ok: false, message: 'この話はもう終わっています' };
  if (state.money < o.fee) return { ok: false, message: `移籍資金が足りません（必要 ${fmtMoney(o.fee)}）` };
  if (squadOf(state, state.userTeamId).length >= MAX_SQUAD) return { ok: false, message: `登録は最大${MAX_SQUAD}人までです` };
  delete state.legendOffer;
  if (rand() >= o.chance) {
    sendMail(state, {
      from: 'agent',
      sender: '謎の代理人',
      subject: `【続報】${p.name}は入団を断りました`,
      body: `条件を飲んでいただいたのですが…${p.name}は最終的に別の道を選びました。\n\n申し訳ありません。またいつか、こんな話が来るといいのですが。`,
      legend: true,
    });
    delete state.players[p.id];
    return { ok: true, joined: false, message: `${p.name}は入団を断った…` };
  }
  state.money = round2(state.money - o.fee);
  const squad = squadOf(state, state.userTeamId);
  const want = p.position === 'GK' ? 1 : 10;
  const holder = squad.find((x) => x.number === want);
  if (holder) {
    const used = new Set(squad.map((x) => x.number));
    let n = 2;
    while (used.has(n)) n++;
    holder.number = n;
  }
  p.number = want;
  p.teamId = state.userTeamId;
  p.salary = o.salary;
  p.contractYears = o.years;
  p.loyalty = 80;
  p.legend!.signed = true;
  p.joinedSeason = state.season;
  unlock(state, p.legend!.heir ? 'secondGen' : 'legend');
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【電撃加入】${p.name}が入団！（移籍金 ${fmtMoney(o.fee)}）` });
  sendMail(state, {
    from: 'agent',
    sender: '謎の代理人',
    subject: `【電撃加入】${p.name}が入団を決断！`,
    body: `信じられません…！${p.name}が貴クラブへの入団を決めました！\n\n${o.kind === 'prodigy' ? '試合で使い続ければ、きっと驚くほどの成長を見せてくれるでしょう。' : 'その規格外の力で、チームを頂点へ導いてくれるはずです。'}`,
    playerId: p.id,
    important: true,
    legend: true,
  });
  repairLineup(state, teamById(state, state.userTeamId));
  return { ok: true, joined: true, message: `${p.name}が入団！` };
}

export function declineLegend(state: GameState) {
  const o = state.legendOffer;
  if (!o) return;
  delete state.players[o.playerId];
  delete state.legendOffer;
}

/** 試合後のレジェンドの成長（急成長期待はとんでもない速さで伸びる） */
export function legendGrowth(p: Player, rating: number, bump: (p: Player, n: number) => void): { from: number; to: number } | null {
  if (!p.legend) return null;
  const before = overall(p);
  if (before >= p.potential) return null;
  const n = p.legend.kind === 'prodigy' ? randInt(4, 7) + (rating >= 7 ? 3 : 0) : rand() < 0.5 ? 1 : 0;
  for (let i = 0; i < n; i++) bump(p, 1);
  // 成長に合わせて特殊スキルも増える
  if (p.legend.kind === 'prodigy' && rand() < 0.08 && p.skills.length < 12) {
    const add = autoSkills(p.stats, p.position, p.style).find((s) => !p.skills.includes(s));
    if (add) p.skills.push(add);
  }
  const after = overall(p);
  const last = p.legend.mailedOvr ?? before;
  if (after >= last + 3) {
    p.legend.mailedOvr = after;
    return { from: last, to: after };
  }
  return null;
}
