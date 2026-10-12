import { describe, expect, it, vi } from 'vitest';
import { acceptJob, answerDemand, awaken, hiddenTrait, matchBonuses, onRetire, promoteAcademy, signGem, spawnDemand, spawnGem, unlock, jobOfferAtSeasonEnd } from '../events';
import { spawnHeir } from '../legend';
import { squadOf } from '../lineup';
import { endSeason, isSeasonOver, newGame, playDay, prepareDay, teamById } from '../season';
import { overall } from '../stats';

describe('隠しシステム', () => {
  it('覚醒で総合値が大きく上がる', () => {
    const s = newGame('テスト', 'ars');
    const p = squadOf(s, 'ars').sort((a, b) => a.age - b.age)[0];
    const before = overall(p);
    awaken(s, p, 'テスト');
    expect(overall(p)).toBeGreaterThan(before + 4);
    expect(p.awakened).toBe(true);
    expect(s.achievements?.awaken).toBeTruthy();
  });

  it('掘り出し物は獲得すると正体が分かる', () => {
    const s = newGame('テスト', 'ars');
    const p = spawnGem(s);
    expect(s.mails[0].action).toBe('gem');
    expect(signGem(s).ok).toBe(true);
    expect(s.players[p.id].teamId).toBe('ars');
    expect(s.players[p.id].gem?.revealed).toBe(true);
    expect(s.mails.some((m) => m.subject.includes('正体判明'))).toBe(true);
  });

  it('わがままに対応できる', () => {
    const s = newGame('テスト', 'ars');
    const p = squadOf(s, 'ars')[0];
    s.demand = { playerId: p.id, kind: 'playtime', expires: 99 };
    expect(answerDemand(s, 'accept').ok).toBe(true);
    expect(s.players[p.id].promise?.need).toBe(3);
    // spawnDemand は候補がいなければ何もしない
    expect(typeof spawnDemand(s)).toBe('boolean');
  });

  it('年俸アップ要求は失敗しても何度か話し合える', () => {
    const s = newGame('テスト', 'ars');
    const p = squadOf(s, 'ars')[0];
    // 古いセーブの形（tries なし）
    s.demand = { playerId: p.id, kind: 'raise', expires: 99 };
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const r1 = answerDemand(s, 'persuade');
    expect(r1.ok && 'keep' in r1 && r1.keep).toBe(true);
    expect(s.demand?.tries).toBe(1);
    answerDemand(s, 'compromise');
    expect(s.demand?.tries).toBe(2);
    answerDemand(s, 'persuade');
    expect(s.demand).toBeUndefined();
    spy.mockReturnValue(0);
    s.demand = { playerId: p.id, kind: 'raise', expires: 99 };
    const before = p.salary;
    expect(answerDemand(s, 'compromise').ok).toBe(true);
    expect(s.demand).toBeUndefined();
    expect(s.players[p.id].salary).toBeGreaterThan(before);
    spy.mockRestore();
  });

  it('監督オファーを受けるとクラブが変わる', () => {
    const s = newGame('テスト', 'bou');
    jobOfferAtSeasonEnd(s, 1, 15, '出場なし');
    if (!s.jobOffer) s.jobOffer = { teamIds: ['mci'], expires: 3 };
    const to = s.jobOffer.teamIds[0];
    expect(acceptJob(s, to).ok).toBe(true);
    expect(s.userTeamId).toBe(to);
    expect(teamById(s, to).lineup.length).toBe(11);
  });

  it('黄金世代はユースから有望株が4人昇格する', () => {
    const s = newGame('テスト', 'ars');
    s.flags = { [`golden-${s.season}`]: true };
    const names = promoteAcademy(s);
    expect(names.length).toBe(4);
    const kids = squadOf(s, 'ars').filter((p) => p.academy);
    expect(kids.every((p) => p.potential >= 84)).toBe(true);
  });

  it('殿堂入りと背番号の継承', () => {
    const s = newGame('テスト', 'ars');
    const [vet, kid] = squadOf(s, 'ars');
    vet.clubApps = 120;
    kid.mentorId = vet.id;
    onRetire(s, vet);
    expect(s.hallOfFame?.[0].name).toBe(vet.name);
    expect(kid.number).toBe(vet.number);
  });

  it('隠し特性と古巣への補正', () => {
    const s = newGame('テスト', 'ars');
    const withTrait = Object.values(s.players).filter((p) => hiddenTrait(p)).length / Object.keys(s.players).length;
    expect(withTrait).toBeGreaterThan(0.2);
    expect(withTrait).toBeLessThan(0.4);
    const p = squadOf(s, 'ars')[3];
    p.exTeamId = 'tot';
    const f = s.fixtures.find((x) => x.comp === 'PL')!;
    const b = matchBonuses(s, f, teamById(s, 'ars'), teamById(s, 'tot'));
    expect(b[p.id]).toBeGreaterThan(1);
  });

  it('2世の情報が届く・実績は一度だけ', () => {
    const s = newGame('テスト', 'ars');
    const h = spawnHeir(s, 'pele')!;
    expect(h.name).toBe('ペレ2世');
    expect(s.legendOffer?.playerId).toBe(h.id);
    unlock(s, 'firstWin');
    unlock(s, 'firstWin');
    expect(s.mails.filter((m) => m.subject.includes('初勝利')).length).toBe(1);
  });

  it('1シーズン通しても破綻しない', () => {
    const s = newGame('テスト', 'tot');
    while (!isSeasonOver(s)) {
      prepareDay(s);
      playDay(s);
    }
    endSeason(s);
    expect(s.season).toBe(2);
    expect(squadOf(s, s.userTeamId).length).toBeGreaterThanOrEqual(18);
    expect(Object.keys(s.achievements ?? {}).length).toBeGreaterThan(0);
  }, 60000);
});

