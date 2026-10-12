import { generatePlayer } from './data';
import { fairSalary, fmtMoney, round2, wageCap, payroll } from './economy';
import type { LiveMatch } from './engine';
import { repairLineup, squadOf } from './lineup';
import { sendMail } from './mail';
import { posGroup } from './positions';
import { clamp, pick, rand, randInt, uid } from './rng';
import { autoSkills, overall, OVR_WEIGHTS, seededRandom, SKILLS, STYLES } from './stats';
import { teamById } from './season';
import { MAX_SQUAD, seekBuyer, type Result } from './transfer';
import { windowStatus } from './competitions';
import type { Fixture, GameState, HallEntry, Player, Position, Team } from './types';
import { POSITIONS } from './types';

/*
 * 隠しシステム
 *  1. 覚醒イベント        2. 師弟関係          3. 因縁・恩返し弾
 *  4. 隠し特性            5. 無名の掘り出し物  6. 黄金世代
 *  7. 監督オファー        8. 選手のわがまま    9. 実績・殿堂
 * 10. 伝説の再来（〇〇2世） … legend.ts と連携
 */

/* ======================= 9. 実績 ======================= */

export interface AchievementDef {
  id: string;
  label: string;
  desc: string;
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstWin', label: '初勝利', desc: '監督として初めての勝利' },
  { id: 'giantKill', label: 'ジャイアントキリング', desc: '格上のクラブに勝利' },
  { id: 'champion', label: 'プレミアリーグ制覇', desc: 'プレミアリーグで優勝' },
  { id: 'clWinner', label: '欧州の頂点', desc: 'チャンピオンズリーグで優勝' },
  { id: 'rivalBeat', label: '因縁に決着', desc: '因縁の相手に勝利' },
  { id: 'spiritMax', label: '一心同体', desc: 'チームスピリットが最大に到達' },
  { id: 'trait', label: '素顔を知る', desc: '選手の隠し特性を発見' },
  { id: 'awaken', label: '覚醒の目撃者', desc: '選手の覚醒を目撃' },
  { id: 'mentor', label: '師弟の絆', desc: '師弟関係が生まれた' },
  { id: 'golden', label: '黄金世代', desc: 'ユースの黄金世代が昇格' },
  { id: 'gem', label: '原石発掘', desc: '無名の掘り出し物を獲得' },
  { id: 'jobChange', label: '新天地へ', desc: '別のクラブの監督に就任' },
  { id: 'hof', label: '殿堂入り', desc: 'クラブの殿堂に名選手が加わった' },
  { id: 'legend', label: '伝説との契約', desc: 'レジェンド選手を獲得' },
  { id: 'seasons5', label: '長期政権', desc: '5シーズン指揮を執った' },
  { id: 'bigWin', label: '大量得点', desc: '5点差以上で勝利', hidden: true },
  { id: 'invincible', label: '無敗優勝', desc: 'リーグ戦無敗で優勝', hidden: true },
  { id: 'double', label: '二冠', desc: 'リーグとCLを同じシーズンに制覇', hidden: true },
  { id: 'gemJackpot', label: '大当たり', desc: '掘り出し物がとんでもない逸材だった', hidden: true },
  { id: 'youth11', label: '生え抜き', desc: 'ユース出身の選手だけでスタメンを組んで勝利', hidden: true },
  { id: 'secondGen', label: '伝説の再来', desc: '〇〇2世を獲得', hidden: true },
  { id: 'revenge', label: '恩返し', desc: '古巣相手に元所属選手がゴール', hidden: true },
];

