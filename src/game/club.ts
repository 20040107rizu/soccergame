import { fmtMoney, round2 } from './economy';
import { squadOf } from './lineup';
import { sendMail } from './mail';
import { pick } from './rng';
import type { Result } from './transfer';
import type { GameState, Player } from './types';

/* ======================= クラブの施設 ======================= */

export type FacilityKind = 'training' | 'scout' | 'academy';

export const FACILITIES: { id: FacilityKind; icon: string; label: string; effect: string }[] = [
  { id: 'training', icon: '🏋️', label: '練習場', effect: '選手の成長が速くなる' },
  { id: 'scout', icon: '🔭', label: 'スカウト網', effect: '掘り出し物の情報が届きやすくなる' },
  { id: 'academy', icon: '🎓', label: 'ユースアカデミー', effect: '昇格してくるユースの質が上がる' },
];

export const FACILITY_MAX = 5;
/** 強化の費用（百万ユーロ）と工期（日程）。index = 次のレベル - 1 */
const COST = [15, 30, 50, 80, 120];
const DAYS = [3, 5, 7, 9, 12];

export function facilityLevel(state: GameState, k: FacilityKind): number {
  return state.facilities?.[k] ?? 0;
}

export function upgradeCost(state: GameState, k: FacilityKind): { cost: number; days: number } | null {
  const lv = facilityLevel(state, k);
  if (lv >= FACILITY_MAX) return null;
  return { cost: COST[lv], days: DAYS[lv] };
}

export function startUpgrade(state: GameState, k: FacilityKind): Result {
  const c = upgradeCost(state, k);
  if (!c) return { ok: false, message: 'これ以上強化できません' };
  if (state.facilities?.building) return { ok: false, message: '別の施設を工事中です' };
  if (state.money < c.cost) return { ok: false, message: `資金が足りません（必要 ${fmtMoney(c.cost)}）` };
  state.money = round2(state.money - c.cost);
  state.facilities = { ...(state.facilities ?? {}), building: { kind: k, done: state.day + c.days } };
  return { ok: true, message: `工事を始めました（完成まで ${c.days}日程）` };
}

/** 日程ごと：工事の完成 */
export function facilityTick(state: GameState) {
  const b = state.facilities?.building;
  if (!b || state.day < b.done) return;
  const f = state.facilities!;
  f[b.kind] = (f[b.kind] ?? 0) + 1;
  delete f.building;
  const def = FACILITIES.find((x) => x.id === b.kind)!;
  sendMail(state, {
    from: 'board',
    sender: 'クラブ会長',
    subject: `${def.icon} ${def.label}がレベル${f[b.kind]}になりました`,
    body: `${def.label}の工事が完了しました。\n\n効果：${def.effect}`,
  });
}

/** 練習場：試合での成長のしやすさ */
export function trainingBoost(state: GameState): number {
  return 1 + facilityLevel(state, 'training') * 0.12;
}

/** スカウト網：掘り出し物の届きやすさ */
export function scoutBoost(state: GameState): number {
  return 1 + facilityLevel(state, 'scout') * 0.25;
}

/** ユースアカデミー：昇格するユースの能力・伸びしろの上乗せ */
export function academyBoost(state: GameState): number {
  return facilityLevel(state, 'academy');
}

/* ======================= サポーターの愛称 ======================= */

function nicknameFor(p: Player): string {
  const s = p.stats;
  const left = p.foot === 'L';
  const pos = p.position;
  const opts: string[] = [];
  if (pos === 'GK') {
    if (s.gkReflexes >= 88) opts.push('守護神');
    if (s.gkCatching >= 88) opts.push('鉄の両手');
    opts.push('最後の砦');
  } else if (['CB', 'LSB', 'RSB'].includes(pos)) {
    if (s.defense >= 88) opts.push('鉄壁');
    if (s.physical >= 88) opts.push('人間要塞');
    if (s.speed >= 88) opts.push('快速の番人');
    if (s.heading >= 88) opts.push('空の番人');
    opts.push('守備の要');
  } else if (['DMF', 'CMF', 'OMF', 'LMF', 'RMF'].includes(pos)) {
    if (s.lowPass >= 88) opts.push('司令塔');
    if (s.stamina >= 90) opts.push('走る心臓');
    if (s.curl >= 88) opts.push(left ? '魔法の左足' : '魔法の右足');
    if (s.ballWinning >= 85) opts.push('ボール狩人');
    opts.push('ピッチの指揮者');
  } else {
    if (s.finishing >= 88) opts.push('ゴールハンター');
    if (s.speed >= 92) opts.push('韋駄天');
    if (s.dribbling >= 88) opts.push('ドリブルの魔術師');
    if (s.heading >= 88) opts.push('空中の支配者');
    if (s.curl >= 88) opts.push(left ? '魔法の左足' : '魔法の右足');
    opts.push('点取り屋');
  }
  if (p.age <= 21) opts.push('若き怪物');
  return pick(opts);
}

/** ホームの試合後：活躍した選手にサポーターが愛称を付ける */
export function fanTick(state: GameState, used: string[], ratings: Record<string, number>, goals: string[], cleanSheet: boolean) {
  const taken = new Set(squadOf(state, state.userTeamId).map((p) => p.nickname).filter(Boolean));
  for (const id of used) {
    const p = state.players[id];
    if (!p || p.nickname) continue;
    const r = ratings[id] ?? 6;
    let pts = r >= 8 ? 3 : r >= 7.5 ? 2 : r >= 7 ? 1 : 0;
    pts += goals.filter((g) => g === id).length;
    if (cleanSheet && ['GK', 'CB', 'LSB', 'RSB'].includes(p.position)) pts += 1;
    p.fanPoints = (p.fanPoints ?? 0) + pts;
    if (p.fanPoints < 12) continue;
    let nick = nicknameFor(p);
    for (let i = 0; i < 5 && taken.has(nick); i++) nick = nicknameFor(p);
    if (taken.has(nick)) continue;
    p.nickname = nick;
    taken.add(nick);
    sendMail(state, {
      from: 'club',
      sender: 'サポーター',
      subject: `📣 ${p.name}に愛称「${nick}」`,
      body: `ホームでの活躍を見続けてきたサポーターが、${p.name}を「${nick}」と呼ぶようになりました。\n\nスタジアムに響くその名前は、選手の背中を押してくれるはずです。`,
      playerId: p.id,
    });
  }
}
