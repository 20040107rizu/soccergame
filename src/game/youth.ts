import { academyBoost } from './club';
import { generatePlayer } from './data';
import { fairSalary, fmtMoney, round2 } from './economy';
import { squadOf } from './lineup';
import { sendMail } from './mail';
import { NEIGHBORS } from './positions';
import { clamp, pick, rand, randInt, uid, weighted } from './rng';
import { overall, OVR_WEIGHTS, STAT_KEYS } from './stats';
import { MAX_SQUAD, type Result } from './transfer';
import type { GameState, Player, Position, StatKey, YouthFocus, YouthTalent } from './types';
import { POSITIONS } from './types';

/* ======================= ユースチーム ======================= */

/** ユースの枠（トップチームの登録人数とは別） */
export const YOUTH_MAX = 8;
/** 代理人に相談する費用 */
export const CONSULT_COST = 2;
const AGENT = '育成専門の代理人 マルティン';
const COACH = 'ユース監督';

export const FOCUS_OPTIONS: { v: YouthFocus; label: string }[] = [
  { v: 'auto', label: 'おまかせ' },
  { v: 'shoot', label: 'シュート' },
  { v: 'pass', label: 'パス' },
  { v: 'dribble', label: 'ドリブル' },
  { v: 'defense', label: '守備' },
  { v: 'physical', label: 'フィジカル' },
  { v: 'gk', label: 'GK' },
];

export const FOCUS_KEYS: Record<Exclude<YouthFocus, 'auto'>, StatKey[]> = {
  shoot: ['finishing', 'offense', 'kickingPower', 'heading', 'curl', 'setPiece'],
  pass: ['lowPass', 'loftedPass', 'ballControl', 'curl', 'offense'],
  dribble: ['dribbling', 'ballControl', 'tightPossession', 'balance', 'acceleration', 'speed'],
  defense: ['defense', 'ballWinning', 'aggression', 'defEngagement', 'heading'],
  physical: ['speed', 'acceleration', 'physical', 'stamina', 'jump', 'balance'],
  gk: ['gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach', 'jump'],
};

/** 年齢ごとの総合値の目安（15〜19歳） */
const CURVE: Record<YouthTalent, number[]> = {
  normal: [46, 51, 56, 60, 63],
  hard: [46, 52, 58, 64, 67],
  genius: [51, 58, 65, 72, 76],
  late: [44, 48, 52, 56, 61],
  grand: [45, 49, 54, 59, 65],
};

const HINTS: Record<YouthTalent, string[]> = {
  genius: [
    'ボールを持った時の落ち着きが、15歳とは思えません。本物の天才かもしれません。',
    '教えたことを一度で覚えてしまう。こういう子は滅多にいませんよ。',
    '同年代の中では、もう別格に見えます。',
  ],
  hard: [
    '誰よりも早く来て、誰よりも遅く帰る子です。努力は裏切らないでしょう。',
    '練習の虫です。地道に、着実に伸びていくタイプだと思います。',
    '派手さはありませんが、毎日少しずつ上手くなっています。',
  ],
  late: [
    'まだ体ができていません。体ができてから一気に伸びるかもしれません。',
    '今は目立ちませんが、20歳を過ぎてから化ける子もいます。',
    '焦らず待てる環境があれば、面白い存在になるかもしれません。',
  ],
  grand: [
    '今はまだ粗削りですが…伸びきった時の姿が想像できないくらい大きい。',
    '時間はかかるでしょう。ただ、器の大きさは誰よりも上です。',
    '正直、今の数字だけで判断するのはもったいない子です。',
  ],
  normal: [
    '素直でいい子です。育て方次第でしょう。',
    '今のところは、平均的な有望株という印象です。',
    '突出したものはまだ見えませんが、まじめな子ですよ。',
  ],
};

const TALENTS: YouthTalent[] = ['genius', 'hard', 'late', 'grand', 'normal'];

export function youthKids(state: GameState): Player[] {
  return Object.values(state.youth?.kids ?? {}).sort((a, b) => b.age - a.age || overall(b) - overall(a));
}

