import type { Aptitudes, Position } from '../game/types';

/**
 * ひみつのチーム（実際に出会うまで、存在は秘密）。
 * 先頭 11 人がスタメン（SODE_SLOTS と同じ順）、残り 7 人が控え。
 * a: オフェンスセンス〜スタミナ（17項目）、d: ディフェンスセンス・ボール奪取・アグレッシブネス、
 * gk: GKセンス・キャッチング・クリアリング・コラプシング・ディフレクティング、t: 逆足頻度・逆足精度・安定度・ケガ耐性
 */
export interface SodeSeed {
  name: string;
  pos: Position;
  /** 元の写真の総合値（演出の色・イナズマの判定に使う） */
  efo: number;
  style: string;
  height: number;
  foot: 'R' | 'L';
  no: number;
  a: number[];
  d: number[];
  gk: number[];
  t: number[];
  skills: string[];
  apt: Aptitudes;
}

export const SODE_NAME = '袖ヶ浦高等学校';
export const SODE_SHORT = 'SDG';
export const SODE_COLORS = ['#1f8a4c', '#ffd84d'] as const;
export const SODE_CAPTAIN = '根本陸';

/** 4-1-1-4 */
export const SODE_SLOTS = [
  { x: 50, y: 5 }, { x: 12, y: 25 }, { x: 37, y: 20 }, { x: 63, y: 20 }, { x: 88, y: 25 },
  { x: 50, y: 40 }, { x: 50, y: 64 }, { x: 14, y: 80 }, { x: 38, y: 90 }, { x: 62, y: 90 }, { x: 86, y: 80 },
];

