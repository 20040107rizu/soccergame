import { FORMATIONS, posFromXY } from './positions';
import { clamp, pick, rand, weighted } from './rng';
import { ratingAt, styleActive } from './stats';
import type { Formation, FormationLabel, GameState, Player, Position, Tactic } from './types';
import { available } from './lineup';
import { hiddenTrait, matchBonuses } from './events';

/**
 * 1 分ずつ進む試合エンジン。途中で交代・作戦・フォーメーションを変更できる。
 * 状態はプレーンなオブジェクトなので、React の state にそのまま入れられる。
 */

export type SideKey = 'home' | 'away';

export type EventType = 'kickoff' | 'chance' | 'goal' | 'save' | 'miss' | 'post' | 'block' | 'yellow' | 'red' | 'injury' | 'sub' | 'half' | 'full' | 'tactic';

export interface MatchEvent {
  minute: number;
  type: EventType;
  side?: SideKey;
  playerId?: string;
  assistId?: string;
  outId?: string;
  text: string;
  /** ハイライト用：シュート位置（0-100） */
  shotY?: number;
  penalty?: boolean;
}

export interface SideState {
  teamId: string;
  formation: FormationLabel;
  tactic: Tactic;
  /** スタメン（slots と同じ順）。退場で空いた枠は '' */
  lineup: string[];
  slots: { x: number; y: number }[];
  spirit: number;
  bench: string[];
  subsUsed: number;
  energy: Record<string, number>;
  yellow: Record<string, number>;
  sentOff: string[];
  injured: string[];
  usedPlayers: string[];
  enteredAt: Record<string, number>;
  /** 隠し特性・恩返しなどによる選手ごとの能力補正 */
  bonus?: Record<string, number>;
}

export interface LiveMatch {
  fixtureId: string;
  comp: 'PL' | 'CL';
  neutral: boolean;
  minute: number;
  home: SideState;
  away: SideState;
  score: { home: number; away: number };
  events: MatchEvent[];
  finished: boolean;
  ratings: Record<string, number>;
  /** ユーザーの判断が必要（負傷者が出た等） */
  attention?: string;
  /** ハーフタイムで止まっている（後半開始ボタン待ち） */
  halfTime?: boolean;
  secondHalf?: boolean;
  /** 選手ごとのシュート数（ウィルパワー用） */
  shots?: Record<string, number>;
}

export const MAX_SUBS = 5;

const COND_MUL: Record<number, number> = { 1: 0.92, 2: 0.96, 3: 1, 4: 1.04, 5: 1.08 };

function sideFromTeam(state: GameState, teamId: string): SideState {
  const t = state.teams.find((x) => x.id === teamId)!;
  const energy: Record<string, number> = {};
  for (const id of [...t.lineup, ...t.bench]) energy[id] = 100;
  return {
    teamId,
    formation: t.formation,
    tactic: t.tactic,
    lineup: [...t.lineup],
    slots: t.slots.map((x) => ({ ...x })),
    spirit: t.spirit ?? 75,
    bench: [...t.bench].filter((id) => state.players[id] && available(state.players[id])),
    subsUsed: 0,
    energy,
    yellow: {},
    sentOff: [],
    injured: [],
    usedPlayers: [...t.lineup],
    enteredAt: Object.fromEntries(t.lineup.map((id) => [id, 0])),
  };
}

export function createMatch(state: GameState, fixtureId: string): LiveMatch {
  const f = state.fixtures.find((x) => x.id === fixtureId)!;
  const home = state.teams.find((t) => t.id === f.home)!;
  const away = state.teams.find((t) => t.id === f.away)!;
  const m: LiveMatch = {
    fixtureId,
    comp: f.comp,
    neutral: f.stage === 'F',
    minute: 0,
    home: sideFromTeam(state, f.home),
    away: sideFromTeam(state, f.away),
    score: { home: 0, away: 0 },
    events: [{ minute: 0, type: 'kickoff', text: `${home.name} 対 ${away.name}、キックオフ！` }],
    finished: false,
    ratings: {},
  };
  for (const id of [...m.home.lineup, ...m.away.lineup]) m.ratings[id] = 6;
  m.home.bonus = matchBonuses(state, f, home, away);
  m.away.bonus = matchBonuses(state, f, away, home);
  return m;
}

