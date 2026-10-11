import { windowStatus } from './competitions';
import { fmtMoney, marketValue } from './economy';
import { squadOf, teamRoles } from './lineup';
import { pick, rand, uid } from './rng';
import { overall, ratingAt, SKILLS, SKILL_LABEL } from './stats';
import type { GameState, Mail, MailFrom, Player, Position } from './types';

export const FROM_LABEL: Record<MailFrom, string> = {
  club: 'クラブ',
  agent: '代理人',
  advisor: 'アドバイザー',
  medical: 'メディカルスタッフ',
  league: 'リーグ事務局',
  coach: 'コーチ',
  scout: 'スカウト',
  board: 'クラブ首脳陣',
};

export function sendMail(state: GameState, m: Omit<Mail, 'id' | 'season' | 'day' | 'read'>) {
  state.mails = state.mails ?? [];
  state.mails.unshift({ ...m, id: uid('m'), season: state.season, day: state.day, read: false });
  if (state.mails.length > 200) state.mails.length = 200;
}

export function unreadCount(state: GameState): number {
  return (state.mails ?? []).filter((m) => !m.read).length;
}

const shortName = (p: Player) => p.name;

/* ---------------- 各種メール ---------------- */

export function mailInjury(state: GameState, p: Player) {
  sendMail(state, {
    from: 'medical',
    sender: 'チームドクター',
    subject: `【負傷】${shortName(p)}の診断結果`,
    body: `${p.name}は試合中に負傷しました。\n全治 約${p.injury}試合の見込みです。\n\n回復するまでは試合に出場できません。スタメンとベンチを見直してください。`,
    playerId: p.id,
    important: true,
  });
}

export function mailRedCard(state: GameState, p: Player) {
  sendMail(state, {
    from: 'coach',
    sender: 'アシスタントコーチ',
    subject: `【出場停止】${shortName(p)}は次の試合に出られません`,
    body: `${p.name}は退場処分を受けたため、次の試合は出場停止です。\n代わりの選手を準備しておきましょう。`,
    playerId: p.id,
  });
}

/** 戦術アドバイス：適性外のポジションやスピリットの低下を指摘 */
export function mailTacticAdvice(state: GameState) {
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  const roles = teamRoles(team);
  const off: string[] = [];
  team.lineup.forEach((id, i) => {
    const p = state.players[id];
    if (!p) return;
    const lv = p.position === roles[i] ? 3 : p.aptitudes[roles[i]] ?? 0;
    if (lv === 0) off.push(`・${p.name}（本職 ${p.position} → ${roles[i]} で起用、総合 ${overall(p)} → ${ratingAt(p, roles[i])}）`);
  });
  if (off.length) {
    sendMail(state, {
      from: 'advisor',
      sender: 'テクニカルアドバイザー',
      subject: '戦術アドバイス：適性外のポジションで起用されている選手がいます',
      body: `次の選手は適性のないポジションで起用されています。能力を発揮しきれず、チームスピリットも上がりにくくなります。\n\n${off.join('\n')}\n\n選手をタップすると、ピッチ上に適性ポジションが表示されます。`,
    });
  } else if (team.spirit < 70) {
    sendMail(state, {
      from: 'advisor',
      sender: 'テクニカルアドバイザー',
      subject: `戦術アドバイス：チームスピリットが ${team.spirit} に下がっています`,
      body: '頻繁にメンバーを入れ替えると、連携がとれずスピリットが下がります。\n適性ポジションで同じメンバーを使い続けると、1節ほどで最大近くまで回復します。',
    });
  }
}