function rollTalent(state: GameState): YouthTalent {
  const lv = academyBoost(state);
  const w: Record<YouthTalent, number> = { genius: 4 + lv * 0.4, grand: 4 + lv * 0.3, late: 14, hard: 20, normal: 58 - lv * 0.7 };
  return weighted(TALENTS, (t) => w[t]);
}

/** その年齢・時期に目指す総合値 */
function targetOvr(state: GameState, kid: Player, ageF: number): number {
  const y = kid.youth!;
  const c = CURVE[y.talent];
  const i = clamp(ageF - 15, 0, c.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(c.length - 1, lo + 1);
  const base = c[lo] + (c[hi] - c[lo]) * (i - lo);
  const years = Math.max(0, ageF - 15);
  return base + (y.var ?? 0) + academyBoost(state) * 0.15 * years;
}

/** ユースの選手を1人作る */
export function makeKid(state: GameState, age = 15, force?: YouthTalent): Player {
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const pos: Position = pick(POSITIONS.filter((p) => p !== 'ST'));
  const talent = force ?? rollTalent(state);
  const kid = generatePlayer({ position: pos, level: 50, age, teamId: null, custom: team?.original });
  kid.id = uid('y');
  kid.youth = { talent, focus: 'auto', join: state.season, hist: [], hints: [], var: randInt(-2, 2), acc: 0 };
  // 入団時の総合値に合わせる
  const want = Math.round(targetOvr(state, kid, age)) + randInt(-1, 1);
  for (let i = 0; i < 400 && overall(kid) > want; i++) bump(kid, -1, 'auto');
  for (let i = 0; i < 400 && overall(kid) < want; i++) bump(kid, 1, 'auto');
  kid.height = Math.max(150, (kid.height ?? 175) - (18 - age) * 3 - randInt(0, 4));
  kid.skills = kid.skills.slice(0, 1);
  kid.contractYears = 0;
  kid.salary = 0;
  kid.loyalty = 80;
  kid.ambition = randInt(20, 80);
  if (talent === 'hard') kid.traits.form = Math.max(kid.traits.form, randInt(5, 7));
  kid.youth.hist.push([age, overall(kid)]);
  return kid;
}

function bump(p: Player, amount: number, focus: YouthFocus) {
  const pos = OVR_WEIGHTS[p.position];
  // 伸びきった能力より、まだ伸びる能力が上がりやすい
  const room = (k: StatKey) => (amount > 0 ? Math.max(0.5, 99 - p.stats[k]) : 1);
  const all = STAT_KEYS.filter((x) => !x.startsWith('gk') || p.position === 'GK');
  let k: StatKey;
  if (focus === 'auto' || rand() < 0.25) k = weighted(all, (x) => ((pos[x] ?? 0) + (p.position === 'GK' && !pos[x] ? 0 : 0.25)) * room(x));
  else k = weighted(FOCUS_KEYS[focus], room);
  p.stats[k] = clamp(p.stats[k] + amount, 30, 99);
}

/** 代理人の見立て（たまに外れる） */
function agentHint(kid: Player, accuracy: number): string {
  const t = rand() < accuracy ? kid.youth!.talent : pick(TALENTS.filter((x) => x !== kid.youth!.talent));
  return pick(HINTS[t]);
}

/** 新しい子をユースに迎える。代理人から見立てのメールが届く */
export function youthIntake(state: GameState, n: number, opts?: { ages?: number[]; season?: number }): Player[] {
  state.youth = state.youth ?? { kids: {} };
  const out: Player[] = [];
  const season = opts?.season ?? state.season;
  for (let i = 0; i < n && Object.keys(state.youth.kids).length < YOUTH_MAX; i++) {
    const kid = makeKid(state, opts?.ages?.[i] ?? 15);
    kid.youth!.join = season;
    kid.youth!.hints.push({ season, text: agentHint(kid, 0.75) });
    state.youth.kids[kid.id] = kid;
    out.push(kid);
  }
  if (out.length) {
    sendMail(state, {
      from: 'agent',
      sender: AGENT,
      subject: `【ユース】${out.length}人の子が入団しました`,
      body: `監督、今年もユースに新しい子たちが入ってきました。私なりの見立てをお伝えします。\n\n${out
        .map((k) => `■ ${k.name}（${k.age}歳・${k.position}）\n「${k.youth!.hints[0].text}」`)
        .join('\n\n')}\n\nあくまで私の目で見た印象です。気になる子がいれば、いつでも相談してください。`,
    });
  }
  return out;
}

/** 古いセーブ・新しいゲームにユースチームを用意する */
export function ensureYouth(state: GameState) {
  if (state.youth) return;
  state.youth = { kids: {} };
  youthIntake(state, 3, { ages: [15, 15, 16] });
}

/** 毎年入ってくる人数 */
export function intakeCount(state: GameState): number {
  return 2 + Math.floor(academyBoost(state) / 3);
}

/* ---------------- 毎日の成長とイベント ---------------- */

function mentorBonus(state: GameState, kid: Player): number {
  const m = kid.youth?.mentor ? state.players[kid.youth.mentor] : undefined;
  if (!m || m.teamId !== state.userTeamId) return 0;
  return m.position === kid.position ? 1.2 : 0.8;
}

export function youthTick(state: GameState) {
  const kids = youthKids(state);
  if (!kids.length) return;
  const len = state.calendar.length || 55;
  const frac = state.day / len;
  for (const kid of kids) {
    const y = kid.youth!;
    // 師匠がクラブを去った
    if (y.mentor && state.players[y.mentor]?.teamId !== state.userTeamId) {
      const m = state.players[y.mentor];
      y.mentor = undefined;
      sendMail(state, { from: 'coach', sender: COACH, subject: `【ユース】${kid.name}の師匠がいなくなりました`, body: `${m?.name ?? '師匠'}がクラブを離れたため、${kid.name}の師匠は不在になりました。\n新しい師匠を付けてあげてください。` });
    }
    if (y.offer && y.offer.expires < state.day) y.offer = undefined;
    const slumping = y.slump && y.slump.until > state.day;
    if (y.slump && y.slump.until <= state.day) endSlump(state, kid);
    if (!slumping) {
      // 1年でこれだけ伸びる予定（師匠がいるとさらに上乗せ）
      const now = targetOvr(state, kid, kid.age + frac);
      const next = targetOvr(state, kid, kid.age + Math.min(1, frac + 1 / len));
      const ovr = overall(kid);
      const behind = now + mentorBonus(state, kid) * frac - ovr;
      const pace = behind > 2 ? 1.6 : behind < -2 ? 0.4 : 1;
      y.acc = (y.acc ?? 0) + Math.max(0, next - now + mentorBonus(state, kid) / len) * 9 * pace;
      while (y.acc >= 1) {
        y.acc -= 1;
        bump(kid, 1, y.focus);
      }
    }
    // イベント
    if (!y.spurt && kid.age <= 17 && rand() < 0.3 / len) growthSpurt(state, kid);
    if (!y.slump && kid.age >= 16 && rand() < 0.15 / len) startSlump(state, kid);
    if (!y.offer && !anyOffer(state) && kid.age >= 16 && overall(kid) >= CURVE.normal[Math.min(4, kid.age - 15)] + 4 && rand() < 0.12 / len) poachOffer(state, kid);
  }
}

function growthSpurt(state: GameState, kid: Player) {
  const y = kid.youth!;
  y.spurt = true;
  const cm = randInt(3, 7);
  kid.height = Math.min(200, (kid.height ?? 170) + cm);
  for (const k of ['physical', 'speed', 'stamina', 'jump', 'kickingPower'] as StatKey[]) kid.stats[k] = clamp(kid.stats[k] + randInt(2, 4), 30, 99);
  sendMail(state, {
    from: 'coach',
    sender: COACH,
    subject: `【ユース】${kid.name}に成長期が来ました`,
    body: `${kid.name}の体が一気に大きくなってきました。この数か月で身長が${cm}cmも伸びて、当たりの強さやスピードが見違えるようです。\n\n（身長 ${kid.height}cm / 総合値 ${overall(kid)}）`,
    youthId: kid.id,
  });
}

function startSlump(state: GameState, kid: Player) {
  kid.youth!.slump = { until: state.day + randInt(6, 10) };
  sendMail(state, {
    from: 'coach',
    sender: COACH,
    subject: `【ユース】${kid.name}が伸び悩んでいます`,
    body: `監督、${kid.name}がここのところ壁にぶつかっています。練習でも表情が暗く、思うようにプレーできていないようです。\n\n監督から声をかけてあげますか？それとも、自分で乗り越えるのを見守りますか？`,
    action: 'youthSlump',
    youthId: kid.id,
  });
}

/** 伸び悩みへの対応（声をかける／見守る） */
export function answerSlump(state: GameState, kidId: string, choice: 'talk' | 'watch'): Result {
  const kid = state.youth?.kids[kidId];
  const s = kid?.youth?.slump;
  if (!kid || !s || s.choice) return { ok: false, message: 'この話はもう終わっています' };
  s.choice = choice;
  if (choice === 'talk') {
    const t = kid.youth!.talent;
    const works = rand() < (t === 'genius' || t === 'normal' ? 0.7 : t === 'hard' ? 0.45 : 0.6);
    if (works) {
      s.until = state.day;
      for (let i = 0; i < 4; i++) bump(kid, 1, kid.youth!.focus);
      return { ok: true, message: `${kid.name}「…ありがとうございます。もう一度やってみます！」 表情が明るくなった` };
    }
    s.until += 4;
    return { ok: true, message: `${kid.name}は黙ってうなずいた。かえってプレッシャーになってしまったかもしれない…` };
  }
  return { ok: true, message: `${kid.name}が自分で壁を乗り越えるのを待つことにした` };
}

function endSlump(state: GameState, kid: Player) {
  const s = kid.youth!.slump!;
  kid.youth!.slump = undefined;
  if (s.choice !== 'watch') return;
  const t = kid.youth!.talent;
  if (rand() < (t === 'hard' || t === 'late' || t === 'grand' ? 0.7 : 0.45)) {
    const before = overall(kid);
    for (let i = 0; i < 6; i++) bump(kid, 1, kid.youth!.focus);
    sendMail(state, { from: 'coach', sender: COACH, subject: `【ユース】${kid.name}が壁を乗り越えました`, body: `自分の力で壁を乗り越えた${kid.name}は、ひと回りたくましくなりました。\n\n総合値 ${before} → ${overall(kid)}`, youthId: kid.id });
  }
}

function anyOffer(state: GameState): boolean {
  return youthKids(state).some((k) => k.youth?.offer);
}

function poachOffer(state: GameState, kid: Player) {
  const clubs = state.teams.filter((t) => t.id !== state.userTeamId).sort((a, b) => b.rep - a.rep).slice(0, 10);
  const club = pick(clubs);
  const fee = round2(Math.max(8, 8 + (overall(kid) - 50) * 2.2 + (17 - kid.age) * 2));
  kid.youth!.offer = { club: club.id, fee, expires: state.day + 5 };
  sendMail(state, {
    from: 'club',
    sender: club.name,
    subject: `【引き抜き】${kid.name}を譲ってほしい`,
    body: `${club.name}の育成部門です。貴クラブのユースに在籍する${kid.name}（${kid.age}歳）を、ぜひ私たちのアカデミーに迎えたいと考えています。\n\n補償金として ${fmtMoney(fee)} をお支払いします。良いお返事をお待ちしています。`,
    action: 'youthOffer',
    youthId: kid.id,
    important: true,
  });
}

/** 引き抜きの話に答える */
export function answerYouthOffer(state: GameState, kidId: string, accept: boolean): Result {
  const kid = state.youth?.kids[kidId];
  const o = kid?.youth?.offer;
  if (!kid || !o) return { ok: false, message: 'この話はもう終わっています' };
  const club = state.teams.find((t) => t.id === o.club);
  kid.youth!.offer = undefined;
  if (accept) {
    delete state.youth!.kids[kidId];
    state.money = round2(state.money + o.fee);
    state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `ユースの${kid.name}が${club?.name ?? '他クラブ'}のアカデミーへ（補償金 ${fmtMoney(o.fee)}）` });
    return { ok: true, message: `${kid.name}を送り出した（+${fmtMoney(o.fee)}）` };
  }
  kid.loyalty = 95;
  return { ok: true, message: `${kid.name}「このクラブでプロになります！」` };
}