describe('レジェンドXI 戦', () => {
  it('挑戦状 → 勝利 → 交渉成立で若き日のレジェンドが加入（総合値は低め）', async () => {
    const { vi } = await import('vitest');
    const lc = await import('../legendChallenge');
    const s = newGame('テスト', 'ars');
    s.money = 500;
    lc.spawnLegendChallenge(s);
    expect(s.mails[0].action).toBe('legendMatch');
    const snap = lc.legendTeamSnapshot();
    expect(snap.players.length).toBe(18);
    lc.finishLegendChallenge(s, 2, 1);
    expect(s.legendChallenge?.status).toBe('won');
    const spy = vi.spyOn(Math, 'random').mockImplementationOnce(() => 0.01);
    const r = lc.negotiateLegendPick(s, 'xavi');
    spy.mockRestore();
    expect(r.ok && r.joined).toBe(true);
    const p = Object.values(s.players).find((x) => x.name === 'シャビ' && x.teamId === 'ars')!;
    expect(overall(p)).toBeLessThan(80);
    expect(p.potential).toBeGreaterThan(100);
    expect(s.legendChallenge).toBeUndefined();
  });

  it('負けたら交渉権はない', async () => {
    const lc = await import('../legendChallenge');
    const s = newGame('テスト', 'ars');
    lc.spawnLegendChallenge(s);
    lc.finishLegendChallenge(s, 0, 3);
    expect(s.legendChallenge).toBeUndefined();
  });
});

describe('ひみつのチーム戦', () => {
  it('挑戦状 → 勝利でランダムに1人選ばれ、交渉成立で加入する', async () => {
    const { vi } = await import('vitest');
    const sc = await import('../sodegaura');
    const { SODE_PLAYERS } = await import('../../data/sodegaura');
    const s = newGame('テスト', 'ars');
    s.money = 500;
    sc.spawnSodeChallenge(s);
    expect(s.mails[0].action).toBe('sodeMatch');
    const snap = sc.sodeTeamSnapshot();
    expect(snap.players.length).toBe(18);
    expect(snap.slots.length).toBe(11);
    // スーパーサブ必須の3人
    for (const n of ['石井健人', '鳥居大雅', '佐倉大晟']) expect(SODE_PLAYERS.find((p) => p.name === n)?.skills).toContain('superSub');
    sc.finishSodeChallenge(s, 3, 2);
    expect(s.sodeChallenge?.status).toBe('won');
    const seed = sc.sodePickSeed(s)!;
    expect(seed).toBeTruthy();
    const spy = vi.spyOn(Math, 'random').mockImplementationOnce(() => 0.01);
    const r = sc.negotiateSodePick(s);
    spy.mockRestore();
    expect(r.ok && r.joined).toBe(true);
    const p = Object.values(s.players).find((x) => x.name === seed.name && x.teamId === 'ars')!;
    expect(p.age).toBe(17);
    expect(overall(p)).toBeLessThanOrEqual(70);
    expect(p.potential).toBeGreaterThanOrEqual(sc.sodeFullOverall(seed));
    expect(s.sodeChallenge).toBeUndefined();
    // 試合を重ねると本来の能力まで伸び、それ以上にはならない
    let games = 0;
    while (overall(p) < p.potential && games < 300) {
      sc.sodeGrowth(p, 6.5);
      games++;
    }
    console.log('sode growth games', seed.name, games, overall(p), p.potential);
    expect(overall(p)).toBe(p.potential);
    expect(games).toBeGreaterThan(10);
  });

  it('2回に1回は、本来の能力より上まで伸びる素質を持つ', async () => {
    const { vi } = await import('vitest');
    const sc = await import('../sodegaura');
    const { SODE_PLAYERS } = await import('../../data/sodegaura');
    const seed = SODE_PLAYERS.find((x) => x.name === '佐藤瑠威')!;
    const full = sc.sodeFullOverall(seed);
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => 0.1);
    const up = sc.makeSodePlayer(seed);
    spy.mockRestore();
    expect(up.sode?.extra).toBeGreaterThan(0);
    expect(up.potential).toBeGreaterThan(full);
    const spy2 = vi.spyOn(Math, 'random').mockImplementation(() => 0.9);
    const normal = sc.makeSodePlayer(seed);
    spy2.mockRestore();
    expect(normal.sode?.extra).toBeUndefined();
    expect(normal.potential).toBe(full);
    for (let i = 0; i < 300 && overall(up) < up.potential; i++) sc.sodeGrowth(up, 6.5);
    expect(overall(up)).toBe(up.potential);
  });

  it('負けたら交渉権はない', async () => {
    const sc = await import('../sodegaura');
    const s = newGame('テスト', 'ars');
    sc.spawnSodeChallenge(s);
    sc.finishSodeChallenge(s, 1, 1);
    expect(s.sodeChallenge).toBeUndefined();
  });
});