/* ---------------- 戦力計算 ---------------- */

const ATTACK_W: Record<Position, number> = { GK: 0, CB: 0.1, LSB: 0.4, RSB: 0.4, DMF: 0.3, CMF: 0.6, LMF: 0.8, RMF: 0.8, OMF: 1, LWG: 1.1, RWG: 1.1, ST: 1.1, CF: 1.2 };
const MID_W: Record<Position, number> = { GK: 0, CB: 0.15, LSB: 0.3, RSB: 0.3, DMF: 1, CMF: 1.2, LMF: 0.7, RMF: 0.7, OMF: 0.9, LWG: 0.4, RWG: 0.4, ST: 0.4, CF: 0.2 };
const DEF_W: Record<Position, number> = { GK: 0, CB: 1.2, LSB: 0.9, RSB: 0.9, DMF: 0.9, CMF: 0.35, LMF: 0.3, RMF: 0.3, OMF: 0.1, LWG: 0.1, RWG: 0.1, ST: 0.05, CF: 0 };
const SHOT_W: Record<Position, number> = { GK: 0, CB: 0.35, LSB: 0.4, RSB: 0.4, DMF: 0.5, CMF: 1.1, LMF: 1.6, RMF: 1.6, OMF: 2.5, LWG: 3, RWG: 3, ST: 4, CF: 5 };

/** 枠のポジション */
export function sideRoles(side: SideState): Position[] {
  return side.slots.map((s) => posFromXY(s.x, s.y));
}

interface OnPitch {
  p: Player;
  pos: Position;
  eff: number;
}

export function onPitch(state: GameState, side: SideState): OnPitch[] {
  const roles = sideRoles(side);
  const list: OnPitch[] = [];
  side.lineup.forEach((id, i) => {
    const p = state.players[id];
    if (!p || !roles[i]) return;
    // プレースタイルがそのポジションで有効ならわずかに能力が上がる（無効なら「無印」）
    const style = styleActive(p.style, roles[i]) ? 1.01 : 1;
    const bonus = side.bonus?.[id] ?? 1;
    list.push({ p, pos: roles[i], eff: effRating(p, roles[i], side.energy[id] ?? 100, side.injured.includes(id)) * style * bonus });
  });
  return list;
}

export function effRating(p: Player, pos: Position, energy: number, injured = false): number {
  const base = ratingAt(p, pos);
  const legend = p.legend ? (p.legend.kind === 'monster' ? 1.05 : 1.02) : 1;
  return base * legend * COND_MUL[p.condition] * (0.8 + 0.2 * energy / 100) * (injured ? 0.7 : 1);
}

function wavg(list: OnPitch[], w: Record<Position, number>, f: (o: OnPitch) => number): number {
  let s = 0;
  let t = 0;
  for (const o of list) {
    s += f(o) * w[o.pos];
    t += w[o.pos];
  }
  return t ? s / t : 40;
}

export interface Power {
  attack: number;
  midfield: number;
  defense: number;
  keeper: number;
}

export function sidePower(state: GameState, side: SideState, ctx?: { second: boolean; lead: number }): Power {
  const list = onPitch(state, side);
  const short = 11 - list.length; // 退場者
  const has = (id: string) => list.some((o) => o.p.skills.includes(id));
  const captain = has('captaincy') ? 1 : 0;
  // チームスピリット：連携（パス・ポジショニング・反応）に影響
  const k = (1 - short * 0.07) * (0.94 + 0.06 * (side.spirit ?? 75) / 99);
  const second = ctx?.second ?? false;
  const lead = ctx?.lead ?? 0;
  const atkBonus = (has('attackTrigger') ? 0.6 : 0) + (has('attackSurge') ? 0.4 : 0) + (has('momentumDribble') ? 0.4 : 0) + (second && lead <= 0 && has('gameChanging') ? 0.8 : 0);
  const defBonus = (has('gkDirecting') ? 0.6 : 0) + (second && lead > 0 && has('fortress') ? 1 : 0) + (second && lead > 0 && has('gkSpiritRoar') ? 0.6 : 0) + (has('chasing') ? 0.3 : 0);
  const mul = (o: OnPitch) => o.eff / Math.max(1, ratingAt(o.p, o.pos));
  const gk = list.find((o) => o.pos === 'GK');
  return {
    attack: (wavg(list, ATTACK_W, (o) => (o.eff + (o.p.stats.offense + o.p.stats.finishing) / 2 * mul(o)) / 2) + captain + atkBonus) * k,
    midfield: (wavg(list, MID_W, (o) => (o.eff + (o.p.stats.lowPass + o.p.stats.ballControl) / 2 * mul(o)) / 2) + captain) * k,
    defense: (wavg(list, DEF_W, (o) => (o.eff + (o.p.stats.defense + o.p.stats.ballWinning + o.p.stats.defEngagement) / 3 * mul(o)) / 2) + captain + defBonus) * k,
    keeper: gk ? gkRating(gk.p) * mul(gk) : 35,
  };
}