/* ---------------- 監督の操作 ---------------- */

export function setFocus(state: GameState, kidId: string, focus: YouthFocus) {
  const kid = state.youth?.kids[kidId];
  if (kid?.youth) kid.youth.focus = focus;
}

/** ポジションを変える（ユースのうちは自由に変えられる） */
export function convertKid(state: GameState, kidId: string, pos: Position): Result {
  const kid = state.youth?.kids[kidId];
  if (!kid) return { ok: false, message: '選手が見つかりません' };
  if (kid.position === pos) return { ok: false, message: 'すでにそのポジションです' };
  const old = kid.position;
  kid.position = pos;
  kid.aptitudes = { ...kid.aptitudes, [old]: NEIGHBORS[old]?.includes(pos) ? 2 : 1, [pos]: 3 };
  return { ok: true, message: `${kid.name}を${pos}にコンバートしました` };
}

/** 師匠にできる選手（トップチームの経験豊富な選手） */
export function mentorCandidates(state: GameState): Player[] {
  const taken = new Set(youthKids(state).map((k) => k.youth?.mentor));
  return squadOf(state, state.userTeamId)
    .filter((p) => p.age >= 27 && overall(p) >= 78 && !taken.has(p.id))
    .sort((a, b) => overall(b) - overall(a));
}

