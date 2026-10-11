import { FORMATIONS } from './positions';
import { clamp, pick, rand, weighted } from './rng';
import { ratingAt } from './stats';
import type { Formation, GameState, Player, Position, Tactic } from './types';
import { available } from './lineup';

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
  formation: Formation;
  tactic: Tactic;
  /** フォーメーション枠順。退場で空いた枠は '' */
  lineup: string[];
  bench: string[];
  subsUsed: number;
  energy: Record<string, number>;
  yellow: Record<string, number>;
  sentOff: string[];
  injured: string[];
  usedPlayers: string[];
  enteredAt: Record<string, number>;
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
  return m;
}

/* ---------------- 戦力計算 ---------------- */

const ATTACK_W: Record<Position, number> = { GK: 0, CB: 0.1, LB: 0.4, RB: 0.4, DMF: 0.3, CMF: 0.6, LMF: 0.8, RMF: 0.8, AMF: 1, LWF: 1.1, RWF: 1.1, SS: 1.1, CF: 1.2 };
const MID_W: Record<Position, number> = { GK: 0, CB: 0.15, LB: 0.3, RB: 0.3, DMF: 1, CMF: 1.2, LMF: 0.7, RMF: 0.7, AMF: 0.9, LWF: 0.4, RWF: 0.4, SS: 0.4, CF: 0.2 };
const DEF_W: Record<Position, number> = { GK: 0, CB: 1.2, LB: 0.9, RB: 0.9, DMF: 0.9, CMF: 0.35, LMF: 0.3, RMF: 0.3, AMF: 0.1, LWF: 0.1, RWF: 0.1, SS: 0.05, CF: 0 };
const SHOT_W: Record<Position, number> = { GK: 0, CB: 0.35, LB: 0.4, RB: 0.4, DMF: 0.5, CMF: 1.1, LMF: 1.6, RMF: 1.6, AMF: 2.5, LWF: 3, RWF: 3, SS: 4, CF: 5 };

interface OnPitch {
  p: Player;
  pos: Position;
  eff: number;
}

export function onPitch(state: GameState, side: SideState): OnPitch[] {
  const slots = FORMATIONS[side.formation];
  const list: OnPitch[] = [];
  side.lineup.forEach((id, i) => {
    const p = state.players[id];
    if (!p || !slots[i]) return;
    list.push({ p, pos: slots[i].pos, eff: effRating(p, slots[i].pos, side.energy[id] ?? 100, side.injured.includes(id)) });
  });
  return list;
}