export function unlock(state: GameState, id: string) {
  state.achievements = state.achievements ?? {};
  if (state.achievements[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  state.achievements[id] = { season: state.season };
  sendMail(state, {
    from: 'board',
    sender: 'クラブ会長',
    subject: `🏆 実績解除「${a.label}」`,
    body: `${a.desc}。\n\nクラブの歴史に新たな1ページが刻まれました。`,
  });
}

/* ======================= 4. 隠し特性 ======================= */

export type TraitId = 'bigGame' | 'derby' | 'glass' | 'clutch' | 'bloomer';

export const TRAITS: Record<TraitId, { label: string; desc: string; found: (n: string) => string }> = {
  bigGame: { label: '大舞台に強い', desc: 'CLや強豪との試合で能力が上がる', found: (n) => `${n}はCLや強豪との大一番になると別人のようです。大舞台に強いタイプですね。` },
  derby: { label: 'ダービー男', desc: 'ダービーや因縁の試合で能力が上がる', found: (n) => `${n}はダービーや因縁の試合になると、いつも以上に燃えるようです。` },
  glass: { label: 'ガラスのメンタル', desc: '大舞台で能力が下がる', found: (n) => `${n}は大きな試合になると硬くなってしまうようです。起用には注意が必要かもしれません。` },
  clutch: { label: '終盤の男', desc: '試合終盤（75分以降）に決定力が上がる', found: (n) => `${n}は試合終盤になると決定力が増すようです。ここ一番で頼りになります。` },
  bloomer: { label: '移籍後に化ける', desc: '加入1年目に能力が上がり、成長しやすい', found: (n) => `${n}は新しい環境で一気に才能を開花させるタイプのようです。` },
};

/** 隠し特性（選手 ID から決まる。約3割の選手が持つ） */
export function hiddenTrait(p: Player): TraitId | null {
  const r = seededRandom(p.id + ':trait');
  if (r() >= 0.3) return null;
  const ids = Object.keys(TRAITS) as TraitId[];
  return ids[Math.floor(r() * ids.length)];
}

/* ======================= 3. 因縁・ダービー ======================= */

const DERBIES: [string, string][] = [
  ['ars', 'tot'], ['che', 'ful'], ['bre', 'ful'], ['che', 'tot'], ['liv', 'eve'], ['mci', 'mun'], ['liv', 'mun'],
  ['new', 'sun'], ['cry', 'bha'], ['lee', 'hul'], ['avl', 'cov'], ['rma', 'atm'], ['gal', 'fen'], ['psv', 'fey'], ['int', 'nap'],
];

export function isDerby(a: string, b: string): boolean {
  return DERBIES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function isRival(state: GameState, oppId: string): boolean {
  return !!state.rivals?.[oppId]?.rival;
}

/** 大一番（CL・強豪・ダービー・因縁） */
export function isBigMatch(state: GameState, f: Fixture, team: Team, opp: Team): boolean {
  return f.comp === 'CL' || opp.rep >= 85 || isDerby(team.id, opp.id) || (team.id === state.userTeamId && isRival(state, opp.id));
}

/** 試合前に、選手ごとの能力補正（隠し特性・恩返し）を計算する */
export function matchBonuses(state: GameState, f: Fixture, team: Team, opp: Team): Record<string, number> {
  const out: Record<string, number> = {};
  const big = isBigMatch(state, f, team, opp);
  const derby = isDerby(team.id, opp.id) || (team.id === state.userTeamId && isRival(state, opp.id));
  for (const p of squadOf(state, team.id)) {
    let k = 1;
    const t = hiddenTrait(p);
    if (t === 'bigGame' && big) k *= 1.06;
    if (t === 'glass' && big) k *= 0.93;
    if (t === 'derby' && derby) k *= 1.07;
    if (t === 'bloomer' && p.joinedSeason === state.season && p.exTeamId) k *= 1.03;
    if (p.exTeamId === opp.id) k *= 1.04; // 古巣相手に燃える
    if (k !== 1) out[p.id] = k;
  }
  return out;
}

/* ======================= 試合後（ユーザーの試合） ======================= */

/** applyMatch から、ユーザーのチームについて呼ばれる */
export function afterUserMatch(state: GameState, f: Fixture, m: LiveMatch, key: 'home' | 'away', bump: (p: Player, n: number) => void) {
  const side = m[key];
  const oppKey = key === 'home' ? 'away' : 'home';
  const team = teamById(state, side.teamId);
  const opp = teamById(state, m[oppKey].teamId);
  const gf = m.score[key];
  const ga = m.score[oppKey];
  const won = gf > ga;
  const big = isBigMatch(state, f, team, opp);
  const goals = m.events.filter((e) => e.type === 'goal' && e.side === key);
  const starters = new Set(startersOf(m, key));

  for (const id of side.usedPlayers) {
    const p = state.players[id];
    if (!p) continue;
    const r = m.ratings[id] ?? 6;
    p.clubApps = (p.clubApps ?? 0) + 1;
    p.clubGoals = (p.clubGoals ?? 0) + goals.filter((g) => g.playerId === id).length;
    p.peakOvr = Math.max(p.peakOvr ?? 0, overall(p));

    // 4. 隠し特性の発見
    const t = hiddenTrait(p);
    if (t && !p.knownTraits?.includes(t)) {
      const late = goals.some((g) => g.playerId === id && g.minute >= 75);
      const hit =
        (t === 'bigGame' && big && r >= 7) ||
        (t === 'glass' && big && r <= 6) ||
        (t === 'derby' && isDerby(team.id, opp.id) && r >= 7) ||
        (t === 'derby' && isRival(state, opp.id) && r >= 7) ||
        (t === 'clutch' && late) ||
        (t === 'bloomer' && p.joinedSeason === state.season && r >= 7);
      if (hit && rand() < 0.5) {
        p.knownTraits = [...(p.knownTraits ?? []), t];
        sendMail(state, { from: 'coach', sender: 'ヘッドコーチ', subject: `【隠し特性】${p.name}「${TRAITS[t].label}」`, body: `${TRAITS[t].found(p.name)}\n\n隠し特性「${TRAITS[t].label}」：${TRAITS[t].desc}`, playerId: p.id });
        unlock(state, 'trait');
      }
    }
    // 移籍後に化けるタイプは加入1年目に伸びやすい
    if (t === 'bloomer' && p.joinedSeason === state.season && overall(p) < p.potential + 3 && rand() < 0.35) bump(p, 1);

    // 1. 覚醒
    checkAwakening(state, f, m, key, p, r, big, won, goals);

    // 恩返し弾
    if (p.exTeamId === opp.id && goals.some((g) => g.playerId === id)) unlock(state, 'revenge');
  }

  // 2. 師弟関係
  mentorTick(state, starters, bump);

  // 8. 約束の消化
  for (const p of squadOf(state, team.id)) {
    if (!p.promise) continue;
    p.promise.left--;
    if (starters.has(p.id)) p.promise.got++;
    if (p.promise.got >= p.promise.need) {
      delete p.promise;
      p.loyalty = clamp(p.loyalty + 5, 0, 100);
      sendMail(state, { from: 'agent', sender: `${p.name}の代理人`, subject: `${p.name}は満足しています`, body: `約束どおり出場機会を与えていただき、${p.name}は大変満足しています。これからもクラブのために全力を尽くすそうです。`, playerId: p.id });
    } else if (p.promise.left <= 0) {
      delete p.promise;
      p.loyalty = clamp(p.loyalty - 20, 0, 100);
      p.condition = 1;
      team.spirit = Math.max(30, team.spirit - 3);
      sendMail(state, { from: 'agent', sender: `${p.name}の代理人`, subject: `【不満】${p.name}「約束が違う」`, body: `出場機会を約束していただいたはずですが、守られませんでした。\n${p.name}は大変失望しており、調子も落ちています。チームの雰囲気にも影響が出ているようです。`, playerId: p.id, important: true });
    }
  }

  // 3. 因縁の相手
  state.rivals = state.rivals ?? {};
  const rv = (state.rivals[opp.id] = state.rivals[opp.id] ?? { streak: 0, rival: false });
  if (ga > gf) {
    rv.streak++;
    if (rv.streak >= 3 && !rv.rival) {
      rv.rival = true;
      sendMail(state, { from: 'board', sender: 'クラブ会長', subject: `【因縁】${opp.name}は因縁の相手だ`, body: `${opp.name}に${rv.streak}連敗…。サポーターの怒りも限界です。\n\n今後${opp.name}は「因縁の相手」です。次に勝てば、賞金ボーナスとチームスピリットの上昇が期待できます。`, important: true });
    }
  } else if (won) {
    if (rv.rival) {
      const bonus = 6;
      state.money = round2(state.money + bonus);
      team.spirit = Math.min(99, team.spirit + 2);
      rv.rival = false;
      sendMail(state, { from: 'board', sender: 'クラブ会長', subject: `【因縁に決着】${opp.name}を撃破！`, body: `ついに${opp.name}を倒しました！スタジアムは歓喜に包まれています。\n\nボーナス ${fmtMoney(bonus)} を移籍資金に加えました。チームスピリットも上がっています。` });
      unlock(state, 'rivalBeat');
    }
    rv.streak = 0;
  }

  // 9. 実績
  if (won) {
    unlock(state, 'firstWin');
    if (gf - ga >= 5) unlock(state, 'bigWin');
    if (opp.rep >= team.rep + 15) unlock(state, 'giantKill');
    const xi = startersOf(m, key).map((id) => state.players[id]);
    if (xi.length === 11 && xi.every((p) => p?.academy)) unlock(state, 'youth11');
  }
  if (team.spirit >= 98.5) unlock(state, 'spiritMax');
}

function startersOf(m: LiveMatch, key: 'home' | 'away'): string[] {
  const side = m[key];
  return side.usedPlayers.filter((id) => (side.enteredAt[id] ?? 0) === 0);
}

/* ======================= 1. 覚醒 ======================= */

/** 覚醒の素質（選手 ID から決まる。若手の約1割） */
function awakenable(p: Player): boolean {
  return seededRandom(p.id + ':awaken')() < 0.15;
}

function checkAwakening(state: GameState, f: Fixture, m: LiveMatch, key: 'home' | 'away', p: Player, r: number, big: boolean, won: boolean, goals: LiveMatch['events']) {
  if (p.awakened || p.legend || p.age > 24) return;
  const cand = awakenable(p);
  // 予兆
  if (cand && !p.awakenHint && r >= 7.3) {
    p.awakenHint = true;
    sendMail(state, { from: 'coach', sender: 'ヘッドコーチ', subject: `【予兆】${p.name}、何か起きそうです`, body: `最近の${p.name}は、練習でも目の色が違います。\n大舞台で結果を出せば、何かが弾けるかもしれません…。\n\n（ヒント：CLや強豪との試合で起用してみてください）`, playerId: p.id });
  }
  const myGoals = goals.filter((g) => g.playerId === p.id);
  const entered = m[key].enteredAt[p.id] ?? 0;
  const lastGoal = goals[goals.length - 1];
  const oppGoals = m.score[key === 'home' ? 'away' : 'home'];
  const winner = won && entered > 0 && lastGoal?.playerId === p.id && m.score[key] - oppGoals === 1 && lastGoal.minute >= entered;
  const trigger = (big && (myGoals.length >= 2 || r >= 8)) || (f.comp === 'CL' && r >= 7.8) || winner || (!!p.awakenHint && (myGoals.length >= 2 || r >= 8.3));
  if (!trigger) return;
  if (rand() >= (cand ? (p.awakenHint ? 0.75 : 0.5) : 0.03)) return;
  awaken(state, p, winner ? '途中出場からの決勝ゴール' : myGoals.length >= 2 ? (big ? '大一番での2ゴール' : '2ゴールの大活躍') : f.comp === 'CL' ? 'CLでの圧巻のパフォーマンス' : '圧巻のパフォーマンス');
}

export function awaken(state: GameState, p: Player, why: string) {
  const before = overall(p);
  p.awakened = true;
  p.potential = Math.min(109, p.potential + randInt(4, 8));
  const n = randInt(32, 44);
  for (let i = 0; i < n; i++) awakenBump(p);
  const newSkill = autoSkills(p.stats, p.position, p.style).find((s) => !p.skills.includes(s)) ?? pick(SKILLS.filter((s) => !p.skills.includes(s.id) && (p.position === 'GK') === (s.cat === 'gk')))?.id;
  if (newSkill && p.skills.length < 12) p.skills.push(newSkill);
  let styleText = '';
  if (rand() < 0.5) {
    const opts = Object.entries(STYLES).filter(([k, s]) => k !== p.style && s.pos.includes(p.position));
    if (opts.length) {
      const [k, s] = pick(opts);
      styleText = `\nプレースタイル：${STYLES[p.style]?.label ?? '—'} → ${s.label}`;
      p.style = k;
    }
  }
  const after = overall(p);
  const skillLabel = SKILLS.find((s) => s.id === newSkill)?.label;
  sendMail(state, {
    from: 'coach',
    sender: 'ヘッドコーチ',
    subject: `⚡【覚醒】${p.name}が覚醒しました！`,
    body: `${why}をきっかけに、${p.name}が覚醒しました！\n\n総合値 ${before} → ${after}${skillLabel ? `\n新スキル「${skillLabel}」を習得` : ''}${styleText}\n\nもう以前の彼ではありません。`,
    playerId: p.id,
    important: true,
  });
  unlock(state, 'awaken');
}

function awakenBump(p: Player) {
  // ポジションに関係する能力を中心に伸ばす
  const main = Object.keys(OVR_WEIGHTS[p.position]) as (keyof Player['stats'])[];
  const all = (Object.keys(p.stats) as (keyof Player['stats'])[]).filter((x) => !x.startsWith('gk') || p.position === 'GK');
  const k = pick(rand() < 0.85 ? main : all);
  p.stats[k] = clamp(p.stats[k] + randInt(1, 2), 35, 99);
}

/* ======================= 2. 師弟関係 ======================= */

function mentorTick(state: GameState, starters: Set<string>, bump: (p: Player, n: number) => void) {
  const xi = [...starters].map((id) => state.players[id]).filter(Boolean);
  const vets = xi.filter((p) => p.age >= 30);
  const youngs = xi.filter((p) => p.age <= 21);
  state.mentorProgress = state.mentorProgress ?? {};
  for (const y of youngs) {
    // 既に師匠がいれば一緒に出た時に成長ボーナス・スキル継承
    if (y.mentorId) {
      const mentor = state.players[y.mentorId];
      if (mentor && starters.has(mentor.id)) {
        if (overall(y) < y.potential && rand() < 0.5) bump(y, randInt(1, 2));
        if (rand() < 0.06) {
          const sk = mentor.skills.find((s) => !y.skills.includes(s) && (SKILLS.find((x) => x.id === s)?.cat === 'gk') === (y.position === 'GK'));
          if (sk && y.skills.length < 12) {
            y.skills.push(sk);
            const label = SKILLS.find((x) => x.id === sk)?.label ?? sk;
            sendMail(state, { from: 'coach', sender: 'ヘッドコーチ', subject: `【継承】${y.name}が師匠の技を受け継ぎました`, body: `${mentor.name}から${y.name}へ、スキル「${label}」が受け継がれました。\n二人の絆は確かなものになっています。`, playerId: y.id });
          }
        }
      }
      continue;
    }
    for (const v of vets) {
      if (posGroup(v.position) !== posGroup(y.position) && v.nationality !== y.nationality) continue;
      const k = `${v.id}|${y.id}`;
      state.mentorProgress[k] = (state.mentorProgress[k] ?? 0) + 1;
      if (state.mentorProgress[k] >= 6 && rand() < 0.35) {
        y.mentorId = v.id;
        delete state.mentorProgress[k];
        sendMail(state, {
          from: 'coach',
          sender: 'ヘッドコーチ',
          subject: `【師弟】${v.name}と${y.name}に師弟関係が生まれました`,
          body: `一緒にピッチに立ち続けた${v.name}と${y.name}。いつの間にか、${y.name}は${v.name}を師と仰ぐようになりました。\n\n二人を同時に起用すると、${y.name}の成長が早まり、師匠の技を受け継ぐこともあります。`,
          players: [v.id, y.id],
        });
        unlock(state, 'mentor');
        break;
      }
    }
  }
}

/** ベテランの引退時：弟子に背番号を託す */
function inheritNumber(state: GameState, vet: Player) {
  const pupil = Object.values(state.players).find((p) => p.mentorId === vet.id && p.teamId === state.userTeamId);
  if (!pupil) return;
  const prev = pupil.number;
  pupil.number = vet.number;
  pupil.loyalty = clamp(pupil.loyalty + 15, 0, 100);
  delete pupil.mentorId;
  sendMail(state, {
    from: 'board',
    sender: vet.name,
    subject: `【継承】背番号${vet.number}を${pupil.name}へ`,
    body: `監督、長い間ありがとうございました。\n\n最後にひとつだけお願いがあります。私の背番号${vet.number}を、${pupil.name}に託したい。あいつなら、この番号にふさわしい選手になるはずです。\n\n（${pupil.name}の背番号が ${prev} → ${vet.number} になりました）`,
    playerId: pupil.id,
    important: true,
  });
}

/* ======================= 5. 無名の掘り出し物 ======================= */

const GEM_NATIONS = ['ウクライナ', 'セルビア', 'クロアチア', 'ポーランド', 'チェコ', 'ナイジェリア', 'ガーナ', 'コロンビア', 'エクアドル', 'パラグアイ', 'ジョージア', 'スロベニア', '日本', '韓国', 'マリ'];
const GEM_CLUBS = ['ヴォルスクラ', 'ズヴェズダ', 'ロコモティフ', 'オリンピア', 'スパルタク', 'ディナモ', 'ユニオン', 'アトレティコ', 'スポルティング', 'レヴァディア'];
export const GEM_RATE = 0.012;

export function spawnGem(state: GameState): Player {
  const roll = rand();
  const tier = roll < 0.25 ? 'jackpot' : roll < 0.75 ? 'normal' : 'bust';
  const pos = pick(POSITIONS.filter((x) => x !== 'GK'));
  const level = tier === 'jackpot' ? randInt(66, 72) : tier === 'normal' ? randInt(60, 66) : randInt(55, 60);
  const p = generatePlayer({ position: pos, level, age: randInt(18, 22), teamId: null });
  const nat = pick(GEM_NATIONS);
  p.nationality = nat;
  p.potential = tier === 'jackpot' ? randInt(86, 93) : tier === 'normal' ? randInt(74, 80) : randInt(60, 66);
  p.growth = tier === 'jackpot' ? 'late' : 'normal';
  const origin = `${nat}${randInt(2, 3)}部 ${pick(['FC', 'SK', 'NK', 'FK', 'CD', 'AC'])}${pick(GEM_CLUBS)}`;
  p.gem = { origin, tier };
  state.players[p.id] = p;
  const ovr = overall(p);
  // スカウトの見立ては幅が広く、当たりか外れかは見抜けない
  const estLow = clamp(ovr - randInt(4, 10), 45, 99);
  const estHigh = clamp(ovr + randInt(4, 12), 50, 99);
  const fee = round2(1 + rand() * 5);
  const salary = round2(Math.max(0.3, fairSalary(p)));
  state.gemOffer = { playerId: p.id, fee, salary, estLow, estHigh, expires: state.day + 5 };
  const comment = pick([
    'ボールの持ち方に光るものがあります。', '判断の速さは、このリーグでは異質です。', 'フィジカルはまだ細いですが、技術は確かです。',
    '試合によって出来がまちまちなのが気になりますが…。', '地元では「怪物」と呼ばれているそうです。', '正直、化けるかどうかは五分五分です。',
  ]);
  sendMail(state, {
    from: 'scout',
    sender: 'チーフスカウト',
    subject: `【掘り出し物？】${origin}に面白い選手が`,
    body: `監督、${origin}に面白い選手がいます。\n\n${p.name}（${p.age}歳・${p.position}）\n${comment}\n\n推定総合値：${estLow}〜${estHigh}\n伸びしろ：？？？\n移籍金：${fmtMoney(fee)}\n\n本当の才能は獲ってみないと分かりません。当たりか外れか…賭けてみますか？（回答期限 5日）`,
    action: 'gem',
    playerId: p.id,
    important: true,
  });
  return p;
}

export function signGem(state: GameState): Result {
  const o = state.gemOffer;
  if (!o) return { ok: false, message: 'この話はもう終わっています' };
  const p = state.players[o.playerId];
  if (!p) return { ok: false, message: 'この話はもう終わっています' };
  if (state.money < o.fee) return { ok: false, message: '移籍資金が足りません' };
  if (squadOf(state, state.userTeamId).length >= MAX_SQUAD) return { ok: false, message: `登録は最大${MAX_SQUAD}人までです` };
  delete state.gemOffer;
  state.money = round2(state.money - o.fee);
  p.teamId = state.userTeamId;
  p.salary = o.salary;
  p.contractYears = 4;
  p.joinedSeason = state.season;
  p.loyalty = 70;
  const used = new Set(squadOf(state, state.userTeamId).filter((x) => x.id !== p.id).map((x) => x.number));
  while (used.has(p.number)) p.number = randInt(13, 49);
  p.gem!.revealed = true;
  const tier = p.gem!.tier;
  const text =
    tier === 'jackpot'
      ? `とんでもない逸材でした！\n伸びしろは底が見えません。数年後にはワールドクラスになっているかもしれません。`
      : tier === 'normal'
        ? `堅実な選手でした。主力になれるかは今後の育成次第です。`
        : `…正直、期待外れでした。伸びしろはあまりなさそうです。まあ、こういうこともあります。`;
  sendMail(state, {
    from: 'scout',
    sender: 'チーフスカウト',
    subject: `【正体判明】${p.name}の本当の実力`,
    body: `${p.name}が加入し、練習で本当の実力が分かりました。\n\n総合値 ${overall(p)} / 伸びしろ ${p.potential}\n\n${text}`,
    playerId: p.id,
    important: tier === 'jackpot',
  });
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'transfer', text: `【獲得】${p.gem!.origin}から${p.name}を ${fmtMoney(o.fee)} で獲得` });
  unlock(state, 'gem');
  if (tier === 'jackpot') unlock(state, 'gemJackpot');
  repairLineup(state, teamById(state, state.userTeamId));
  return { ok: true, message: `${p.name}を獲得しました` };
}

export function passGem(state: GameState) {
  const o = state.gemOffer;
  if (!o) return;
  delete state.players[o.playerId];
  delete state.gemOffer;
}

/* ======================= 8. 選手のわがまま ======================= */

export function spawnDemand(state: GameState): boolean {
  const team = teamById(state, state.userTeamId);
  const squad = squadOf(state, team.id).filter((p) => !p.promise && !p.legend);
  const played = Math.max(1, Math.max(...squad.map((p) => p.season.apps + p.season.clApps)));
  const median = [...squad].map(overall).sort((a, b) => b - a)[Math.floor(squad.length / 2)] ?? 70;
  const playtime = squad.filter((p) => p.age >= 20 && overall(p) >= median && played >= 6 && (p.season.apps + p.season.clApps) / played < 0.4);
  const raise = squad.filter((p) => p.salary < fairSalary(p) * 0.75 && (overall(p) >= 80 || (p.season.apps >= 8 && (p.ratingSum ?? 0) / p.season.apps >= 7)));
  const kind = playtime.length && (!raise.length || rand() < 0.5) ? 'playtime' : raise.length ? 'raise' : null;
  if (!kind) return false;
  const p = pick(kind === 'playtime' ? playtime : raise);
  state.demand = { playerId: p.id, kind, expires: state.day + 5 };
  sendMail(state, {
    from: 'agent',
    sender: `${p.name}の代理人`,
    subject: kind === 'playtime' ? `【直談判】${p.name}「もっと試合に出たい」` : `【直談判】${p.name}「年俸を上げてほしい」`,
    body:
      kind === 'playtime'
        ? `${p.name}の代理人です。\n\n本人は今の出場時間に強い不満を持っています。このままなら移籍も考えたいと話しています。\n\nどう対応されますか？（回答期限 5日）`
        : `${p.name}の代理人です。\n\nこれだけの活躍をしているのに、今の年俸（${fmtMoney(p.salary)}）は見合っていないと本人は感じています。${fmtMoney(raiseAmount(p))}への増額を希望しています。\n\nどう対応されますか？（回答期限 5日）`,
    action: 'demand',
    playerId: p.id,
    important: true,
  });
  return true;
}

export function raiseAmount(p: Player): number {
  return round2(fairSalary(p) * 1.05);
}

export function persuadeChance(state: GameState, p: Player): number {
  const team = teamById(state, state.userTeamId);
  return clamp(0.35 + (p.loyalty - 50) / 150 + (team.rep - 75) / 200, 0.1, 0.8);
}

export function answerDemand(state: GameState, choice: 'persuade' | 'accept' | 'release'): Result {
  const d = state.demand;
  if (!d) return { ok: false, message: 'この件はもう終わっています' };
  const p = state.players[d.playerId];
  const team = teamById(state, state.userTeamId);
  if (!p || p.teamId !== team.id) {
    delete state.demand;
    return { ok: false, message: 'この件はもう終わっています' };
  }
  if (choice === 'persuade') {
    delete state.demand;
    if (rand() < persuadeChance(state, p)) {
      p.loyalty = clamp(p.loyalty + 10, 0, 100);
      return { ok: true, message: `${p.name}「…わかりました。監督を信じます」` };
    }
    p.loyalty = clamp(p.loyalty - 10, 0, 100);
    p.condition = Math.max(1, p.condition - 1) as Player['condition'];
    team.spirit = Math.max(30, team.spirit - 2);
    return { ok: true, message: `${p.name}「話になりません」説得は失敗…調子とチームの雰囲気が下がった` };
  }
  if (choice === 'accept') {
    if (d.kind === 'raise') {
      const amt = raiseAmount(p);
      if (payroll(squadOf(state, team.id)) - p.salary + amt > wageCap(team)) return { ok: false, message: `年俸総額の上限（${fmtMoney(wageCap(team))}）を超えてしまいます` };
      p.salary = amt;
      p.contractYears = Math.max(p.contractYears, 3);
    } else {
      p.promise = { left: 6, need: 3, got: 0 };
    }
    delete state.demand;
    p.loyalty = clamp(p.loyalty + 10, 0, 100);
    p.condition = Math.min(5, p.condition + 1) as Player['condition'];
    return { ok: true, message: d.kind === 'raise' ? `${p.name}の年俸を ${fmtMoney(p.salary)} に上げました` : `${p.name}に出場機会を約束しました（次の6試合で3試合以上先発）` };
  }
  delete state.demand;
  if (windowStatus(state).open) {
    const r = seekBuyer(state, p.id);
    if (r.ok) return { ok: true, message: r.message ?? '' };
  }
  p.listed = true;
  return { ok: true, message: `${p.name}を移籍リストに載せました。移籍市場が開いたら買い手を探します` };
}

/* ======================= 7. 監督オファー ======================= */

export function jobOfferAtSeasonEnd(state: GameState, rank: number, expectedRank: number, clLabel: string) {
  const user = teamById(state, state.userTeamId);
  const good = rank <= 4 || ['優勝', '決勝', '準決勝'].includes(clLabel) || expectedRank - rank >= 5;
  if (!good || rand() >= 0.6) return;
  const cands = state.teams.filter((t) => t.league === 'PL' && t.id !== user.id && t.rep > user.rep).sort((a, b) => b.rep - a.rep);
  if (!cands.length) return;
  const picks = cands.slice(0, 5).sort(() => rand() - 0.5).slice(0, Math.min(2, cands.length));
  state.jobOffer = { teamIds: picks.map((t) => t.id), expires: 3 };
  sendMail(state, {
    from: 'club',
    sender: picks.map((t) => t.name).join('・'),
    subject: `【監督オファー】${picks.map((t) => t.name).join('、')}から就任要請`,
    body: `今シーズンの手腕は各クラブの注目を集めています。\n\n${picks.map((t) => `・${t.name}（移籍資金 ${fmtMoney(t.budget)}）`).join('\n')}\n\nから、来季の監督就任の打診が届きました。新天地で挑戦しますか？（新シーズン第3節まで有効）`,
    action: 'job',
    important: true,
  });
}

export function acceptJob(state: GameState, teamId: string): Result {
  const o = state.jobOffer;
  if (!o || !o.teamIds.includes(teamId)) return { ok: false, message: 'このオファーはもう有効ではありません' };
  const old = teamById(state, state.userTeamId);
  const next = teamById(state, teamId);
  const oldMoney = state.money;
  state.money = round2(next.budget);
  old.budget = round2(oldMoney);
  state.userTeamId = next.id;
  state.offers = [];
  state.negotiations = {};
  delete state.demand;
  delete state.jobOffer;
  for (const p of Object.values(state.players)) {
    delete p.promise;
    delete p.listed;
  }
  repairLineup(state, next);
  state.news.unshift({ id: uid('n'), season: state.season, day: state.day, kind: 'info', text: `【就任】${old.name}を離れ、${next.name}の監督に就任` });
  sendMail(state, { from: 'board', sender: `${next.name} 会長`, subject: `ようこそ${next.name}へ`, body: `${state.managerName}監督、${next.name}へようこそ。\n\n移籍資金は ${fmtMoney(state.money)} です。あなたの手腕に期待しています。` });
  unlock(state, 'jobChange');
  return { ok: true, message: `${next.name}の監督に就任しました` };
}

/* ======================= 6. 黄金世代・ユース ======================= */

export function goldenPremonition(state: GameState) {
  state.flags = state.flags ?? {};
  const key = `golden-${state.season}`;
  if (state.flags[`golden-checked-${state.season}`]) return;
  state.flags[`golden-checked-${state.season}`] = true;
  if (rand() >= 0.15) return;
  state.flags[key] = true;
  sendMail(state, { from: 'coach', sender: 'ユース監督', subject: '【ユース】今年の世代は何かが違います', body: `監督、ユースの練習を一度見に来てください。\n\n今年の世代は、何かが違います。何人もの選手が、トップチームでもすぐに通用しそうな輝きを見せています。\n\nシーズン終了後、彼らをまとめて昇格させましょう。` });
}

/** シーズン終了時のユース昇格（毎年1人＋黄金世代なら有望株が4人） */
export function promoteAcademy(state: GameState): string[] {
  const team = teamById(state, state.userTeamId);
  const golden = !!state.flags?.[`golden-${state.season}`];
  const n = golden ? 4 : 1;
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    if (squadOf(state, team.id).length >= MAX_SQUAD) break;
    const pos: Position = pick(POSITIONS);
    const p = generatePlayer({ position: pos, level: golden ? randInt(60, 66) : randInt(50, 58), age: 17, teamId: team.id, custom: team.original });
    p.academy = true;
    p.joinedSeason = state.season + 1;
    p.contractYears = 3;
    p.potential = golden ? randInt(84, 94) : Math.max(p.potential, randInt(65, 82));
    p.growth = golden ? pick(['normal', 'late'] as const) : p.growth;
    p.salary = fairSalary(p);
    p.loyalty = 90;
    const used = new Set(squadOf(state, team.id).map((x) => x.number));
    while (used.has(p.number)) p.number = randInt(13, 49);
    state.players[p.id] = p;
    names.push(p.name);
  }
  if (golden && names.length) {
    sendMail(state, { from: 'coach', sender: 'ユース監督', subject: `【黄金世代】${names.length}人がトップチームへ`, body: `約束どおり、黄金世代がトップチームに昇格しました。\n\n${names.map((x) => '・' + x).join('\n')}\n\n彼らがクラブの未来を背負っていくはずです。` });
    unlock(state, 'golden');
  }
  return names;
}