export function setMentor(state: GameState, kidId: string, mentorId: string | null): Result {
  const kid = state.youth?.kids[kidId];
  if (!kid?.youth) return { ok: false, message: '選手が見つかりません' };
  if (!mentorId) {
    kid.youth.mentor = undefined;
    return { ok: true, message: '師匠を外しました' };
  }
  const m = state.players[mentorId];
  if (!m || m.teamId !== state.userTeamId) return { ok: false, message: '選手が見つかりません' };
  kid.youth.mentor = mentorId;
  // 師匠の技をひとつ教わることがある
  const skill = m.skills.find((s) => !kid.skills.includes(s));
  if (skill && rand() < 0.3) kid.skills.push(skill);
  return { ok: true, message: `${m.name}が${kid.name}の師匠になりました` };
}

/** 代理人に相談する（1シーズンに1回・有料） */
export function consultAgent(state: GameState, kidId: string): Result & { text?: string } {
  const kid = state.youth?.kids[kidId];
  if (!kid?.youth) return { ok: false, message: '選手が見つかりません' };
  if (kid.youth.consulted === state.season) return { ok: false, message: 'この子については今季もう相談しました' };
  if (state.money < CONSULT_COST) return { ok: false, message: '資金が足りません' };
  state.money = round2(state.money - CONSULT_COST);
  kid.youth.consulted = state.season;
  const text = agentHint(kid, 0.9);
  kid.youth.hints.push({ season: state.season, text, paid: true });
  return { ok: true, message: '代理人から見立てが届きました', text };
}

