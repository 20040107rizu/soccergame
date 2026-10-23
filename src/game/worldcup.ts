import { earnBadge } from './badges';
import { logCareer } from './career';
import { managerLevel } from './collection';
import { generatePlayer } from './data';
import { createMatch, simulateToEnd, type LiveMatch } from './engine';
import { applyFormation, setAutoLineup, squadOf } from './lineup';
import { sendMail } from './mail';
import { FORMATIONS } from './positions';
import { clamp, pick, rand, randInt } from './rng';
import { bestFormation, bumpStats } from './season';
import { overall } from './stats';
import type { GameState, Player, Position, Team } from './types';

/* ======================= ワールドカップ（4シーズンに1回・32か国） ======================= */

export const WC_EVERY = 4;
export type WCStage = 'G' | 'R16' | 'QF' | 'SF' | 'F';
export const WC_STAGE_LABEL: Record<WCStage, string> = { G: 'グループリーグ', R16: 'ラウンド16', QF: '準々決勝', SF: '準決勝', F: '決勝' };
/** 日ごとのステージ（0〜2 がグループリーグ） */
const DAY_STAGE: WCStage[] = ['G', 'G', 'G', 'R16', 'QF', 'SF', 'F'];
export const WC_DAYS = DAY_STAGE.length;

/** 代表チーム（23人の登録メンバー付き） */
export type WCTeam = Team & { squad: string[] };

export interface WCFixture {
  id: string;
  day: number;
  stage: WCStage;
  group?: number;
  home: string;
  away: string;
  result?: { home: number; away: number; pk?: [number, number] };
  goals?: { nation: string; id: string; minute: number }[];
}

export interface WorldCup {
  /** 終わったシーズン（このシーズンのあとに開催） */
  season: number;
  stage: 'offer' | 'play' | 'done';
  /** 次に行う日（0〜6） */
  day: number;
  nations: string[];
  groups: string[][];
  teams: Record<string, WCTeam>;
  /** 自クラブ以外にも、選手が足りない国のための代表選手 */
  extras: Record<string, Player>;
  fixtures: WCFixture[];
  offers?: string[];
  /** 監督を引き受けた国 */
  coach?: string;
  goals: Record<string, number>;
  ratings: Record<string, { sum: number; n: number }>;
  champion?: string;
  runnerUp?: string;
  mvp?: string;
  topScorer?: string;
}

export interface WCHistory {
  season: number;
  champion: string;
  runnerUp: string;
  mvp?: { name: string; nation: string };
  topScorer?: { name: string; nation: string; goals: number };
  coach?: string;
  coachResult?: string;
}

/** 国ごとの層の厚さ（代表に足りない選手を補う時の強さ） */
const NATION_BASE: Record<string, number> = {
  フランス: 80, イングランド: 80, スペイン: 80, ブラジル: 80, アルゼンチン: 80, ドイツ: 79, ポルトガル: 79, オランダ: 78,
  ベルギー: 77, イタリア: 77, クロアチア: 76, ウルグアイ: 75, コロンビア: 75, モロッコ: 74, デンマーク: 74, スイス: 74,
  ノルウェー: 73, 日本: 73, セネガル: 73, アメリカ: 73, メキシコ: 73, ポーランド: 72, エクアドル: 72, トルコ: 72,
  オーストリア: 72, 韓国: 72, ナイジェリア: 71, コートジボワール: 71, セルビア: 71, スウェーデン: 71, ウクライナ: 71,
  エジプト: 70, カメルーン: 70, カナダ: 70, スコットランド: 70, チェコ: 70, パラグアイ: 70, ハンガリー: 70,
  ガーナ: 69, アルジェリア: 69, ウェールズ: 69, オーストラリア: 69, チリ: 69, ジョージア: 69, ギリシャ: 68,
  スロバキア: 68, アイルランド: 68, ルーマニア: 68, チュニジア: 67, サウジアラビア: 66,
};

