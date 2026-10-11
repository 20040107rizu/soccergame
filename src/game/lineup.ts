import { FORMATIONS, posFromXY } from './positions';
import { ratingAt } from './stats';
import type { Formation, GameState, Player, Position, Team } from './types';

export function squadOf(state: GameState, teamId: string): Player[] {
  return Object.values(state.players).filter((p) => p.teamId === teamId);
}

export function available(p: Player): boolean {
  return p.injury <= 0 && p.suspension <= 0;
}

/** スタメン各枠のポジション（ピッチ上の位置から決まる） */
export function teamRoles(team: Team): Position[] {
  return team.slots.map((s) => posFromXY(s.x, s.y));
}

/** 調子を考慮した起用評価 */
function pickValue(p: Player, pos: Position): number {
  return ratingAt(p, pos) + (p.condition - 3) * 1.5;
}

/** 枠（ポジション）に合わせて最適なスタメンと控えを選ぶ */
export function autoLineup(players: Player[], roles: Position[]): { lineup: string[]; bench: string[] } {
  const pool = players.filter(available);
  const used = new Set<string>();
  const lineup: string[] = new Array(roles.length).fill('');
  const order = roles
    .map((pos, i) => ({ pos, i }))
    .sort((a, b) => prio(a.pos) - prio(b.pos))
    .map((x) => x.i);
  for (const i of order) {
    let best: Player | null = null;
    let bestVal = -Infinity;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const v = pickValue(p, roles[i]);
      if (v > bestVal) {
        bestVal = v;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      lineup[i] = best.id;
    }
  }
  const rest = pool.filter((p) => !used.has(p.id));
  const bench: string[] = [];
  const gk = rest.filter((p) => p.position === 'GK').sort((a, b) => ratingAt(b, 'GK') - ratingAt(a, 'GK'))[0];
  if (gk) bench.push(gk.id);
  for (const p of rest.filter((x) => x.id !== gk?.id).sort((a, b) => ratingAt(b, b.position) - ratingAt(a, a.position))) {
    if (bench.length >= 9) break;
    bench.push(p.id);
  }
  return { lineup: lineup.filter(Boolean).length === 11 ? lineup : fillEmpty(lineup, rest, players), bench };
}

function fillEmpty(lineup: string[], rest: Player[], all: Player[]): string[] {
  const used = new Set(lineup.filter(Boolean));
  const pool = [...rest, ...all].filter((p) => !used.has(p.id));
  return lineup.map((id) => {
    if (id) return id;
    const p = pool.shift();
    if (p) used.add(p.id);
    return p?.id ?? '';
  });
}

function prio(pos: string): number {
  return pos === 'GK' ? 0 : pos === 'CB' ? 1 : pos === 'CF' ? 2 : 3;
}

/** フォーメーションのプリセットを適用（位置を並べ直す） */
export function applyFormation(team: Team, f: Formation) {
  team.formation = f;
  team.slots = FORMATIONS[f].map((x) => ({ ...x }));
}

/** スタメン・控えから、居なくなった/出場できない選手を外して埋め直す */
export function repairLineup(state: GameState, team: Team, forceAvailable = false) {
  const squad = squadOf(state, team.id);
  const ids = new Set(squad.map((p) => p.id));
  const ok = (id: string) => ids.has(id) && (!forceAvailable || available(state.players[id]));
  const roles = teamRoles(team);
  const used = new Set<string>();
  const lineup = roles.map((_, i) => {
    const id = team.lineup[i];
    if (id && ok(id) && !used.has(id)) {
      used.add(id);
      return id;
    }
    return '';
  });
  roles.forEach((pos, i) => {
    if (lineup[i]) return;
    const best =
      squad.filter((p) => !used.has(p.id) && available(p)).sort((a, b) => pickValue(b, pos) - pickValue(a, pos))[0] ??
      squad.filter((p) => !used.has(p.id))[0];
    if (best) {
      used.add(best.id);
      lineup[i] = best.id;
    }
  });
  team.lineup = lineup;
  team.bench = (team.bench ?? []).filter((id) => ok(id) && !used.has(id));
  for (const p of squad.sort((a, b) => ratingAt(b, b.position) - ratingAt(a, a.position))) {
    if (team.bench.length >= 9) break;
    if (!used.has(p.id) && !team.bench.includes(p.id) && available(p)) team.bench.push(p.id);
  }
}