/** トップチームに昇格させる */
export function promoteKid(state: GameState, kidId: string): Result {
  const kid = state.youth?.kids[kidId];
  if (!kid?.youth) return { ok: false, message: '選手が見つかりません' };
  if (kid.age < 16) return { ok: false, message: '16歳から昇格できます' };
  const squad = squadOf(state, state.userTeamId);
  if (squad.length >= MAX_SQUAD) return { ok: false, message: `トップチームの登録は最大${MAX_SQUAD}人までです` };
  delete state.youth!.kids[kidId];
  const y = kid.youth;
  const ab = academyBoost(state);
  const pot: Record<YouthTalent, [number, number]> = { genius: [92, 99], grand: [93, 99], late: [86, 92], hard: [85, 91], normal: [72, 84] };
  const [lo, hi] = pot[y.talent];
  kid.potential = Math.min(99, Math.max(overall(kid) + 4, randInt(lo, hi) + Math.round(ab * 0.3) + Math.round(mentorBonus(state, kid))));
  kid.growth = y.talent === 'late' || y.talent === 'grand' ? 'late' : y.talent === 'genius' ? pick(['normal', 'early'] as const) : 'normal';
  kid.teamId = state.userTeamId;
  kid.academy = true;
  kid.joinedSeason = state.season;
  kid.contractYears = 3;
  kid.salary = fairSalary(kid);
  kid.loyalty = Math.max(kid.loyalty, 90);
  y.mentor = undefined;
  y.slump = undefined;
  y.offer = undefined;
  const used = new Set(squad.map((p) => p.number));
  kid.number = 30;
  while (used.has(kid.number)) kid.number = kid.number < 99 ? kid.number + 1 : 13;
  state.players[kid.id] = kid;
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'info', text: `ユースの${kid.name}（${kid.age}歳）がトップチームに昇格` });
  return { ok: true, message: `${kid.name}がトップチームに昇格しました（背番号${kid.number}）` };
}