/** 補強アドバイス：一番弱いポジションの候補を紹介 */
export function mailScoutAdvice(state: GameState) {
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  const roles = teamRoles(team);
  let weakest: { pos: Position; v: number } | null = null;
  team.lineup.forEach((id, i) => {
    const p = state.players[id];
    if (!p || roles[i] === 'GK') return;
    const v = ratingAt(p, roles[i]);
    if (!weakest || v < weakest.v) weakest = { pos: roles[i], v };
  });
  if (!weakest) return;
  const w = weakest as { pos: Position; v: number };
  const cands = Object.values(state.players)
    .filter((p) => p.teamId !== state.userTeamId && p.position === w.pos && overall(p) > w.v + 2 && marketValue(p) <= state.money * 0.9)
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 6)
    .sort(() => rand() - 0.5)
    .slice(0, 3);
  if (!cands.length) return;
  sendMail(state, {
    from: 'scout',
    sender: 'チーフスカウト',
    subject: `補強の提案：${w.pos} の強化を`,
    body: `現在の ${w.pos} は総合 ${w.v} と、チームの弱点になっています。資金内で獲得を狙えそうな選手をリストアップしました。\n\n${cands
      .map((p) => `・${p.name}（${p.age}歳 総合${overall(p)} 市場価値 ${fmtMoney(marketValue(p))}）`)
      .join('\n')}\n\n気になる選手はマイリストに登録しておきましょう。`,
    players: cands.map((p) => p.id),
  });
}

/** 契約アドバイス：契約が残り 1 年の主力 */
export function mailContractAdvice(state: GameState) {
  const squad = squadOf(state, state.userTeamId).sort((a, b) => overall(b) - overall(a));
  const exp = squad.slice(0, 18).filter((p) => p.contractYears <= 1);
  if (!exp.length) return;
  sendMail(state, {
    from: 'advisor',
    sender: 'クラブアドバイザー',
    subject: `契約アドバイス：${exp.length}人の契約が今季で満了します`,
    body: `次の選手は今シーズン限りで契約が切れます。シーズン終了までに延長しないと退団してしまいます。\n\n${exp
      .map((p) => `・${p.name}（${p.position} 総合${overall(p)} 年俸 ${fmtMoney(p.salary)}）`)
      .join('\n')}\n\n選手詳細の「契約延長の交渉」から更新できます。`,
    players: exp.map((p) => p.id),
  });
}

/** 選手の気持ち：出場機会に不満 / 調子が良い など */
export function mailPlayerFeelings(state: GameState) {
  const team = state.teams.find((t) => t.id === state.userTeamId)!;
  const squad = squadOf(state, team.id);
  const maxApps = Math.max(1, ...squad.map((p) => p.season.apps));
  const unhappy = squad
    .filter((p) => !team.lineup.includes(p.id) && overall(p) >= 70 && p.season.apps < maxApps * 0.35 && p.ambition > 50)
    .sort((a, b) => overall(b) - overall(a))[0];
  if (unhappy) {
    sendMail(state, {
      from: 'agent',
      sender: `${unhappy.name}の代理人`,
      subject: `${unhappy.name}が出場機会を求めています`,
      body: `${unhappy.name}は最近の出場機会の少なさに不満を感じているようです。\n「もっとプレーしたい。このままなら移籍も考えたい」と話しています。\n\n起用を増やすか、移籍期間に放出を検討してください。`,
      playerId: unhappy.id,
    });
    return;
  }
  const hot = squad.filter((p) => p.condition === 5 && team.lineup.includes(p.id))[0];
  if (hot) {
    sendMail(state, {
      from: 'coach',
      sender: 'アシスタントコーチ',
      subject: `${hot.name}が絶好調です`,
      body: `練習でも${hot.name}の動きが際立っています。今がまさに使い時でしょう。`,
      playerId: hot.id,
    });
  }
}

/** ベストイレブン（リーグ全体、平均評価点ベース） */
export function mailBestEleven(state: GameState, label: string) {
  const ps = Object.values(state.players).filter((p) => p.teamId && p.season.apps >= 3 && state.teams.find((t) => t.id === p.teamId)?.league === 'PL');
  const avg = (p: Player) => (p.ratingSum ?? 0) / Math.max(1, p.season.apps);
  const pickN = (filter: (p: Player) => boolean, n: number) =>
    ps
      .filter(filter)
      .sort((a, b) => avg(b) - avg(a))
      .slice(0, n);
  const gk = pickN((p) => p.position === 'GK', 1);
  const df = pickN((p) => ['CB', 'LSB', 'RSB'].includes(p.position), 4);
  const mf = pickN((p) => ['DMF', 'CMF', 'OMF', 'LMF', 'RMF'].includes(p.position), 3);
  const fw = pickN((p) => ['LWG', 'RWG', 'ST', 'CF'].includes(p.position), 3);
  const xi = [...gk, ...df, ...mf, ...fw];
  if (xi.length < 11) return;
  const mine = xi.filter((p) => p.teamId === state.userTeamId);
  const tname = (p: Player) => state.teams.find((t) => t.id === p.teamId)?.name ?? '';
  sendMail(state, {
    from: 'league',
    sender: 'プレミアリーグ',
    subject: `${label} ベストイレブン発表${mine.length ? `（自クラブから${mine.length}人選出！）` : ''}`,
    body: xi.map((p) => `${p.position.padEnd(4)} ${p.name}（${tname(p)}） 平均 ${avg(p).toFixed(2)}`).join('\n'),
    players: xi.map((p) => p.id),
    important: mine.length > 0,
  });
}