const NATION_COLORS: Record<string, [string, string]> = {
  フランス: ['#1f3a93', '#ffffff'], イングランド: ['#ffffff', '#c8102e'], スペイン: ['#c60b1e', '#ffc400'], ブラジル: ['#ffdf00', '#009c3b'],
  アルゼンチン: ['#75aadb', '#ffffff'], ドイツ: ['#ffffff', '#000000'], ポルトガル: ['#a50021', '#006600'], オランダ: ['#ff7f00', '#ffffff'],
  ベルギー: ['#c8102e', '#000000'], イタリア: ['#0066b3', '#ffffff'], クロアチア: ['#e30a17', '#ffffff'], 日本: ['#00008b', '#ffffff'],
  ウルグアイ: ['#5cbfeb', '#ffffff'], アメリカ: ['#ffffff', '#002868'], メキシコ: ['#006847', '#ffffff'], 韓国: ['#c60c30', '#ffffff'],
};

const QUOTA: { pos: Position[]; n: number }[] = [
  { pos: ['GK'], n: 3 },
  { pos: ['CB', 'LSB', 'RSB'], n: 8 },
  { pos: ['DMF', 'CMF', 'OMF', 'LMF', 'RMF'], n: 7 },
  { pos: ['LWG', 'RWG', 'ST', 'CF'], n: 5 },
];
const FILL_POS: Position[][] = [['GK'], ['CB', 'CB', 'LSB', 'RSB'], ['DMF', 'CMF', 'CMF', 'OMF', 'LMF', 'RMF'], ['LWG', 'RWG', 'CF', 'ST']];

const JP_FAMILY = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '松本', '井上', '木村', '林', '清水', '山崎', '森', '池田', '橋本', '石川', '前田', '藤田', '岡田', '長谷川', '村上', '近藤', '坂本', '遠山'];
const JP_GIVEN = ['翔', '蓮', '大翔', '湊', '陽斗', '悠真', '颯', '樹', '海斗', '蒼', '大和', '陸', '拓海', '隼人', '健太', '涼介', '亮', '航', '優斗', '瑛太', '凌', '直樹', '圭吾', '佑真'];
const KR_FAMILY = ['キム', 'イ', 'パク', 'チェ', 'チョン', 'カン', 'チョ', 'ユン'];
const KR_GIVEN = ['ミンジェ', 'ソンフン', 'ジウ', 'ヒョンウ', 'ドユン', 'ジュンホ', 'テヒ', 'ウヨン'];

/** 代表に補う選手の名前（その国らしく） */
function nationName(nation: string, fallback: string): string {
  if (nation === '日本') return pick(JP_FAMILY) + pick(JP_GIVEN);
  if (nation === '韓国') return `${pick(KR_FAMILY)}・${pick(KR_GIVEN)}`;
  return fallback;
}

export function wcPlayer(state: GameState, id: string): Player | undefined {
  return state.players[id] ?? state.worldCup?.extras[id];
}

/** 代表の23人（自クラブ・他クラブの選手から選び、足りなければ補う） */
function nationSquad(state: GameState, nation: string, extras: Record<string, Player>): string[] {
  const pool = Object.values(state.players)
    .filter((p) => p.nationality === nation && p.teamId && p.injury <= 3)
    .sort((a, b) => overall(b) - overall(a));
  const ids: string[] = [];
  const base = NATION_BASE[nation] ?? 66;
  QUOTA.forEach((q, qi) => {
    const got = pool.filter((p) => q.pos.includes(p.position) && !ids.includes(p.id)).slice(0, q.n);
    ids.push(...got.map((p) => p.id));
    for (let i = got.length; i < q.n; i++) {
      const p = generatePlayer({ position: pick(FILL_POS[qi]), level: base + randInt(-4, 2), age: randInt(21, 31), teamId: null });
      p.id = `wcx_${nation}_${qi}_${i}`;
      p.nationality = nation;
      p.name = nationName(nation, p.name);
      extras[p.id] = p;
      ids.push(p.id);
    }
  });
  return ids;
}

