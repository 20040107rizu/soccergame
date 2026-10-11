import { FORMATIONS } from './positions';
import { ratingAt } from './stats';
import type { GameState, Player, Team } from './types';

export function squadOf(state: GameState, teamId: string): Player[] {
  return Object.values(state.players).filter((p) => p.teamId === teamId);
}

export function available(p: Player): boolean {
  return p.injury <= 0 && p.suspension <= 0;
}

/** 調子を考慮した起用評価 */
function pickValue(p: Player, pos: Parameters<typeof ratingAt>[1]): number {
  return ratingAt(p, pos) + (p.condition - 3) * 1.5;
}

/** フォーメーションに合わせて最適なスタメンと控えを選ぶ */
export function autoLineup(players: Player[], formation: Team['formation']): { lineup: string[]; bench: string[] } {
  const slots = FORMATIONS[formation];
  const pool = players.filter(available);
  const used = new Set<string>();
  const lineup: string[] = new Array(slots.length).fill('');
  // GK → CB → その他の順に、各枠の最適な選手を割り当てる
  const order = slots
    .map((s, i) => ({ s, i }))
    .sort((a, b) => prio(a.s.pos) - prio(b.s.pos))
    .map((x) => x.i);
  for (const i of order) {
    let best: Player | null = null;
    let bestVal = -Infinity;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const v = pickValue(p, slots[i].pos);
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
  // 控え：GK1人＋総合値の高い順
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

/** スタメン・控えから、居なくなった/出場できない選手を外して埋め直す */
export function repairLineup(state: GameState, team: Team, forceAvailable = false) {
  const squad = squadOf(state, team.id);
  const ids = new Set(squad.map((p) => p.id));
  const ok = (id: string) => ids.has(id) && (!forceAvailable || available(state.players[id]));
  const slots = FORMATIONS[team.formation];
  const used = new Set<string>();
  const lineup = slots.map((_, i) => {
    const id = team.lineup[i];
    if (id && ok(id) && !used.has(id)) {
      used.add(id);
      return id;
    }
    return '';
  });
  slots.forEach((slot, i) => {
    if (lineup[i]) return;
    const best = squad
      .filter((p) => !used.has(p.id) && available(p))
      .sort((a, b) => pickValue(b, slot.pos) - pickValue(a, slot.pos))[0] ??
      squad.filter((p) => !used.has(p.id))[0];
    if (best) {
      used.add(best.id);
      lineup[i] = best.id;
    }
  });
  team.lineup = lineup;
  team.bench = team.bench.filter((id) => ok(id) && !used.has(id));
  for (const p of squad.sort((a, b) => ratingAt(b, b.position) - ratingAt(a, a.position))) {
    if (team.bench.length >= 9) break;
    if (!used.has(p.id) && !team.bench.includes(p.id) && available(p)) team.bench.push(p.id);
  }
}

export function setAutoLineup(state: GameState, team: Team) {
  const r = autoLineup(squadOf(state, team.id), team.formation);
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
    // ベンチ外は lineup/bench に含まれない選手なので何もしない
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
  // ベンチ外 → ベンチ/スタメンに入った選手が他の場所に重複しないように
  if (a.kind === 'res' || b.kind === 'res') {
    const onPitch = new Set(team.lineup);
    team.bench = team.bench.filter((x) => !onPitch.has(x));
    while (team.bench.length > 9) team.bench.pop();
  }
}