function gkRating(p: Player): number {
  const s = p.stats;
  return s.gkAwareness * 0.3 + s.gkReflexes * 0.3 + s.gkReach * 0.25 + s.gkCatching * 0.15;
}

/* ---------------- 実況テキスト ---------------- */

const last = (p: Player) => {
  const n = p.name.split(/[・\s]/).pop() ?? p.name;
  return n.length >= 2 ? n : p.name;
};

const CHANCE_TEXT = {
  ground: [
    (n: string) => `${n}がドリブルで仕掛ける！`,
    (n: string) => `${n}へ縦パスが通った！`,
    (n: string) => `こぼれ球に${n}が反応！`,
    (n: string) => `${n}、裏へ抜け出した！`,
  ],
  header: [(n: string, a: string) => `${a}のクロス！ 中で${n}が合わせる！`, (n: string) => `コーナーキックから${n}がヘディング！`],
  long: [(n: string) => `${n}、ミドルレンジから狙う！`, (n: string) => `${n}の強烈なロングシュート！`],
};
const GOAL_TEXT = [(n: string) => `ゴール！！ ${n}が決めた！`, (n: string) => `ネットが揺れる！ ${n}のゴール！`, (n: string) => `見事なフィニッシュ！ ${n}！`];
const SAVE_TEXT = [(g: string) => `GK${g}がビッグセーブ！`, (g: string) => `${g}が横っ飛びでかき出した！`, (g: string) => `${g}、落ち着いてキャッチ。`];
const MISS_TEXT = ['シュートは枠の外！', '惜しくもバーの上！', '大きく外れた…'];

/* ---------------- 1 分進める ---------------- */

export function stepMinute(state: GameState, m: LiveMatch): MatchEvent[] {
  if (m.finished || m.halfTime) return [];
  const before = m.events.length;
  m.minute++;
  const minute = m.minute;

  for (const key of ['home', 'away'] as SideKey[]) drainEnergy(state, m[key]);

  const second = minute > 45;
  const ph = sidePower(state, m.home, { second, lead: m.score.home - m.score.away });
  const pa = sidePower(state, m.away, { second, lead: m.score.away - m.score.home });
  const homeAdv = m.neutral ? 0 : 0.03;
  const possHome = clamp(0.5 + (ph.midfield - pa.midfield) / 80 + homeAdv, 0.25, 0.75);
  const atkKey: SideKey = rand() < possHome ? 'home' : 'away';
  const defKey: SideKey = atkKey === 'home' ? 'away' : 'home';
  const atk = atkKey === 'home' ? ph : pa;
  const def = atkKey === 'home' ? pa : ph;

  let chanceP = 0.07 + (atk.attack - def.defense) / 500;
  chanceP += tacticMod(m[atkKey].tactic, 'for') + tacticMod(m[defKey].tactic, 'against');
  if (m[atkKey].lineup.some((id) => state.players[id]?.skills.includes('fighting')) && minute > 70 && m.score[atkKey] < m.score[defKey]) chanceP += 0.01;
  chanceP = clamp(chanceP, 0.025, 0.17);

  if (rand() < chanceP) shotEvent(state, m, atkKey, defKey, def);

  foulEvents(state, m);
  injuryEvents(state, m);

  // CPU 側の采配
  for (const key of ['home', 'away'] as SideKey[]) {
    if (m[key].teamId !== state.userTeamId) aiManage(state, m, key);
  }

  if (minute === 45 && !m.secondHalf) {
    m.halfTime = true;
    m.events.push({ minute: 45, type: 'half', text: `前半終了 ${m.score.home}-${m.score.away}` });
  }

  if (minute >= 90) {
    m.finished = true;
    m.events.push({ minute: 90, type: 'full', text: `試合終了！ ${m.score.home}-${m.score.away}` });
    finalizeRatings(state, m);
  }
  return m.events.slice(before);
}