/** 試合・編成用の一時的な状態（セーブには書き込まない） */
export function wcState(state: GameState, nations: string[], user?: string): GameState {
  const wc = state.worldCup!;
  const players: Record<string, Player> = {};
  const teams: Team[] = [];
  for (const n of nations) {
    const t = wc.teams[n];
    teams.push(structuredClone(t));
    for (const id of [...t.lineup, ...t.bench, ...(wcSquads(wc)[n] ?? [])]) {
      const p = wcPlayer(state, id);
      if (p && !players[id]) players[id] = { ...structuredClone(p), teamId: n, injury: 0, suspension: 0 };
    }
  }
  return {
    ...state,
    userTeamId: user ?? '__none__',
    teams,
    players,
    fixtures: [],
    flags: {},
    rivals: {},
    zone: 0,
    facilities: undefined,
    worldCup: undefined,
  } as GameState;
}

/** 国ごとの23人（チームのスタメン・控え・ベンチ外） */
export function wcSquads(wc: WorldCup): Record<string, string[]> {
  return Object.fromEntries(Object.values(wc.teams).map((t) => [t.id, t.squad]));
}

function nationTeam(state: GameState, nation: string, squad: string[], extras: Record<string, Player>): WCTeam {
  const [c1, c2] = NATION_COLORS[nation] ?? ['#2f6fb5', '#ffffff'];
  const t: WCTeam = {
    id: nation,
    name: nation,
    en: '',
    short: nation.slice(0, 3),
    color: c1,
    color2: c2,
    rep: 85,
    country: nation,
    league: 'EU',
    formation: '4-3-3',
    tactic: 'balance',
    lineup: [],
    slots: FORMATIONS['4-3-3'].map((x) => ({ ...x })),
    spirit: 80,
    bench: [],
    budget: 0,
    squad,
  };
  const tmp = { ...state, players: Object.fromEntries(squad.map((id) => [id, { ...(state.players[id] ?? extras[id]), teamId: nation }])) } as GameState;
  applyFormation(t, bestFormation(tmp, t));
  setAutoLineup(tmp, t);
  return t;
}

export function teamRating(state: GameState, t: Team): number {
  const xs = t.lineup.map((id) => wcPlayer(state, id)).filter(Boolean) as Player[];
  return xs.length ? Math.round(xs.reduce((a, p) => a + overall(p), 0) / xs.length) : 0;
}

/** シーズン終了時：ワールドカップの年なら開幕する */
export function maybeStartWorldCup(state: GameState, completedSeason: number) {
  if (completedSeason % WC_EVERY !== 0 || state.worldCup) return;
  startWorldCup(state, completedSeason);
}

