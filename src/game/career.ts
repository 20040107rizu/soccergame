import { overall } from './stats';
import type { GameState, Player } from './types';

/* ======================= 選手の経歴 ======================= */

export type CareerKind =
  | 'start'
  | 'transfer'
  | 'free'
  | 'gem'
  | 'mystery'
  | 'legend'
  | 'sode'
  | 'youthIn'
  | 'hint'
  | 'youthUp'
  | 'golden'
  | 'academy'
  | 'sold'
  | 'released'
  | 'left'
  | 'awaken'
  | 'worldcup';

export interface CareerEntry {
  /** シーズン */
  s: number;
  /** その時の年齢（分からない時は -1） */
  a: number;
  /** その時の総合値（分からない時は -1） */
  o: number;
  k: CareerKind;
  t: string;
}

export const CAREER_ICON: Record<CareerKind, string> = {
  start: '🏁',
  transfer: '✍️',
  free: '✍️',
  gem: '💎',
  mystery: '🃏',
  legend: '🌟',
  sode: '⚡',
  youthIn: '🌱',
  hint: '🤝',
  youthUp: '🎓',
  golden: '🏅',
  academy: '🎓',
  sold: '✈️',
  released: '👋',
  left: '👋',
  awaken: '🔥',
  worldcup: '🌍',
};

const TIER_TEXT = { jackpot: 'とんでもない逸材だった', normal: '堅実な選手だった', bust: '期待外れだった' };

/** 経歴に出来事を書き足す */
export function logCareer(state: GameState, p: Player, k: CareerKind, t: string) {
  p.log = [...(p.log ?? []), { s: state.season, a: p.age, o: overall(p), k, t }].slice(-40);
}

/**
 * 表示用の経歴。記録が始まる前（古いセーブ）の出来事は、選手に残っている情報から分かる範囲で補う。
 */
export function careerOf(state: GameState, p: Player): CareerEntry[] {
  const log = p.log ?? [];
  const out: CareerEntry[] = [];
  const has = (...ks: CareerKind[]) => log.some((e) => ks.includes(e.k));
  const ageAt = (season: number) => p.age - (state.season - season);
  const joined = p.joinedSeason;
  const y = p.youth;
  if (y) {
    const [age, ovr] = y.hist[0] ?? [ageAt(y.join), -1];
    out.push({ s: y.join, a: age, o: ovr, k: 'youthIn', t: `${age}歳でユースに入団` });
    for (const h of y.hints) out.push({ s: h.season, a: ageAt(h.season), o: -1, k: 'hint', t: `代理人の見立て${h.paid ? '（相談）' : '（入団時）'}「${h.text}」` });
  }
  if (!log.length || !has('transfer', 'free', 'gem', 'mystery', 'legend', 'sode', 'youthUp', 'golden', 'academy')) {
    // 記録が始まる前に加入した選手
    const s = joined ?? 1;
    const club = p.exTeamId ? state.teams.find((t) => t.id === p.exTeamId)?.name : undefined;
    const base = { s, a: joined ? ageAt(joined) : -1, o: -1 };
    if (p.teamId === state.userTeamId || joined) {
      if (p.legend) out.push({ ...base, k: 'legend', t: p.legend.heir ? 'レジェンドの2世として加入' : 'レジェンドとして加入' });
      else if (p.sode) out.push({ ...base, k: 'sode', t: 'ひみつのチームから加入' });
      else if (p.gem) out.push({ ...base, k: 'gem', t: `掘り出し物として${p.gem.origin}から加入${p.gem.revealed ? ` → ${TIER_TEXT[p.gem.tier]}` : ''}` });
      else if (p.mystery) out.push({ ...base, k: 'mystery', t: `謎の代理人の紹介で加入${p.mystery.revealed ? ` → ${TIER_TEXT[p.mystery.tier]}` : ''}` });
      else if (y) out.push({ ...base, k: 'youthUp', t: 'ユースからトップチームに昇格' });
      else if (p.academy) out.push({ ...base, k: 'academy', t: 'ユースからトップチームに昇格' });
      else if (club) out.push({ ...base, k: 'transfer', t: `${base.a > 0 ? `${base.a}歳で、` : ''}${club}から加入（加入時の総合値は記録なし）` });
      else if (joined) out.push({ ...base, k: 'free', t: `${base.a > 0 ? `${base.a}歳で` : ''}加入（加入時の総合値は記録なし）` });
      else if (p.teamId === state.userTeamId) out.push({ s: 1, a: ageAt(1), o: -1, k: 'start', t: '監督就任時から在籍' });
    }
  }
  out.push(...log);
  // 時期が分からない出来事（s = -1）は最後に
  if (p.awakened && !has('awaken')) out.push({ s: -1, a: -1, o: -1, k: 'awaken', t: '覚醒' });
  // 同じシーズンは記録した順（補った出来事が先）
  const key = (e: CareerEntry) => (e.s < 0 ? 1e9 : e.s);
  return out.map((e, i) => ({ e, i })).sort((x, z) => key(x.e) - key(z.e) || x.i - z.i).map((x) => x.e);
}