export function mailGrowth(state: GameState, p: Player, before: number, after: number, sudden: boolean) {
  sendMail(state, {
    from: 'coach',
    sender: 'フィジカルコーチ',
    subject: sudden ? `【急成長】${p.name}が大きく成長しました` : `【成長】${p.name}の総合値がアップ`,
    body: sudden
      ? `${p.name}が試合を通じて急成長を遂げました！\n総合値 ${before} → ${after}\n\nこの調子で起用を続ければ、さらに伸びるかもしれません。`
      : `${p.name}の総合値が ${before} → ${after} に上がりました。`,
    playerId: p.id,
  });
}

/** 若手が新しい特殊スキルを習得 */
export function tryNewSkill(state: GameState, p: Player): boolean {
  if (p.skills.length >= 12) return false;
  const pool = SKILLS.filter((s) => !p.skills.includes(s.id) && (p.position === 'GK' ? s.cat === 'gk' : s.cat !== 'gk'));
  const s = pick(pool);
  if (!s) return false;
  p.skills.push(s.id);
  sendMail(state, {
    from: 'coach',
    sender: 'アシスタントコーチ',
    subject: `【新スキル習得】${p.name}が「${SKILL_LABEL[s.id]}」を習得`,
    body: `${p.name}が練習の成果で新しい特殊スキル「${SKILL_LABEL[s.id]}」を身につけました。\n\n${s.desc}`,
    playerId: p.id,
  });
  return true;
}

/** 適性外のポジションで何試合も起用すると、そのポジションの適性が身につく */
export function tryAptitudeGain(state: GameState, p: Player, pos: Position) {
  if (pos === 'GK' || p.position === 'GK' || p.position === pos) return;
  p.roleApps = p.roleApps ?? {};
  p.roleApps[pos] = (p.roleApps[pos] ?? 0) + 1;
  const cur = p.aptitudes[pos] ?? 0;
  const need = cur === 0 ? 5 : cur === 1 ? 10 : 99;
  if (p.roleApps[pos]! >= need && cur < 2) {
    p.aptitudes[pos] = (cur + 1) as 1 | 2;
    p.roleApps[pos] = 0;
    if (p.teamId === state.userTeamId) {
      sendMail(state, {
        from: 'coach',
        sender: 'アシスタントコーチ',
        subject: `【適性拡大】${p.name}が ${pos} に適応しました`,
        body: `${p.name}は ${pos} での出場を重ね、このポジションの${cur === 0 ? '「可」' : '「適性」'}を身につけました。\n${pos} での総合値：${ratingAt(p, pos)}`,
        playerId: p.id,
      });
    }
  }
}

export function mailWindow(state: GameState, opening: boolean) {
  const w = windowStatus(state);
  sendMail(state, {
    from: 'league',
    sender: 'リーグ事務局',
    subject: opening ? `【${w.label}】移籍市場がオープンしました` : '【移籍市場】まもなく移籍期間が終了します',
    body: opening
      ? `${w.label}が開きました（あと${w.remaining}節）。\n他クラブとの交渉や、CPU クラブからのオファーへの対応ができます。`
      : '移籍期間は次の試合の前に終了します。交渉中の案件は早めにまとめましょう。\n期間終了後は、届いているオファーや交渉はすべて無効になります。',
    important: true,
  });
}

export function mailCompetition(state: GameState, subject: string, body: string) {
  sendMail(state, { from: 'league', sender: 'UEFA / プレミアリーグ', subject, body });
}
