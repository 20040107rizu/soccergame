import { describe, expect, it } from 'vitest';
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