/* ======================= 9. 殿堂 ======================= */

/** 引退する自クラブの選手を殿堂入りさせる（条件を満たせば） */
export function onRetire(state: GameState, p: Player) {
  inheritNumber(state, p);
  if (p.teamId !== state.userTeamId) return;
  const apps = p.clubApps ?? 0;
  const peak = Math.max(p.peakOvr ?? 0, overall(p));
  const ok = apps >= 60 || (p.legend && apps >= 10) || (p.awakened && apps >= 30) || (peak >= 88 && apps >= 20);
  if (!ok) return;
  const note = p.legend ? (p.legend.heir ? '伝説の再来' : 'レジェンド') : p.awakened ? '覚醒した才能' : p.academy ? 'ユース出身' : apps >= 150 ? 'クラブの象徴' : '名選手';
  const e: HallEntry = { name: p.name, position: p.position, nationality: p.nationality, apps, goals: p.clubGoals ?? 0, peak, season: state.season, note };
  state.hallOfFame = [...(state.hallOfFame ?? []), e];
  sendMail(state, { from: 'board', sender: 'クラブ会長', subject: `【殿堂入り】${p.name}`, body: `${p.name}が現役を引退し、クラブの殿堂入りを果たしました。\n\n出場 ${apps}試合 / ${e.goals}得点 / 最高総合値 ${peak}\n\nその名は永遠にクラブの歴史に刻まれます。` });
  unlock(state, 'hof');
}

