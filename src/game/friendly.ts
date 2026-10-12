import { emptyStats } from './data';
import { createMatch, type LiveMatch } from './engine';
import { teamById } from './season';
import { STAT_KEYS } from './stats';
import type { Aptitudes, Appearance, FormationLabel, GameState, Player, Position, Stats, Tactic, Team } from './types';

/**
 * フレンドのチームのスナップショット（ランキングと一緒に送る）。
 * スタメン11人とベンチ（最大7人）を、親善試合に必要な分だけ短い形で持つ。
 */
export interface TeamSnapshot {
  v: 1;
  name: string;
  short: string;
  color: string;
  color2: string;
  formation: FormationLabel;
  tactic: Tactic;
  spirit: number;
  slots: { x: number; y: number }[];
  /** 先頭 11 人がスタメン（slots と同じ順）、残りがベンチ */
  players: SnapPlayer[];
}

interface SnapPlayer {
  n: string;
  p: Position;
  no: number;
  /** STAT_KEYS の順の能力値 */
  st: number[];
  sk: string[];
  sy: string;
  ap: Aptitudes;
  h?: number;
  ft: 'R' | 'L';
  ag: number;
  app: Appearance;
}

export function teamSnapshot(state: GameState): TeamSnapshot {
  const team = teamById(state, state.userTeamId);
  const ids = [...team.lineup, ...team.bench.slice(0, 7)];
  const players = ids
    .map((id) => state.players[id])
    .filter(Boolean)
    .map(
      (p): SnapPlayer => ({
        n: p.name,
        p: p.position,
        no: p.number,
        st: STAT_KEYS.map((k) => p.stats[k]),
        sk: p.skills,
        sy: p.style,
        ap: p.aptitudes,
        h: p.height,
        ft: p.foot,
        ag: p.age,
        app: p.appearance,
      }),
    );
  return {
    v: 1,
    name: team.name,
    short: team.short,
    color: team.color,
    color2: team.color2,
    formation: team.formation,
    tactic: team.tactic,
    spirit: Math.round(team.spirit),
    slots: team.slots,
    players,
  };
}

export function parseSnapshot(raw: unknown): TeamSnapshot | null {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!s || s.v !== 1 || !Array.isArray(s.players) || s.players.length < 11 || !Array.isArray(s.slots)) return null;
    return s as TeamSnapshot;
  } catch {
    return null;
  }
}

export const FRIEND_TEAM_ID = 'friend';

/** スナップショットから、表示・試合用の選手とチームを作る */
export function snapshotTeam(snap: TeamSnapshot, base: Team, nickname: string): { team: Team; players: Record<string, Player> } {
  const players: Record<string, Player> = {};
  const ids: string[] = [];
  snap.players.forEach((sp, i) => {
    const id = `fr_${i}`;
    ids.push(id);
    const stats = {} as Stats;
    STAT_KEYS.forEach((k, j) => (stats[k] = Number(sp.st[j]) || 50));
    players[id] = {
      id,
      name: sp.n,
      nameEn: '',
      nationality: '',
      age: sp.ag || 25,
      height: sp.h,
      position: sp.p,
      aptitudes: sp.ap ?? { [sp.p]: 3 },
      foot: sp.ft === 'L' ? 'L' : 'R',
      number: sp.no,
      stats,
      traits: { weakFootUse: 2, weakFootAcc: 2, form: 5, injuryRes: 2 },
      skills: sp.sk ?? [],
      style: sp.sy,
      potential: 0,
      growth: 'normal',
      teamId: FRIEND_TEAM_ID,
      contractYears: 1,
      salary: 0,
      condition: 3,
      injury: 0,
      suspension: 0,
      ambition: 50,
      loyalty: 50,
      season: emptyStats(),
      career: emptyStats(),
      appearance: sp.app ?? { skin: 2, hairStyle: 1, hairColor: 0 },
    };
  });
  const team: Team = {
    ...base,
    id: FRIEND_TEAM_ID,
    name: `${snap.name}（${nickname}）`,
    en: '',
    short: snap.short,
    color: snap.color,
    color2: snap.color2,
    formation: snap.formation,
    tactic: snap.tactic,
    spirit: snap.spirit,
    slots: snap.slots,
    lineup: ids.slice(0, 11),
    bench: ids.slice(11),
    lastLineup: undefined,
    original: false,
  };
  return { team, players };
}

/**
 * 親善試合用の一時的なゲーム状態を作る（自分のセーブには一切書き込まない）。
 * 自分のクラブ（ホーム）とフレンドのクラブ（アウェー）の試合を1つだけ持つ。
 */
export function friendlyMatch(state: GameState, snap: TeamSnapshot, nickname: string): { state: GameState; match: LiveMatch } {
  const temp: GameState = structuredClone(state);
  const me = teamById(temp, temp.userTeamId);
  const { team, players } = snapshotTeam(snap, me, nickname);
  Object.assign(temp.players, players);
  temp.teams = [...temp.teams.filter((t) => t.id !== FRIEND_TEAM_ID), team];
  temp.fixtures = [{ id: 'friendly', comp: 'PL', day: temp.day, home: me.id, away: FRIEND_TEAM_ID }];
  return { state: temp, match: createMatch(temp, 'friendly') };
}