export function effRating(p: Player, pos: Position, energy: number, injured = false): number {
  const base = ratingAt(p, pos);
  return base * COND_MUL[p.condition] * (0.8 + 0.2 * energy / 100) * (injured ? 0.7 : 1);
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

export function sidePower(state: GameState, side: SideState): Power {
  const list = onPitch(state, side);
  const short = 11 - list.length; // 退場者
  const captain = list.some((o) => o.p.skills.includes('captaincy')) ? 1 : 0;
  const k = 1 - short * 0.07;
  const mul = (o: OnPitch) => o.eff / Math.max(1, ratingAt(o.p, o.pos));
  const gk = list.find((o) => o.pos === 'GK');
  return {
    attack: (wavg(list, ATTACK_W, (o) => (o.eff + (o.p.stats.offense + o.p.stats.finishing) / 2 * mul(o)) / 2) + captain) * k,
    midfield: (wavg(list, MID_W, (o) => (o.eff + (o.p.stats.lowPass + o.p.stats.ballControl) / 2 * mul(o)) / 2) + captain) * k,
    defense: (wavg(list, DEF_W, (o) => (o.eff + (o.p.stats.defense + o.p.stats.ballWinning) / 2 * mul(o)) / 2) + captain) * k,
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
  if (m.finished) return [];
  const before = m.events.length;
  m.minute++;
  const minute = m.minute;

  if (minute === 46) m.events.push({ minute: 45, type: 'half', text: `前半終了 ${m.score.home}-${m.score.away}` });

  for (const key of ['home', 'away'] as SideKey[]) drainEnergy(state, m[key]);

  const ph = sidePower(state, m.home);
  const pa = sidePower(state, m.away);
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

  if (minute >= 90) {
    m.finished = true;
    m.events.push({ minute: 90, type: 'full', text: `試合終了！ ${m.score.home}-${m.score.away}` });
    finalizeRatings(m);
  }
  return m.events.slice(before);
}

function tacticMod(t: Tactic, kind: 'for' | 'against'): number {
  if (t === 'attack') return kind === 'for' ? 0.015 : 0.006;
  if (t === 'defense') return kind === 'for' ? -0.012 : -0.01;
  return 0;
}

function drainEnergy(state: GameState, side: SideState) {
  const mul = side.tactic === 'attack' ? 1.12 : side.tactic === 'defense' ? 0.95 : 1;
  for (const id of side.lineup) {
    const p = state.players[id];
    if (!p) continue;
    const drain = (0.5 + ((100 - p.stats.stamina) / 100) * 0.75) * mul;
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
    const sub = o.p.skills.includes('superSub') && (m[atkKey].enteredAt[o.p.id] ?? 0) > 0 ? 1.3 : 1;
    return SHOT_W[o.pos] * Math.pow(key / 70, 3) * sub * (o.eff / 70);
  });
  const shooter = shooterO.p;
  const others = attackers.filter((o) => o.p.id !== shooter.id);
  const assistO =
    others.length && rand() < 0.78
      ? weighted(others, (o) => {
          const s = o.p.stats;
          const key = type === 'header' ? s.loftedPass + s.curl / 2 : s.lowPass + s.offense / 2;
          const sk = (o.p.skills.includes('throughPass') ? 1.2 : 1) * (type === 'header' && o.p.skills.includes('pinpointCross') ? 1.4 : 1);
          return Math.pow(key / 100, 3) * (MID_W[o.pos] + ATTACK_W[o.pos]) * sk;
        })
      : null;
  const assister = assistO?.p ?? null;
  const gkO = defenders.find((o) => o.pos === 'GK');
  const gk = gkO?.p;
  const shotY = 15 + rand() * 70;
  const s = shooter.stats;
  const effMul = shooterO.eff / Math.max(1, ratingAt(shooter, shooterO.pos));

  let quality: number;
  if (type === 'header') {
    quality = (s.heading * 0.6 + s.jump * 0.25 + s.physical * 0.15) * effMul;
    if (shooter.skills.includes('heading')) quality += 3;
    if (defenders.some((o) => o.p.skills.includes('aerial'))) quality -= 2;
  } else if (type === 'long') {
    quality = (s.kickingPower * 0.4 + s.finishing * 0.3 + s.curl * 0.3) * effMul - 8;
    if (shooter.skills.includes('longShot') || shooter.skills.includes('knuckle')) quality += 4;
    if (shooter.skills.includes('longCurler')) quality += 2;
  } else {
    quality = (s.finishing * 0.6 + s.offense * 0.25 + s.ballControl * 0.15) * effMul;
    if (shooter.skills.includes('firstTime') || shooter.skills.includes('acrobatic')) quality += 2;
    if (shooter.skills.includes('chipShot')) quality += 1;
  }
  if (defenders.some((o) => o.p.skills.includes('blocker'))) quality -= 1.5;
  if (defenders.some((o) => o.p.skills.includes('manMarking') || o.p.skills.includes('interception'))) quality -= 1;

  const penalty = rand() < 0.03;
  let goalP = penalty ? 0.76 : clamp(0.3 + (quality - def.keeper * 0.55 - def.defense * 0.2) / 120, 0.05, 0.6);
  if (penalty) {
    if (shooter.skills.includes('pkTaker')) goalP += 0.06;
    if (gk?.skills.includes('gkPenalty')) goalP -= 0.1;
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
    const text = pick(GOAL_TEXT)(name) + (assister && !penalty ? `（アシスト：${last(assister)}）` : '');
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

function finalizeRatings(m: LiveMatch) {
  const diff = m.score.home - m.score.away;
  for (const key of ['home', 'away'] as SideKey[]) {
    const bonus = key === 'home' ? Math.sign(diff) * 0.3 : -Math.sign(diff) * 0.3;
    for (const id of m[key].usedPlayers) {
      const conceded = key === 'home' ? m.score.away : m.score.home;
      let r = (m.ratings[id] ?? 6) + bonus + (rand() - 0.5) * 0.6;
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

export function setTactic(m: LiveMatch, key: SideKey, t: Tactic) {
  if (m[key].tactic === t) return;
  m[key].tactic = t;
  const label = t === 'attack' ? '攻撃的' : t === 'defense' ? '守備的' : 'バランス';
  m.events.push({ minute: m.minute, type: 'tactic', side: key, text: `作戦変更：${label}` });
}

export function setFormation(m: LiveMatch, key: SideKey, f: Formation) {
  if (m[key].formation === f) return;
  m[key].formation = f;
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
    const slots = FORMATIONS[side.formation];
    const tired = side.lineup
      .map((id, i) => ({ id, i }))
      .filter((x) => x.id && slots[x.i].pos !== 'GK' && (side.energy[x.id] ?? 100) < 62)
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
  const pos = FORMATIONS[side.formation][idx].pos;
  const cand = side.bench
    .map((id) => state.players[id])
    .filter((p): p is Player => !!p && (pos === 'GK') === (p.position === 'GK'))
    .sort((a, b) => ratingAt(b, pos) - ratingAt(a, pos))[0];
  if (cand) substitute(state, m, key, outId, cand.id);
}

/** 試合を最後まで自動で進める */
export function simulateToEnd(state: GameState, m: LiveMatch) {
  while (!m.finished) {
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