/* ======================= 10. 伝説の再来 ======================= */

/** シーズン終了時：大活躍したレジェンドがいれば、数年後に「2世」の予定を立てる */
export function planHeirs(state: GameState, rank: number) {
  state.heirs = state.heirs ?? [];
  for (const p of squadOf(state, state.userTeamId)) {
    if (!p.legend?.seedId || p.legend.heir) continue;
    const apps = p.season.apps;
    const avg = apps ? (p.ratingSum ?? 0) / apps : 0;
    const great = p.season.goals >= 15 || (apps >= 20 && avg >= 7.2) || (rank === 1 && apps >= 15);
    if (!great || state.heirs.some((h) => h.seedId === p.legend!.seedId)) continue;
    state.heirs.push({ seedId: p.legend.seedId, season: state.season + randInt(2, 4) });
  }
}

/* ======================= 日ごとの処理 ======================= */

/** 試合日ごと：掘り出し物・わがまま・期限切れの処理 */
export function dailyEvents(state: GameState, day: { type: string; round: number }) {
  // 掘り出し物
  const g = state.gemOffer;
  if (g && state.day >= g.expires) {
    const p = state.players[g.playerId];
    if (p && !p.teamId) {
      sendMail(state, { from: 'scout', sender: 'チーフスカウト', subject: `${p.name}は他のクラブへ`, body: `${p.name}は別のクラブと契約したようです。\nあの選手が本物だったのかどうか…今となっては分かりません。` });
      delete state.players[p.id];
    }
    delete state.gemOffer;
  } else if (!g && rand() < GEM_RATE) spawnGem(state);

  // わがまま
  const d = state.demand;
  if (d && state.day >= d.expires) {
    const p = state.players[d.playerId];
    delete state.demand;
    if (p && p.teamId === state.userTeamId) {
      p.loyalty = clamp(p.loyalty - 15, 0, 100);
      p.condition = Math.max(1, p.condition - 1) as Player['condition'];
      sendMail(state, { from: 'agent', sender: `${p.name}の代理人`, subject: `${p.name}は無視されたと感じています`, body: `回答をいただけなかったため、${p.name}はクラブへの信頼を失いつつあります。調子にも影響が出ています。`, playerId: p.id });
    }
  } else if (!d && day.type === 'PL' && day.round >= 4 && rand() < 0.05) spawnDemand(state);

  // 監督オファーの期限
  const j = state.jobOffer;
  if (j && state.day >= j.expires) {
    delete state.jobOffer;
    sendMail(state, { from: 'board', sender: 'クラブ会長', subject: '監督オファーの期限が過ぎました', body: '他クラブからの就任要請は期限切れとなりました。今のクラブで、引き続きよろしくお願いします。' });
  }

  // 黄金世代の予兆（第25節あたり）
  if (day.type === 'PL' && day.round === 24) goldenPremonition(state);
}