function tacticMod(t: Tactic, kind: 'for' | 'against'): number {
  if (t === 'attack') return kind === 'for' ? 0.015 : 0.006;
  if (t === 'defense') return kind === 'for' ? -0.012 : -0.01;
  return 0;
}

function drainEnergy(state: GameState, side: SideState) {
  let mul = side.tactic === 'attack' ? 1.12 : side.tactic === 'defense' ? 0.95 : 1;
  if (side.lineup.some((id) => state.players[id]?.skills.includes('captaincy'))) mul *= 0.92;
  for (const id of side.lineup) {
    const p = state.players[id];
    if (!p) continue;
    const drain = (0.5 + ((100 - p.stats.stamina) / 100) * 0.75) * mul * (p.skills.includes('fighting') ? 0.92 : 1);
    side.energy[id] = Math.max(5, (side.energy[id] ?? 100) - drain);
  }
}

function shotEvent(state: GameState, m: LiveMatch, atkKey: SideKey, defKey: SideKey, def: Power) {
  const attackers = onPitch(state, m[atkKey]).filter((o) => o.pos !== 'GK');
  const defenders = onPitch(state, m[defKey]);
  if (!attackers.length) return;
  const r = rand();
  const type: 'ground' | 'header' | 'long' = r < 0.22 ? 'header' : r < 0.37 ? 'long' : 'ground';

  const shooterO = weighted(attackers, (o) => {
    const s = o.p.stats;
    const key = type === 'header' ? (s.heading + s.jump) / 2 : type === 'long' ? (s.kickingPower + s.finishing) / 2 : (s.finishing + s.offense) / 2;
    const sub = o.p.skills.includes('superSub') && (m[atkKey].enteredAt[o.p.id] ?? 0) >= 45 ? 1.35 : 1;
    const clutch = m.minute >= 75 && hiddenTrait(o.p) === 'clutch' ? 1.8 : 1;
    const revenge = o.p.exTeamId === m[defKey].teamId ? 1.4 : 1;
    return SHOT_W[o.pos] * Math.pow(key / 70, 3) * sub * (o.eff / 70) * (o.p.legend ? 1.3 : 1) * clutch * revenge;
  });
  const shooter = shooterO.p;
  const others = attackers.filter((o) => o.p.id !== shooter.id);
  const assistO =
    others.length && rand() < 0.78
      ? weighted(others, (o) => {
          const s = o.p.stats;
          const key = type === 'header' ? s.loftedPass + s.curl / 2 : s.lowPass + s.offense / 2;
          const has = (x: string) => o.p.skills.includes(x);
          const sk = (has('throughPass') || has('visionary') ? 1.2 : 1) * (type === 'header' && (has('pinpointCross') || has('edgeCross')) ? 1.4 : 1);
          return Math.pow(key / 100, 3) * (MID_W[o.pos] + ATTACK_W[o.pos]) * sk;
        })
      : null;
  const assister = assistO?.p ?? null;
  const gkO = defenders.find((o) => o.pos === 'GK');
  const gk = gkO?.p;
  const shotY = 15 + rand() * 70;
  const s = shooter.stats;
  const sub = shooter.skills.includes('superSub') && (m[atkKey].enteredAt[shooter.id] ?? 0) >= 45 ? 1.04 : 1;
  const effMul = (shooterO.eff / Math.max(1, ratingAt(shooter, shooterO.pos))) * sub;
  const sk = (id: string) => shooter.skills.includes(id);
  const dsk = (id: string) => defenders.some((o) => o.p.skills.includes(id));
  m.shots = m.shots ?? {};
  m.shots[shooter.id] = (m.shots[shooter.id] ?? 0) + 1;
  const will = sk('willpower') ? Math.min(8, m.shots[shooter.id]) * 0.4 : 0;

  let quality: number;
  const legendQ = shooter.legend ? (shooter.legend.kind === 'monster' ? 4 : 2) : 0;
  if (type === 'header') {
    quality = (s.heading * 0.6 + s.jump * 0.25 + s.physical * 0.15) * effMul;
    if (sk('header')) quality += 3;
    if (sk('bulletHeader')) quality += 2;
    if (dsk('aerial') || dsk('aerialFort')) quality -= 2;
  } else if (type === 'long') {
    quality = (s.kickingPower * 0.4 + s.finishing * 0.3 + s.curl * 0.3) * effMul - 8;
    if (sk('middleShot')) quality += 4;
    if (sk('knuckle') || sk('dropShot') || sk('risingShot') || sk('lowScreamer')) quality += 2;
    if (sk('controlCurve') || sk('blitzCurve')) quality += 2;
  } else {
    quality = (s.finishing * 0.6 + s.offense * 0.25 + s.ballControl * 0.15) * effMul;
    if (sk('oneTouchShot')) quality += 2;
    if (sk('acrobaticShot') || sk('phenomFinish')) quality += 1.5;
    if (sk('controlLoop') || sk('heelTrick') || sk('snapStrike')) quality += 1;
  }
  quality += will + legendQ + (m.minute >= 75 && hiddenTrait(shooter) === 'clutch' ? 3 : 0);
  if (dsk('blocker')) quality -= 1.5;
  if (dsk('manMarking') || dsk('interception')) quality -= 1;
  if (dsk('sliding') || dsk('powerTackle') || dsk('longReach') || dsk('shadowHunt')) quality -= 0.5;

  const penalty = rand() < 0.03;
  let goalP = penalty ? 0.76 : clamp(0.3 + (quality - def.keeper * 0.55 - def.defense * 0.2) / 120, 0.05, 0.6);
  if (penalty) {
    if (sk('pkTaker')) goalP += 0.06;
    if (gk?.skills.includes('pkStopper')) goalP -= 0.1;
  }

  const name = last(shooter);
  const chanceText = penalty
    ? `PK獲得！ キッカーは${name}。`
    : type === 'header'
      ? pick(CHANCE_TEXT.header)(name, assister ? last(assister) : '味方')
      : pick(CHANCE_TEXT[type])(name);
  m.events.push({ minute: m.minute, type: 'chance', side: atkKey, playerId: shooter.id, text: chanceText, shotY, penalty });
  bump(m, shooter.id, 0.1);

  const x = rand();
  if (x < goalP) {
    m.score[atkKey]++;
    const revenge = shooter.exTeamId === m[defKey].teamId ? ' 古巣への恩返し弾！' : '';
    const text = pick(GOAL_TEXT)(name) + (assister && !penalty ? `（アシスト：${last(assister)}）` : '') + revenge;
    m.events.push({ minute: m.minute, type: 'goal', side: atkKey, playerId: shooter.id, assistId: penalty ? undefined : assister?.id, text, shotY, penalty });
    bump(m, shooter.id, 1);
    if (assister && !penalty) bump(m, assister.id, 0.6);
    if (gk) bump(m, gk.id, -0.4);
    for (const o of defenders) if (o.pos === 'CB') bump(m, o.p.id, -0.15);
  } else if (x < goalP + 0.33 && gk) {
    m.events.push({ minute: m.minute, type: 'save', side: atkKey, playerId: gk.id, text: pick(SAVE_TEXT)(last(gk)), shotY });
    bump(m, gk.id, 0.35);
  } else if (x < goalP + 0.4) {
    m.events.push({ minute: m.minute, type: 'post', side: atkKey, text: 'ポストに嫌われた！', shotY });
  } else if (x < goalP + 0.5) {
    const blocker = pick(defenders.filter((o) => o.pos !== 'GK'));
    if (blocker) {
      m.events.push({ minute: m.minute, type: 'block', side: atkKey, playerId: blocker.p.id, text: `${last(blocker.p)}が体を張ってブロック！`, shotY });
      bump(m, blocker.p.id, 0.2);
    }
  } else {
    m.events.push({ minute: m.minute, type: 'miss', side: atkKey, text: pick(MISS_TEXT), shotY });
  }
}

