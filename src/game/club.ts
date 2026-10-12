import { fmtMoney, round2 } from './economy';
import { squadOf } from './lineup';
import { sendMail } from './mail';
import { pick, randInt } from './rng';
import { autoSkills, OVR_WEIGHTS, overall, SKILLS } from './stats';
import type { Result } from './transfer';
import type { GameState, Player, StatKey } from './types';

/* ======================= クラブの施設 ======================= */

export type FacilityKind = 'training' | 'scout' | 'academy' | 'medical' | 'science' | 'analysis';

export const FACILITIES: { id: FacilityKind; icon: string; label: string; effect: string }[] = [
  { id: 'training', icon: '🏋️', label: '練習場', effect: '選手の成長が速くなる' },
  { id: 'scout', icon: '🔭', label: 'スカウト網', effect: '掘り出し物の情報が届きやすくなる' },
  { id: 'academy', icon: '🎓', label: 'ユースアカデミー', effect: '昇格してくるユースの質が上がる' },
  { id: 'medical', icon: '🏥', label: '医療センター', effect: 'ケガが早く治る' },
  { id: 'science', icon: '🧪', label: 'スポーツ科学', effect: '選手の調子が安定し、好調が出やすくなる' },
  { id: 'analysis', icon: '📊', label: '分析室', effect: '相手を分析して、試合で少し有利に戦える' },
];

export const FACILITY_MAX = 10;
/** 強化の費用（百万ユーロ）と工期（日程）。index = 次のレベル - 1 */
const COST = [15, 30, 50, 80, 120, 180, 260, 360, 480, 650];
const DAYS = [3, 5, 7, 9, 12, 14, 16, 18, 20, 24];

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

/** 医療センター：ケガが1日余分に治る確率 */
export function medicalBoost(state: GameState): number {
  return facilityLevel(state, 'medical') * 0.07;
}

/** スポーツ科学：調子の安定度への上乗せ */
export function scienceBoost(state: GameState): number {
  return facilityLevel(state, 'science') * 0.35;
}

/** 分析室：自分のチームの試合での上乗せ */
export function analysisBoost(state: GameState, teamId: string): number {
  return teamId === state.userTeamId ? 1 + facilityLevel(state, 'analysis') * 0.004 : 1;
}

/* ======================= スタジアム ======================= */

export const STADIUM_MAX = 10;
const ST_COST = [80, 120, 170, 230, 300, 380, 480, 600, 750, 950];
const ST_DAYS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25];

export function stadiumLevel(state: GameState): number {
  return state.stadium?.level ?? 0;
}

export function stadiumCapacity(state: GameState): number {
  return 30000 + stadiumLevel(state) * 6000;
}

export function stadiumCost(state: GameState): { cost: number; days: number } | null {
  const lv = stadiumLevel(state);
  return lv >= STADIUM_MAX ? null : { cost: ST_COST[lv], days: ST_DAYS[lv] };
}

export function startStadium(state: GameState): Result {
  const c = stadiumCost(state);
  if (!c) return { ok: false, message: 'これ以上拡張できません' };
  if (state.stadium?.building) return { ok: false, message: '拡張工事中です' };
  if (state.money < c.cost) return { ok: false, message: `資金が足りません（必要 ${fmtMoney(c.cost)}）` };
  state.money = round2(state.money - c.cost);
  state.stadium = { ...(state.stadium ?? { level: 0 }), building: state.day + c.days };
  return { ok: true, message: `スタジアムの拡張工事を始めました（完成まで ${c.days}日程）` };
}

export function stadiumTick(state: GameState) {
  const st = state.stadium;
  if (!st?.building || state.day < st.building) return;
  st.level++;
  delete st.building;
  const team = state.teams.find((t) => t.id === state.userTeamId);
  if (team) team.rep = Math.min(99, team.rep + 1);
  sendMail(state, {
    from: 'board',
    sender: 'クラブ会長',
    subject: `🏟 スタジアムがレベル${st.level}に（収容 ${stadiumCapacity(state).toLocaleString()}人）`,
    body: `スタジアムの拡張工事が完了しました。\n\nホームの試合の入場収入が増え、クラブの格も上がりました。`,
  });
}

/** ホームの試合の入場収入（百万ユーロ） */
export function gateIncome(state: GameState): number {
  return round2(stadiumLevel(state) * 0.35);
}

/** シーズンをまたぐ時：工事・遠征の残り日数を新しいシーズンの日付に合わせる */
export function shiftClubDays(state: GameState, by: number) {
  if (state.facilities?.building) state.facilities.building.done = Math.max(0, state.facilities.building.done - by);
  if (state.stadium?.building) state.stadium.building = Math.max(0, state.stadium.building - by);
  if (state.expedition) state.expedition.done = Math.max(0, state.expedition.done - by);
}

/* ======================= 特訓キャンプ ======================= */

export function campCost(p: Player, kind: 'stat' | 'skill'): number {
  const base = 8 * Math.pow(1.5, p.campCount ?? 0);
  return round2(kind === 'skill' ? base * 1.5 : base);
}