/** 移籍市場が開いている時、移籍リストに載せた選手に買い手を探す */
export function listedPlayersTick(state: GameState) {
  if (!windowStatus(state).open) return;
  for (const p of squadOf(state, state.userTeamId)) {
    if (!p.listed || state.offers.some((o) => o.playerId === p.id)) continue;
    const r = seekBuyer(state, p.id);
    if (r.ok) {
      delete p.listed;
      sendMail(state, { from: 'advisor', sender: '強化部長', subject: `${p.name}に買い手が見つかりました`, body: r.message ?? '', playerId: p.id, offerId: state.offers[state.offers.length - 1]?.id });
    }
  }
}

/** シーズン終了時のまとめ（endSeason から呼ばれる） */
export function seasonEndAchievements(state: GameState, rank: number, losses: number, clLabel: string) {
  if (rank === 1) unlock(state, 'champion');
  if (rank === 1 && losses === 0) unlock(state, 'invincible');
  if (clLabel === '優勝') unlock(state, 'clWinner');
  if (rank === 1 && clLabel === '優勝') unlock(state, 'double');
  state.flags = state.flags ?? {};
  state.flags[`managed-${state.season}`] = true;
  if (Object.keys(state.flags).filter((k) => k.startsWith('managed-')).length >= 5) unlock(state, 'seasons5');
}

export function heirsDue(state: GameState): string | null {
  const h = state.heirs?.find((x) => !x.done && x.season <= state.season);
  if (!h) return null;
  h.done = true;
  return rand() < 0.5 ? h.seedId : null;
}