export function startWorldCup(state: GameState, season: number): WorldCup {
  const extras: Record<string, Player> = {};
  const cand = Object.keys(NATION_BASE);
  const teams: Record<string, WCTeam> = {};
  for (const n of cand) teams[n] = nationTeam(state, n, nationSquad(state, n, extras), extras);
  state.worldCup = { season, stage: 'offer', day: 0, nations: [], groups: [], teams, extras, fixtures: [], goals: {}, ratings: {} };
  const rating = (n: string) => teamRating(state, teams[n]);
  let nations = [...cand].sort((a, b) => rating(b) - rating(a)).slice(0, 32);
  if (!nations.includes('日本')) nations = [...nations.slice(0, 31), '日本'];
  nations.sort((a, b) => rating(b) - rating(a));
  const wc = state.worldCup;
  wc.teams = Object.fromEntries(nations.map((n) => [n, teams[n]]));
  for (const id of Object.keys(extras)) if (!nations.some((n) => teams[n].squad.includes(id))) delete extras[id];
  wc.nations = nations;
  // ポット分け（強さ順に8か国ずつ）→ 8グループ
  const pots = [0, 1, 2, 3].map((i) => nations.slice(i * 8, i * 8 + 8).sort(() => rand() - 0.5));
  wc.groups = Array.from({ length: 8 }, (_, g) => pots.map((p) => p[g]));
  wc.groups.forEach((g, gi) => {
    const pairs: [number, number][][] = [
      [[0, 1], [2, 3]],
      [[0, 2], [3, 1]],
      [[3, 0], [1, 2]],
    ];
    pairs.forEach((day, d) => day.forEach(([a, b], k) => wc.fixtures.push({ id: `wc${gi}${d}${k}`, day: d, stage: 'G', group: gi, home: g[a], away: g[b] })));
  });
  // 代表監督のオファー（監督レベルが高いほど強い国から）
  const lv = managerLevel(state);
  const band = lv >= 300 ? nations.slice(0, 4) : lv >= 100 ? nations.slice(4, 12) : lv >= 30 ? nations.slice(12, 24) : nations.slice(20, 32);
  const offers = [...band].sort(() => rand() - 0.5).slice(0, 2);
  if (!offers.includes('日本')) offers.push('日本');
  wc.offers = offers;
  const mine = squadOf(state, state.userTeamId).filter((p) => nations.some((n) => wc.teams[n].squad.includes(p.id)));
  sendMail(state, {
    from: 'league',
    sender: 'FIFA',
    subject: '🌍 ワールドカップ開幕！代表監督のオファーが届いています',
    body: `4年に1度のワールドカップが開幕します。32か国が世界一をかけて戦います。\n\n${offers.join('・')}の協会から、代表監督をお願いしたいとの話が届いています。ホーム画面から返事をしてください。\n\nあなたのクラブからは${mine.length}人が代表に選ばれました。${mine.length ? '\n' + mine.map((p) => `・${p.name}（${p.nationality}）`).join('\n') : ''}`,
    important: true,
  });
  return wc;
}

/** 代表監督を引き受ける（null なら断って観戦） */
export function answerWCOffer(state: GameState, nation: string | null) {
  const wc = state.worldCup;
  if (!wc || wc.stage !== 'offer') return;
  wc.coach = nation && wc.offers?.includes(nation) ? nation : undefined;
  wc.stage = 'play';
}

function recordMatch(wc: WorldCup, f: WCFixture, st: GameState, m: LiveMatch) {
  f.result = { home: m.score.home, away: m.score.away };
  f.goals = m.events
    .filter((e) => e.type === 'goal' && e.playerId)
    .map((e) => ({ nation: e.side === 'home' ? f.home : f.away, id: e.playerId!, minute: e.minute }));
  for (const g of f.goals) wc.goals[g.id] = (wc.goals[g.id] ?? 0) + 1;
  for (const key of ['home', 'away'] as const)
    for (const id of m[key].usedPlayers) {
      const r = (wc.ratings[id] = wc.ratings[id] ?? { sum: 0, n: 0 });
      r.sum += m.ratings[id] ?? 6;
      r.n++;
    }
  if (f.stage !== 'G' && f.result.home === f.result.away) {
    const ra = sideStrength(st, f.home);
    const rb = sideStrength(st, f.away);
    let pa = 3 + Math.round(rand() * 2 + (ra - rb) / 15);
    let pb = 3 + Math.round(rand() * 2 + (rb - ra) / 15);
    pa = clamp(pa, 1, 5);
    pb = clamp(pb, 1, 5);
    if (pa === pb) rand() < 0.5 ? pa++ : pb++;
    f.result.pk = [pa, pb];
  }
}

function sideStrength(st: GameState, nation: string): number {
  const t = st.teams.find((x) => x.id === nation)!;
  return t.lineup.reduce((a, id) => a + (st.players[id] ? overall(st.players[id]) : 0), 0) / 11;
}

export function winnerOf(f: WCFixture): string {
  const r = f.result!;
  if (r.home !== r.away) return r.home > r.away ? f.home : f.away;
  return r.pk && r.pk[0] > r.pk[1] ? f.home : f.away;
}