/** ユースから放出する */
export function releaseKid(state: GameState, kidId: string): Result {
  const kid = state.youth?.kids[kidId];
  if (!kid) return { ok: false, message: '選手が見つかりません' };
  delete state.youth!.kids[kidId];
  return { ok: true, message: `${kid.name}をユースから送り出しました` };
}

/* ---------------- 昇格後 ---------------- */

/** トップチームでのデビュー戦（活躍すると覚醒デビュー） */
export function youthDebut(state: GameState, p: Player, rating: number) {
  if (!p.youth || p.youth.debut) return;
  p.youth.debut = true;
  if (rating < 7.5) return;
  const before = overall(p);
  for (let i = 0; i < 8; i++) bump(p, 1, 'auto');
  p.potential = Math.min(99, p.potential + 2);
  sendMail(state, {
    from: 'coach',
    sender: COACH,
    subject: `【覚醒デビュー】${p.name}が衝撃のデビュー！`,
    body: `ユースから上がってきた${p.name}が、デビュー戦でいきなり躍動しました！\nスタジアムは大歓声。本人も自信をつかんだようです。\n\n総合値 ${before} → ${overall(p)}`,
  });
}

/** 昇格後のシーズン終了時の成長（タイプによって伸びる時期が違う）。p.age は新しい年齢 */
export function youthSeasonGrowth(p: Player, apps: number) {
  const t = p.youth?.talent ?? 'normal';
  const before = overall(p);
  if (before >= p.potential) return;
  const late = t === 'late' || t === 'grand';
  const rate = late ? (p.age <= 20 ? 0.15 : p.age <= 23 ? 0.4 : 0.45) : t === 'genius' ? 0.4 : t === 'hard' ? 0.35 : 0.3;
  const minPlay = t === 'hard' ? 0.8 : 0.4;
  const gain = (p.potential - before) * rate * clamp(apps / 20, minPlay, 1.2) + rand();
  const want = Math.min(p.potential, Math.round(before + gain));
  for (let i = 0; i < 300 && overall(p) < want; i++) bump(p, 1, 'auto');
}

/** シーズン終了：年齢を重ね、18歳の決断と新しい子の入団 */
export function youthSeasonEnd(state: GameState): string[] {
  if (!state.youth) return [];
  const auto: string[] = [];
  const decide: Player[] = [];
  for (const kid of youthKids(state)) {
    const y = kid.youth!;
    kid.age++;
    y.hist.push([kid.age, overall(kid)]);
    y.slump = undefined;
    y.offer = undefined;
    y.acc = 0;
    if (kid.age >= 20) {
      const r = promoteKid(state, kid.id);
      if (r.ok) auto.push(kid.name);
      else releaseKid(state, kid.id);
    } else if (kid.age >= 18) decide.push(kid);
  }
  if (decide.length || auto.length) {
    sendMail(state, {
      from: 'coach',
      sender: COACH,
      subject: '【ユース】決断の時です',
      body: [
        decide.length ? `次の子たちが18歳を迎えました。トップチームに昇格させるか、ユースに残すか、送り出すかを決めてあげてください。\n（ユースにいられるのは19歳まで）\n\n${decide.map((k) => `・${k.name}（${k.age}歳・${k.position}・総合値${overall(k)}）`).join('\n')}` : '',
        auto.length ? `20歳になった子はトップチームに昇格させました：${auto.join('、')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
  }
  youthIntake(state, intakeCount(state), { season: state.season + 1 });
  return auto;
}

/** 今季（この年齢になってから）の伸び */
export function lastYearGain(kid: Player): number | null {
  const h = kid.youth?.hist ?? [];
  if (!h.length) return null;
  const last = h[h.length - 1];
  return overall(kid) - last[1];
}