export function campSkillCandidates(p: Player): string[] {
  const fit = autoSkills(p.stats, p.position, p.style).filter((s) => !p.skills.includes(s));
  if (fit.length) return fit;
  const gk = p.position === 'GK';
  return SKILLS.filter((s) => !p.skills.includes(s.id) && (gk ? s.id.startsWith('gk') || s.id === 'pkStopper' : !s.id.startsWith('gk') && s.id !== 'pkStopper')).map((s) => s.id);
}

export function runCamp(state: GameState, playerId: string, kind: 'stat' | 'skill'): Result {
  const p = state.players[playerId];
  if (!p || p.teamId !== state.userTeamId) return { ok: false, message: '自分のクラブの選手を選んでください' };
  if (p.injury > 0) return { ok: false, message: 'ケガをしている選手は特訓できません' };
  if (p.campDay === state.day && p.campSeason === state.season) return { ok: false, message: 'この選手は今日もう特訓しました' };
  const cost = campCost(p, kind);
  if (state.money < cost) return { ok: false, message: `資金が足りません（必要 ${fmtMoney(cost)}）` };
  if (kind === 'skill') {
    if (p.skills.length >= 12) return { ok: false, message: 'これ以上スキルを覚えられません（最大12個）' };
    const cand = campSkillCandidates(p);
    if (!cand.length) return { ok: false, message: '覚えられるスキルがありません' };
    const sk = pick(cand);
    p.skills = [...p.skills, sk];
    pay();
    return { ok: true, message: `${p.name}が特殊スキル「${SKILLS.find((x) => x.id === sk)?.label ?? sk}」を覚えました！` };
  }
  const before = overall(p);
  const keys = (Object.keys(OVR_WEIGHTS[p.position]) as StatKey[]).filter((k) => p.stats[k] < 99);
  if (!keys.length) return { ok: false, message: 'もう伸ばせる能力がありません' };
  for (let i = 0; i < 4; i++) {
    const k = pick(keys);
    p.stats[k] = Math.min(99, p.stats[k] + randInt(1, 2));
  }
  pay();
  const after = overall(p);
  return { ok: true, message: after > before ? `${p.name}の総合値が ${before} → ${after} に上がりました！` : `${p.name}の能力が少し上がりました` };

  function pay() {
    state.money = round2(state.money - cost);
    p.campCount = (p.campCount ?? 0) + 1;
    p.campDay = state.day;
    p.campSeason = state.season;
  }
}

/* ======================= 海外スカウト遠征 ======================= */

export type Region = 'samerica' | 'africa' | 'asia' | 'eeurope';

export const REGIONS: { id: Region; label: string; icon: string; cost: number; nations: string[]; note: string }[] = [
  { id: 'samerica', label: '南米', icon: '🌎', cost: 70, nations: ['ブラジル', 'アルゼンチン', 'ウルグアイ', 'コロンビア', 'エクアドル'], note: 'テクニックのある攻撃的な選手が多い' },
  { id: 'africa', label: 'アフリカ', icon: '🌍', cost: 55, nations: ['ナイジェリア', 'ガーナ', 'セネガル', 'コートジボワール', 'カメルーン'], note: 'スピードと身体能力に優れた選手が多い' },
  { id: 'asia', label: 'アジア', icon: '🌏', cost: 45, nations: ['日本', '韓国', 'ウズベキスタン', 'オーストラリア', 'イラン'], note: '勤勉で技術の高い選手が多い' },
  { id: 'eeurope', label: '東欧', icon: '🏰', cost: 60, nations: ['セルビア', 'クロアチア', 'ポーランド', 'チェコ', 'ウクライナ'], note: '戦術眼のある守備的な選手が多い' },
];
const EXPEDITION_DAYS = 6;

export function startExpedition(state: GameState, region: Region): Result {
  const r = REGIONS.find((x) => x.id === region)!;
  if (state.expedition) return { ok: false, message: 'スカウトはすでに遠征中です' };
  if (state.money < r.cost) return { ok: false, message: `資金が足りません（必要 ${fmtMoney(r.cost)}）` };
  state.money = round2(state.money - r.cost);
  state.expedition = { region, done: state.day + EXPEDITION_DAYS };
  return { ok: true, message: `スカウトが${r.label}へ出発しました（${EXPEDITION_DAYS}日程後に報告が届きます）` };
}

/** 遠征の結果：掘り出し物の話を必ず持ち帰る（当たりが出やすい） */
export function expeditionTick(state: GameState, spawn: (state: GameState, opts: { nations: string[]; jackpot: number; bust: number; region: string }) => void) {
  const e = state.expedition;
  if (!e || state.day < e.done || state.gemOffer) return;
  const r = REGIONS.find((x) => x.id === e.region)!;
  delete state.expedition;
  spawn(state, { nations: r.nations, jackpot: 0.4, bust: 0.15, region: r.label });
}

/* ======================= お金持ちのクラブへの値上げ ======================= */

/** 資金が多いクラブには、他のクラブが移籍金を高めに要求してくる */
export function richMarkup(state: GameState): number {
  return 1 + Math.min(1, Math.max(0, (state.money - 300) / 1500));
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