function foulEvents(state: GameState, m: LiveMatch) {
  for (const key of ['home', 'away'] as SideKey[]) {
    const side = m[key];
    const list = onPitch(state, side).filter((o) => o.pos !== 'GK');
    if (!list.length) continue;
    if (rand() < 0.0075) {
      const o = weighted(list, (x) => x.p.stats.aggression / 70 + (x.pos === 'CB' || x.pos === 'DMF' ? 0.5 : 0));
      const id = o.p.id;
      side.yellow[id] = (side.yellow[id] ?? 0) + 1;
      bump(m, id, -0.3);
      if (side.yellow[id] >= 2) {
        sendOff(side, id);
        m.events.push({ minute: m.minute, type: 'red', side: key, playerId: id, text: `${last(o.p)}に2枚目のイエロー！ 退場！` });
        bump(m, id, -1.2);
        if (side.teamId === state.userTeamId && !m.finished) m.attention = `${o.p.name}が退場しました`;
      } else {
        m.events.push({ minute: m.minute, type: 'yellow', side: key, playerId: id, text: `${last(o.p)}にイエローカード。` });
      }
    } else if (rand() < 0.0003) {
      const o = pick(list);
      sendOff(side, o.p.id);
      m.events.push({ minute: m.minute, type: 'red', side: key, playerId: o.p.id, text: `一発レッド！ ${last(o.p)}が退場！` });
      bump(m, o.p.id, -1.5);
      if (side.teamId === state.userTeamId) m.attention = `${o.p.name}が退場しました`;
    }
  }
}