export function setAutoLineup(state: GameState, team: Team) {
  const r = autoLineup(squadOf(state, team.id), teamRoles(team));
  team.lineup = r.lineup;
  team.bench = r.bench;
}

export type Loc = { kind: 'pitch'; i: number } | { kind: 'bench'; id: string } | { kind: 'res'; id: string };

/** 編成画面での入れ替え（スタメン・ベンチ・ベンチ外） */
export function moveInTeam(team: Team, a: Loc, b: Loc) {
  const idOf = (l: Loc) => (l.kind === 'pitch' ? team.lineup[l.i] : l.id);
  const put = (l: Loc, id: string, old: string) => {
    if (l.kind === 'pitch') team.lineup[l.i] = id;
    else if (l.kind === 'bench') team.bench = team.bench.map((x) => (x === old ? id : x));
  };
  const ia = idOf(a);
  const ib = idOf(b);
  if (!ia || !ib || ia === ib) return;
  if (a.kind === 'bench' && b.kind === 'bench') {
    const i = team.bench.indexOf(ia);
    const j = team.bench.indexOf(ib);
    [team.bench[i], team.bench[j]] = [team.bench[j], team.bench[i]];
    return;
  }
  if (a.kind === 'res' && b.kind === 'res') return;
  put(a, ib, ia);
  put(b, ia, ib);
  if (a.kind === 'res' || b.kind === 'res') {
    const onPitch = new Set(team.lineup);
    team.bench = team.bench.filter((x) => !onPitch.has(x));
    while (team.bench.length > 9) team.bench.pop();
  }
}

/** 選手をピッチ上の好きな位置に動かす（自由配置） */
export function moveSlot(team: Team, i: number, x: number, y: number) {
  const cx = Math.max(4, Math.min(96, x));
  const cy = Math.max(2, Math.min(97, y));
  // GK 以外が GK エリアに入らないように（GK 枠は 1 つだけ）
  const isGk = posFromXY(team.slots[i].x, team.slots[i].y) === 'GK';
  const ny = isGk ? Math.min(cy, 11) : Math.max(cy, 12.5);
  team.slots[i] = { x: Math.round(cx), y: Math.round(ny) };
  team.formation = 'カスタム';
}

/* ---------------- チームスピリット ---------------- */

/** 適性ポジションで使えている割合（0〜1） */
export function fitRatio(state: GameState, team: Team): number {
  const roles = teamRoles(team);
  let ok = 0;
  team.lineup.forEach((id, i) => {
    const p = state.players[id];
    if (!p) return;
    const lv = p.position === roles[i] ? 3 : p.aptitudes[roles[i]] ?? 0;
    ok += lv >= 2 ? 1 : lv === 1 ? 0.6 : 0.2;
  });
  return ok / 11;
}

/**
 * 試合後のスピリット更新。適性ポジションで同じメンバーを使い続けると約1節で最大近くになり、
 * メンバーを入れ替えると少し下がる。
 */
export function updateSpirit(state: GameState, team: Team) {
  const prev = new Set(team.lastLineup ?? []);
  const changed = team.lastLineup ? team.lineup.filter((id) => !prev.has(id)).length : 0;
  const target = 55 + 44 * fitRatio(state, team);
  let s = team.spirit - changed * 2.5;
  s += (target - s) * 0.85;
  team.spirit = Math.round(Math.max(30, Math.min(99, s)));
  team.lastLineup = [...team.lineup];
}

/** 試合前のスピリット予測（入れ替えた人数ぶん少し下がる） */
export function spiritPreview(team: Team): number {
  const prev = new Set(team.lastLineup ?? team.lineup);
  const changed = team.lineup.filter((id) => !prev.has(id)).length;
  return Math.max(30, Math.round(team.spirit - changed * 2.5));
}
