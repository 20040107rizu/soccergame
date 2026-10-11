/**
 * 実在クラブ・選手の初期データの書式。
 *
 * 選手は 1 行の文字列：
 *   "背番号|カタカナ名|英語名|メインポジション|サブポジション(カンマ区切り)|年齢|国籍|総合値|プレースタイル|利き足"
 * - 年齢は 2026年8月時点
 * - 総合値・プレースタイルは公開情報をもとにした推定値（eFootball 風の目安）
 * - プレースタイルを空にするとポジションから自動で決まる。利き足は省略で右足
 *
 * 所属は 2026-27 シーズン開幕時点（2026年10月の Web 検索結果をもとに作成）。
 * 情報源の間で食い違いがあるため、実際と異なる場合がある。
 */
export interface ClubSeed {
  id: string;
  name: string;
  en: string;
  short: string;
  color: string;
  color2: string;
  /** クラブの格（1〜100）。選手の移籍意欲や収入に影響 */
  rep: number;
  /** 初期資金（百万ユーロ） */
  budget: number;
  country: string;
  league: 'PL' | 'EU';
  players: string[];
}