function sendOff(side: SideState, id: string) {
  side.sentOff.push(id);
  side.lineup = side.lineup.map((x) => (x === id ? '' : x));
}

function injuryEvents(state: GameState, m: LiveMatch) {
  for (const key of ['home', 'away'] as SideKey[]) {
    const side = m[key];
    for (const id of side.lineup) {
      const p = state.players[id];
      if (!p || side.injured.includes(id)) continue;
      if (rand() < 0.000055 * (4 - p.traits.injuryRes)) {
        side.injured.push(id);
        m.events.push({ minute: m.minute, type: 'injury', side: key, playerId: id, text: `${last(p)}が負傷…プレー続行は難しそうだ。` });
        if (side.teamId === state.userTeamId) m.attention = `${p.name}が負傷しました。交代させましょう`;
      }
    }
  }
}

function bump(m: LiveMatch, id: string, v: number) {
  m.ratings[id] = (m.ratings[id] ?? 6) + v;
}

function finalizeRatings(state: GameState, m: LiveMatch) {
  const diff = m.score.home - m.score.away;
  for (const key of ['home', 'away'] as SideKey[]) {
    const bonus = key === 'home' ? Math.sign(diff) * 0.3 : -Math.sign(diff) * 0.3;
    for (const id of m[key].usedPlayers) {
      const conceded = key === 'home' ? m.score.away : m.score.home;
      let r = (m.ratings[id] ?? 6) + bonus + (rand() - 0.5) * 0.6;
      const lg = state.players[id]?.legend;
      if (lg) r += lg.kind === 'monster' ? 0.6 : 0.3;
      if (conceded === 0) r += 0.2;
      m.ratings[id] = Math.round(clamp(r, 3, 10) * 10) / 10;
    }
  }
}

/* ---------------- 交代・作戦 ---------------- */

export function canSub(side: SideState): boolean {
  return side.subsUsed < MAX_SUBS && side.bench.length > 0;
}

export function substitute(state: GameState, m: LiveMatch, key: SideKey, outId: string, inId: string): boolean {
  const side = m[key];
  if (!canSub(side) || !side.bench.includes(inId)) return false;
  const idx = side.lineup.indexOf(outId);
  if (idx < 0) return false;
  side.lineup[idx] = inId;
  side.bench = side.bench.filter((x) => x !== inId);
  side.subsUsed++;
  side.energy[inId] = side.energy[inId] ?? 100;
  side.usedPlayers.push(inId);
  side.enteredAt[inId] = m.minute;
  m.ratings[inId] = m.ratings[inId] ?? 6;
  const pin = state.players[inId];
  const pout = state.players[outId];
  m.events.push({ minute: m.minute, type: 'sub', side: key, playerId: inId, outId, text: `選手交代：${last(pout)} → ${last(pin)}` });
  m.attention = undefined;
  return true;
}