/** 代表監督の試合（その日に自分の国の試合があるか） */
export function coachFixture(state: GameState): WCFixture | undefined {
  const wc = state.worldCup;
  if (!wc?.coach || wc.stage !== 'play') return;
  return wc.fixtures.find((f) => f.day === wc.day && !f.result && (f.home === wc.coach || f.away === wc.coach));
}

/** 自分の国の試合を、試合画面で采配する用の状態 */
export function coachMatch(state: GameState): { state: GameState; match: LiveMatch } | null {
  const f = coachFixture(state);
  if (!f) return null;
  const st = wcState(state, [f.home, f.away], state.worldCup!.coach);
  st.fixtures = [{ id: f.id, comp: 'CL', day: 0, home: f.home, away: f.away, stage: f.stage === 'F' ? 'F' : undefined }];
  return { state: st, match: createMatch(st, f.id) };
}

/** その日の試合をすべて行う（live は采配した自分の国の試合） */
export function playWCDay(state: GameState, live?: { state: GameState; match: LiveMatch }) {
  const wc = state.worldCup;
  if (!wc || wc.stage !== 'play') return;
  for (const f of wc.fixtures.filter((x) => x.day === wc.day && !x.result)) {
    if (live && live.match.fixtureId === f.id) {
      recordMatch(wc, f, live.state, live.match);
      continue;
    }
    const st = wcState(state, [f.home, f.away]);
    st.fixtures = [{ id: f.id, comp: 'CL', day: 0, home: f.home, away: f.away, stage: f.stage === 'F' ? 'F' : undefined }];
    const m = createMatch(st, f.id);
    simulateToEnd(st, m);
    recordMatch(wc, f, st, m);
  }
  wc.day++;
  if (wc.day >= WC_DAYS) return finishTournament(state);
  if (DAY_STAGE[wc.day] !== 'G' && !wc.fixtures.some((f) => f.day === wc.day)) makeKnockout(wc);
}

export interface WCTableRow {
  nation: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  points: number;
}

export function groupTable(wc: WorldCup, g: number): WCTableRow[] {
  const rows = new Map(wc.groups[g].map((n) => [n, { nation: n, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0 }]));
  for (const f of wc.fixtures.filter((x) => x.stage === 'G' && x.group === g && x.result)) {
    const h = rows.get(f.home)!;
    const a = rows.get(f.away)!;
    h.played++;
    a.played++;
    h.gf += f.result!.home;
    h.ga += f.result!.away;
    a.gf += f.result!.away;
    a.ga += f.result!.home;
    if (f.result!.home > f.result!.away) (h.win++, a.loss++, (h.points += 3));
    else if (f.result!.home < f.result!.away) (a.win++, h.loss++, (a.points += 3));
    else (h.draw++, a.draw++, h.points++, a.points++);
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);
}

function makeKnockout(wc: WorldCup) {
  const stage = DAY_STAGE[wc.day];
  let pairs: [string, string][] = [];
  if (stage === 'R16') {
    for (let g = 0; g < 8; g += 2) {
      const a = groupTable(wc, g);
      const b = groupTable(wc, g + 1);
      pairs.push([a[0].nation, b[1].nation], [b[0].nation, a[1].nation]);
    }
  } else {
    const prev = wc.fixtures.filter((f) => f.day === wc.day - 1).map(winnerOf);
    for (let i = 0; i < prev.length; i += 2) pairs.push([prev[i], prev[i + 1]]);
  }
  pairs.forEach(([h, a], i) => wc.fixtures.push({ id: `wc${stage}${i}`, day: wc.day, stage, home: h, away: a }));
}

