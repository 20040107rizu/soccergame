import { FORMATIONS, ratingAt } from './rating';
import { clamp, pick, rand, weighted } from './rng';
import type { GameState, Player, Position, Team } from './types';

export type Side = 'home' | 'away';

export type MatchEventType = 'kickoff' | 'chance' | 'save' | 'miss' | 'post' | 'goal' | 'yellow' | 'half' | 'full';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  side?: Side;
  playerId?: string;
  assistId?: string;
  text: string;
  /** ハイライトで使う、シュート位置（0-100） */
  shotX?: number;
}

export interface MatchResult {
  home: number;
  away: number;
  events: MatchEvent[];
  /** 出場した選手のID */
  appeared: string[];
}

export interface TeamStrength {
  attack: number;
  midfield: number;
  defense: number;
  keeper: number;
  players: { player: Player; pos: Position }[];
}

const ATTACK_W: Record<Position, number> = { GK: 0, CB: 0.1, SB: 0.4, DMF: 0.3, CMF: 0.6, OMF: 1, WG: 1, CF: 1.2 };
const MID_W: Record<Position, number> = { GK: 0, CB: 0.1, SB: 0.3, DMF: 1, CMF: 1.2, OMF: 0.9, WG: 0.4, CF: 0.2 };
const DEF_W: Record<Position, number> = { GK: 0, CB: 1.2, SB: 0.9, DMF: 0.8, CMF: 0.3, OMF: 0.1, WG: 0.1, CF: 0 };
const SHOT_W: Record<Position, number> = { GK: 0, CB: 0.35, SB: 0.4, DMF: 0.5, CMF: 1.2, OMF: 2.5, WG: 2.8, CF: 5 };

function avgBy(list: { player: Player; pos: Position }[], w: Record<Position, number>, f: (p: Player, pos: Position) => number) {
  let s = 0;
  let t = 0;
  for (const { player, pos } of list) {
    s += f(player, pos) * w[pos];
    t += w[pos];
  }
  return t ? s / t : 50;
}

export function teamStrength(team: Team, players: Record<string, Player>): TeamStrength {
  const slots = FORMATIONS[team.formation];
  const list = team.lineup
    .map((id, i) => ({ player: players[id], pos: slots[i]?.pos }))
    .filter((x) => x.player && x.pos) as { player: Player; pos: Position }[];
  const gk = list.find((x) => x.pos === 'GK');
  return {
    attack: avgBy(list, ATTACK_W, (p, pos) => (ratingAt(p, pos) + p.stats.offense + p.stats.shoot) / 3),
    midfield: avgBy(list, MID_W, (p, pos) => (ratingAt(p, pos) + p.stats.pass + p.stats.stamina) / 3),
    defense: avgBy(list, DEF_W, (p, pos) => (ratingAt(p, pos) + p.stats.defense + p.stats.physical) / 3),
    keeper: gk ? ratingAt(gk.player, 'GK') : 40,
    players: list,
  };
}

const lastName = (p: Player) => p.name.split(/[・\s]/).pop() ?? p.name;

const CHANCE_TEXT = [
  (n: string) => `${n}がドリブルで仕掛ける！`,
  (n: string) => `${n}へ縦パスが通った！`,
  (n: string) => `サイドを崩してクロス、中で${n}が待つ！`,
  (n: string) => `こぼれ球に${n}が反応！`,
  (n: string) => `${n}、ミドルレンジから狙う！`,
];
const SAVE_TEXT = [(g: string) => `GK${g}がビッグセーブ！`, (g: string) => `${g}が横っ飛びでかき出した！`, (g: string) => `${g}、落ち着いてキャッチ。`];
const MISS_TEXT = ['シュートは枠の外！', '惜しくもバーの上！', '大きく外れた…'];
const GOAL_TEXT = [
  (n: string) => `ゴール！！ ${n}が決めた！`,
  (n: string) => `ネットが揺れる！ ${n}のゴール！`,
  (n: string) => `見事なフィニッシュ！ ${n}！`,
];

export function simulateMatch(state: GameState, homeId: string, awayId: string): MatchResult {
  const home = state.teams.find((t) => t.id === homeId)!;
  const away = state.teams.find((t) => t.id === awayId)!;
  const S: Record<Side, TeamStrength> = {
    home: teamStrength(home, state.players),
    away: teamStrength(away, state.players),
  };
  const events: MatchEvent[] = [{ minute: 0, type: 'kickoff', text: `${home.name} 対 ${away.name}、キックオフ！` }];
  const score = { home: 0, away: 0 };

  const possessionHome = clamp(0.5 + (S.home.midfield - S.away.midfield) / 80 + 0.03, 0.25, 0.75);

  for (let minute = 1; minute <= 90; minute++) {
    if (minute === 46) events.push({ minute: 45, type: 'half', text: `前半終了 ${score.home}-${score.away}` });
    const side: Side = rand() < possessionHome ? 'home' : 'away';
    const opp: Side = side === 'home' ? 'away' : 'home';
    const atk = S[side];
    const def = S[opp];
    const chanceP = clamp(0.07 + (atk.attack - def.defense) / 500, 0.03, 0.16);
    if (rand() < 0.012) {
      const fouler = pick(def.players.filter((x) => x.pos !== 'GK')).player;
      events.push({ minute, type: 'yellow', side: opp, playerId: fouler.id, text: `${lastName(fouler)}にイエローカード。` });
    }
    if (rand() >= chanceP) continue;

    const outfield = atk.players.filter((x) => x.pos !== 'GK');
    const shooter = weighted(outfield, (x) => SHOT_W[x.pos] * Math.pow(x.player.stats.shoot / 60, 2)).player;
    const others = outfield.filter((x) => x.player.id !== shooter.id);
    const assister = rand() < 0.75 ? weighted(others, (x) => Math.pow(x.player.stats.pass / 60, 2) * (MID_W[x.pos] + ATTACK_W[x.pos])).player : null;
    const gk = def.players.find((x) => x.pos === 'GK')?.player;
    const shotX = 20 + rand() * 60;

    events.push({ minute, type: 'chance', side, playerId: shooter.id, text: pick(CHANCE_TEXT)(lastName(shooter)), shotX });

    const quality = (shooter.stats.shoot * 0.6 + shooter.stats.offense * 0.4) - def.keeper * 0.55 - def.defense * 0.2;
    const goalP = clamp(0.3 + quality / 120, 0.08, 0.6);
    const r = rand();
    if (r < goalP) {
      score[side]++;
      const text = pick(GOAL_TEXT)(lastName(shooter)) + (assister ? `（アシスト：${lastName(assister)}）` : '');
      events.push({ minute, type: 'goal', side, playerId: shooter.id, assistId: assister?.id, text, shotX });
    } else if (r < goalP + 0.35 && gk) {
      events.push({ minute, type: 'save', side, playerId: gk.id, text: pick(SAVE_TEXT)(lastName(gk)), shotX });
    } else if (r < goalP + 0.42) {
      events.push({ minute, type: 'post', side, text: 'ポストに嫌われた！', shotX });
    } else {
      events.push({ minute, type: 'miss', side, text: pick(MISS_TEXT), shotX });
    }
  }
  events.push({ minute: 90, type: 'full', text: `試合終了！ ${home.short} ${score.home}-${score.away} ${away.short}` });

  return {
    home: score.home,
    away: score.away,
    events,
    appeared: [...S.home.players, ...S.away.players].map((x) => x.player.id),
  };
}