/** 試合中の選手の入れ替え（枠の交換）。交代枠は使わない */
export function swapSlots(m: LiveMatch, key: SideKey, a: number, b: number) {
  const l = m[key].lineup;
  [l[a], l[b]] = [l[b], l[a]];
}

/** 試合中に選手の位置を動かす（自由配置） */
export function moveSideSlot(m: LiveMatch, key: SideKey, i: number, x: number, y: number) {
  const side = m[key];
  const isGk = posFromXY(side.slots[i].x, side.slots[i].y) === 'GK';
  const cy = Math.max(2, Math.min(97, y));
  side.slots[i] = { x: Math.round(Math.max(4, Math.min(96, x))), y: Math.round(isGk ? Math.min(cy, 11) : Math.max(cy, 12.5)) };
  side.formation = 'カスタム';
}

/** 後半開始 */
export function startSecondHalf(m: LiveMatch) {
  m.halfTime = false;
  m.secondHalf = true;
}

export function setTactic(m: LiveMatch, key: SideKey, t: Tactic) {
  if (m[key].tactic === t) return;
  m[key].tactic = t;
  const label = t === 'attack' ? '攻撃的' : t === 'defense' ? '守備的' : 'バランス';
  m.events.push({ minute: m.minute, type: 'tactic', side: key, text: `作戦変更：${label}` });
}

export function setFormation(m: LiveMatch, key: SideKey, f: Formation) {
  if (m[key].formation === f) return;
  m[key].formation = f;
  m[key].slots = FORMATIONS[f].map((x) => ({ ...x }));
  m.events.push({ minute: m.minute, type: 'tactic', side: key, text: `フォーメーション変更：${f}` });
}

/** CPU の采配：疲労・負傷の交代、終盤の作戦変更 */
function aiManage(state: GameState, m: LiveMatch, key: SideKey) {
  const side = m[key];
  const other: SideKey = key === 'home' ? 'away' : 'home';
  const minute = m.minute;
  // 負傷者は即交代
  for (const id of side.injured) {
    if (side.lineup.includes(id) && canSub(side)) bestSubFor(state, m, key, id);
  }
  if ([58, 66, 74, 82].includes(minute)) {
    const roles = sideRoles(side);
    const tired = side.lineup
      .map((id, i) => ({ id, i }))
      .filter((x) => x.id && roles[x.i] !== 'GK' && (side.energy[x.id] ?? 100) < 62)
      .sort((a, b) => (side.energy[a.id] ?? 100) - (side.energy[b.id] ?? 100));
    const n = minute === 58 ? 1 : minute === 66 ? 2 : 1;
    for (const t of tired.slice(0, n)) if (canSub(side)) bestSubFor(state, m, key, t.id);
  }
  const diff = m.score[key] - m.score[other];
  if (minute === 70 && diff < 0) setTactic(m, key, 'attack');
  if (minute === 80 && diff > 0) setTactic(m, key, 'defense');
}

function bestSubFor(state: GameState, m: LiveMatch, key: SideKey, outId: string) {
  const side = m[key];
  const idx = side.lineup.indexOf(outId);
  if (idx < 0) return;
  const pos = sideRoles(side)[idx];
  const cand = side.bench
    .map((id) => state.players[id])
    .filter((p): p is Player => !!p && (pos === 'GK') === (p.position === 'GK'))
    .sort((a, b) => ratingAt(b, pos) - ratingAt(a, pos))[0];
  if (cand) substitute(state, m, key, outId, cand.id);
}

/** 試合を最後まで自動で進める */
export function simulateToEnd(state: GameState, m: LiveMatch) {
  while (!m.finished) {
    if (m.halfTime) startSecondHalf(m);
    stepMinute(state, m);
    // ユーザー側の負傷も自動で対応（観戦しない試合など）
    if (m.attention) {
      for (const key of ['home', 'away'] as SideKey[]) {
        for (const id of m[key].injured) if (m[key].lineup.includes(id) && canSub(m[key])) bestSubFor(state, m, key, id);
      }
      m.attention = undefined;
    }
  }
}