function finishTournament(state: GameState) {
  const wc = state.worldCup!;
  const final = wc.fixtures.find((f) => f.stage === 'F')!;
  wc.champion = winnerOf(final);
  wc.runnerUp = final.home === wc.champion ? final.away : final.home;
  const ranked = Object.entries(wc.ratings).filter(([, r]) => r.n >= 4);
  wc.mvp = ranked.sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n)[0]?.[0];
  wc.topScorer = Object.entries(wc.goals).sort((a, b) => b[1] - a[1])[0]?.[0];
  wc.stage = 'done';
  const name = (id?: string) => (id ? wcPlayer(state, id)?.name ?? '' : '');
  const nationOf = (id?: string) => (id ? Object.values(wc.teams).find((t) => t.squad.includes(id))?.id ?? '' : '');
  const coachRes = wc.coach ? coachResult(wc, wc.coach) : undefined;
  state.wcHistory = [
    ...(state.wcHistory ?? []),
    {
      season: wc.season,
      champion: wc.champion,
      runnerUp: wc.runnerUp,
      mvp: wc.mvp ? { name: name(wc.mvp), nation: nationOf(wc.mvp) } : undefined,
      topScorer: wc.topScorer ? { name: name(wc.topScorer), nation: nationOf(wc.topScorer), goals: wc.goals[wc.topScorer] } : undefined,
      coach: wc.coach,
      coachResult: coachRes,
    },
  ];
  if (wc.coach && wc.champion === wc.coach) {
    earnBadge(state, 'wcCoach');
    if (wc.coach === '日本') earnBadge(state, 'wcJapan');
  }
  if (wc.mvp && state.players[wc.mvp]?.teamId === state.userTeamId) earnBadge(state, 'wcMvp');
  sendMail(state, {
    from: 'league',
    sender: 'FIFA',
    subject: `🏆 ワールドカップ優勝は${wc.champion}！`,
    body: `決勝で${wc.champion}が${wc.runnerUp}を破り、世界の頂点に立ちました。\n\n大会MVP：${name(wc.mvp)}（${nationOf(wc.mvp)}）\n得点王：${name(wc.topScorer)}（${nationOf(wc.topScorer)}・${wc.goals[wc.topScorer ?? ''] ?? 0}点）${wc.coach ? `\n\nあなたが率いた${wc.coach}は「${coachRes}」でした。` : ''}`,
    important: true,
  });
}

/** その国がどこまで勝ち進んだか */
export function coachResult(wc: WorldCup, nation: string): string {
  if (wc.champion === nation) return '優勝';
  if (wc.runnerUp === nation) return '準優勝';
  const last = [...wc.fixtures].reverse().find((f) => f.home === nation || f.away === nation);
  return last ? (last.stage === 'G' ? 'グループリーグ敗退' : `${WC_STAGE_LABEL[last.stage]}敗退`) : '';
}

/** 大会を締めくくり、自クラブの選手に影響を残してクラブのシーズンに戻る */
export function closeWorldCup(state: GameState) {
  const wc = state.worldCup;
  if (!wc || wc.stage !== 'done') return;
  const squads = wcSquads(wc);
  for (const [nation, ids] of Object.entries(squads)) {
    const res = coachResult(wc, nation);
    for (const id of ids) {
      const p = state.players[id];
      if (!p) continue;
      const r = wc.ratings[id];
      if (!r) continue;
      const avg = r.sum / r.n;
      // 大舞台での経験：活躍した若手は伸びる。疲れやケガも
      if (p.age <= 24 && avg >= 7) for (let i = 0; i < 4; i++) bumpStats(p, 1);
      if (rand() < 0.04) p.injury = Math.max(p.injury, randInt(2, 6));
      p.condition = 2;
      if (p.teamId === state.userTeamId) {
        const extra = [id === wc.mvp ? '大会MVP' : '', id === wc.topScorer ? `得点王（${wc.goals[id]}点）` : ''].filter(Boolean).join('・');
        logCareer(state, p, 'worldcup', `ワールドカップ ${nation}代表（${res}${(wc.goals[id] ?? 0) ? `・${wc.goals[id]}得点` : ''}）${extra ? `　🏅${extra}` : ''}`);
      }
    }
  }
  delete state.worldCup;
}