export const SODE_PLAYERS: SodeSeed[] = [
  { name: '藤平迫也', pos: 'GK', efo: 93, style: 'GKO', height: 190, foot: 'R', no: 1, a: [80, 89, 75, 85, 89, 90, 80, 80, 88, 90, 94, 96, 97, 92, 85, 87, 93], d: [74, 82, 83], gk: [99, 99, 94, 96, 97], t: [3, 3, 8, 2], skills: ["soleControl", "oneTouchPass", "throughPass", "backspinLob", "lowLob", "gkLowPunt", "gkLongThrow", "pkStopper", "acroClear", "fighting"], apt: {"GK": 3} },
  { name: '登山莉珠夢', pos: 'LSB', efo: 94, style: 'OFB', height: 175, foot: 'R', no: 3, a: [84, 77, 83, 77, 87, 84, 75, 86, 84, 86, 85, 85, 80, 84, 87, 89, 90], d: [96, 87, 96], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["header", "controlCurve", "oneTouchPass", "throughPass", "pinpointCross", "manMarking", "chasing", "interception", "acroClear", "fighting"], apt: {"LWG": 3, "RWG": 3, "LMF": 3, "RMF": 3, "LSB": 3, "RSB": 3, "CMF": 3} },
  { name: '斎藤隆介', pos: 'CB', efo: 96, style: 'OL', height: 197, foot: 'R', no: 4, a: [50, 83, 81, 82, 91, 92, 51, 98, 85, 75, 90, 87, 85, 97, 92, 92, 99], d: [93, 92, 84], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["header", "oneTouchPass", "throughPass", "noLook", "lowLob", "longThrow", "manMarking", "interception", "acroClear", "fighting"], apt: {"LSB": 2, "CB": 3, "RSB": 2, "DMF": 2, "LMF": 2, "CMF": 2, "RMF": 2, "OMF": 2, "LWG": 2, "ST": 2, "RWG": 2, "CF": 2} },
  { name: '佐藤瑠威', pos: 'CB', efo: 95, style: 'BU', height: 184, foot: 'R', no: 5, a: [61, 88, 90, 86, 89, 86, 58, 94, 75, 83, 87, 89, 83, 87, 89, 87, 92], d: [96, 96, 92], gk: [40, 40, 40, 40, 40], t: [4, 4, 8, 3], skills: ["header", "oneTouchPass", "throughPass", "lowLob", "malicia", "manMarking", "chasing", "interception", "acroClear", "fighting"], apt: {"CB": 3} },
  { name: '吉田壮汰', pos: 'RSB', efo: 89, style: 'OFB', height: 174, foot: 'R', no: 2, a: [69, 75, 74, 75, 84, 82, 69, 84, 86, 85, 84, 86, 83, 77, 75, 75, 96], d: [88, 84, 91], gk: [40, 40, 40, 40, 40], t: [4, 4, 8, 2], skills: ["elastico", "header", "oneTouchPass", "throughPass", "backspinLob", "pinpointCross", "manMarking", "chasing", "interception", "fighting"], apt: {"LSB": 3, "RSB": 3, "CB": 2} },
  { name: '根本陸', pos: 'CMF', efo: 99, style: 'B2B', height: 198, foot: 'R', no: 6, a: [95, 96, 93, 96, 96, 96, 84, 95, 88, 94, 85, 84, 93, 82, 96, 98, 91], d: [85, 78, 84], gk: [40, 40, 40, 40, 40], t: [4, 4, 8, 3], skills: ["header", "controlCurve", "middleShot", "oneTouchShot", "oneTouchPass", "throughPass", "backspinLob", "pkTaker", "captaincy", "fighting"], apt: {"OMF": 3, "CMF": 3, "DMF": 3} },
  { name: '伴伸龍', pos: 'OMF', efo: 99, style: 'HOLE', height: 185, foot: 'R', no: 10, a: [95, 96, 93, 88, 86, 88, 97, 81, 87, 96, 93, 92, 88, 83, 85, 91, 99], d: [76, 72, 83], gk: [40, 40, 40, 40, 40], t: [4, 4, 8, 3], skills: ["doubleTouch", "roulette", "edgeTurn", "controlCurve", "middleShot", "risingShot", "oneTouchPass", "throughPass", "noLook", "fighting"], apt: {"LSB": 2, "CB": 3, "RSB": 2, "DMF": 3, "LMF": 3, "CMF": 3, "RMF": 3, "OMF": 3, "LWG": 3, "ST": 3, "RWG": 3, "CF": 3} },
  { name: '江田裕哉', pos: 'LWG', efo: 101, style: 'WS', height: 178, foot: 'R', no: 11, a: [97, 99, 98, 96, 85, 83, 94, 98, 81, 86, 95, 92, 87, 91, 88, 91, 94], d: [85, 87, 86], gk: [40, 40, 40, 40, 40], t: [4, 4, 8, 3], skills: ["doubleTouch", "roulette", "header", "controlCurve", "controlLoop", "middleShot", "oneTouchShot", "oneTouchPass", "throughPass", "fighting"], apt: {"LSB": 3, "CB": 3, "RSB": 3, "DMF": 3, "LMF": 3, "CMF": 3, "RMF": 3, "OMF": 3, "LWG": 3, "ST": 3, "RWG": 3, "CF": 3} },
  { name: '高橋優太', pos: 'CF', efo: 91, style: 'LBR', height: 186, foot: 'R', no: 9, a: [90, 87, 91, 81, 68, 73, 85, 90, 74, 79, 83, 81, 87, 77, 87, 84, 85], d: [40, 72, 51], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["scissors", "doubleTouch", "elastico", "roulette", "edgeTurn", "controlCurve", "middleShot", "oneTouchShot", "oneTouchPass", "fighting"], apt: {"LWG": 3, "ST": 3, "CF": 3, "RWG": 3} },
  { name: '村松隼颯', pos: 'CF', efo: 100, style: 'LBR', height: 177, foot: 'R', no: 18, a: [96, 94, 91, 91, 82, 78, 96, 86, 78, 89, 97, 99, 96, 80, 88, 92, 87], d: [74, 82, 85], gk: [40, 40, 40, 40, 40], t: [4, 4, 8, 3], skills: ["controlCurve", "middleShot", "knuckle", "dropShot", "risingShot", "acrobaticShot", "oneTouchShot", "oneTouchPass", "chasing", "fighting"], apt: {"LWG": 3, "ST": 3, "CF": 3, "RWG": 3, "LMF": 3, "OMF": 3, "RMF": 3} },
  { name: '佐藤日翔', pos: 'RWG', efo: 90, style: 'CS', height: 190, foot: 'R', no: 7, a: [85, 77, 81, 73, 80, 82, 85, 89, 78, 96, 96, 87, 84, 91, 82, 86, 96], d: [71, 75, 81], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["edgeTurn", "header", "controlCurve", "middleShot", "acrobaticShot", "oneTouchPass", "throughPass", "pinpointCross", "chasing", "fighting"], apt: {"LWG": 3, "RWG": 3, "LMF": 3, "RMF": 3, "CMF": 3} },
  { name: '鈴木翔大', pos: 'GK', efo: 86, style: 'GKO', height: 175, foot: 'R', no: 12, a: [71, 83, 81, 84, 86, 80, 60, 64, 82, 84, 86, 85, 83, 84, 79, 84, 95], d: [84, 83, 80], gk: [97, 90, 90, 90, 91], t: [3, 3, 8, 3], skills: ["oneTouchPass", "gkLowPunt", "gkLongThrow", "pkStopper", "acroClear", "fighting"], apt: {"GK": 3} },
  { name: '向後海渡', pos: 'GK', efo: 93, style: 'GKO', height: 180, foot: 'R', no: 21, a: [52, 76, 75, 70, 90, 88, 52, 75, 72, 67, 74, 80, 90, 92, 93, 82, 86], d: [75, 77, 65], gk: [96, 98, 95, 96, 98], t: [2, 2, 7, 3], skills: ["scissors", "cutBehind", "oneTouchPass", "throughPass", "backspinLob", "gkLowPunt", "gkLongThrow", "pkStopper", "acroClear", "fighting"], apt: {"GK": 3} },
  { name: '永峯康瑶', pos: 'LSB', efo: 84, style: 'OFB', height: 179, foot: 'L', no: 13, a: [70, 73, 71, 78, 82, 82, 71, 70, 75, 75, 77, 73, 81, 85, 76, 80, 84], d: [78, 62, 75], gk: [80, 75, 75, 80, 80], t: [2, 2, 5, 3], skills: ["scissors", "doubleTouch", "oneTouchPass", "gkLowPunt", "gkLongThrow", "pkStopper", "malicia", "interception", "acroClear", "fighting"], apt: {"LWG": 3, "LMF": 3, "LSB": 3, "RWG": 3, "RMF": 3, "RSB": 3} },
  { name: '佐倉大晟', pos: 'RSB', efo: 89, style: 'OFB', height: 180, foot: 'R', no: 15, a: [52, 77, 72, 76, 80, 76, 54, 75, 82, 74, 89, 84, 86, 86, 87, 89, 89], d: [88, 85, 90], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["cutBehind", "oneTouchPass", "throughPass", "pinpointCross", "manMarking", "chasing", "interception", "acroClear", "superSub", "fighting"], apt: {"LSB": 3, "RSB": 3} },
  { name: '鳥居大雅', pos: 'RWG', efo: 90, style: 'WS', height: 187, foot: 'R', no: 17, a: [85, 75, 76, 78, 76, 78, 88, 83, 77, 81, 99, 95, 97, 85, 88, 86, 91], d: [53, 72, 71], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["edgeTurn", "controlCurve", "middleShot", "knuckle", "dropShot", "risingShot", "acrobaticShot", "oneTouchShot", "superSub", "fighting"], apt: {"LWG": 3, "RWG": 3, "LMF": 3, "RMF": 3} },
  { name: '湯本裕人', pos: 'LWG', efo: 86, style: 'CS', height: 173, foot: 'L', no: 16, a: [81, 78, 79, 84, 76, 74, 84, 74, 78, 87, 83, 78, 86, 76, 87, 86, 87], d: [70, 76, 88], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["scissors", "roulette", "controlCurve", "middleShot", "acrobaticShot", "oneTouchShot", "oneTouchPass", "throughPass", "pinpointCross", "fighting"], apt: {"LWG": 3, "RWG": 3, "LMF": 3, "RMF": 3, "LSB": 3, "RSB": 3} },
  { name: '石井健人', pos: 'CF', efo: 88, style: 'LBR', height: 180, foot: 'R', no: 19, a: [83, 76, 77, 79, 68, 74, 86, 85, 72, 83, 97, 84, 84, 78, 99, 97, 90], d: [53, 64, 85], gk: [40, 40, 40, 40, 40], t: [3, 3, 8, 3], skills: ["header", "controlCurve", "middleShot", "risingShot", "acrobaticShot", "oneTouchShot", "oneTouchPass", "throughPass", "superSub", "fighting"], apt: {"LWG": 3, "ST": 3, "CF": 3, "RWG": 3} },
];
