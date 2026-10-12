import { describe, expect, it, vi } from 'vitest';
import { applyCoachReward, checkMiracle, coachRewardOptions, finishCoachChallenge, inheritAceTick, markAce, passMystery, revealMystery, signMystery, spawnCoachChallenge, spawnMystery, zoneAfterMatch, zoneBonus } from '../hidden2';
import { parseSnapshot } from '../friendly';
import { squadOf } from '../lineup';
import { newGame } from '../season';
import { overall } from '../stats';

describe('名将・背番号・ゾーン・謎の代理人', () => {
  it('名将に勝つと、選んだ選手に新しい適性ポジションが1つ付く', () => {
    const s = newGame('テスト', 'ars');
    spawnCoachChallenge(s, 'magic');
    expect(s.mails[0].action).toBe('coachMatch');
    expect(parseSnapshot(s.coachChallenge!.snap)?.players.length).toBe(18);
    finishCoachChallenge(s, 2, 1);
    expect(s.coachChallenge?.status).toBe('won');
    const p = squadOf(s, 'ars').find((x) => x.position === 'CF')!;
    const opts = coachRewardOptions(p);
    expect(opts).not.toContain('GK');
    const pos = opts[opts.length - 1];
    expect(applyCoachReward(s, p.id, pos).ok).toBe(true);
    expect(p.aptitudes[pos]).toBe(3);
    expect(s.coachChallenge).toBeUndefined();
  });

  it('エースの背番号を若手が受け継ぐことがある', () => {
    const s = newGame('テスト', 'ars');
    const [vet, kid] = squadOf(s, 'ars');
    vet.clubApps = 150;
    vet.peakOvr = 90;
    vet.joinedSeason = s.season - 4;
    markAce(s, vet);
    expect(s.aceNumbers?.[vet.number]?.name).toBe(vet.name);
    vet.teamId = null;
    kid.age = 19;
    kid.number = vet.number;
    const before = overall(kid);
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.01);
    inheritAceTick(s);
    spy.mockRestore();
    expect(kid.aceOf).toBe(vet.number);
    expect(overall(kid)).toBeGreaterThanOrEqual(before);
  });

  it('2点差をひっくり返すと奇跡の試合として残り、ゾーンに入ることがある', () => {
    const s = newGame('テスト', 'ars');
    const goals = [
      { side: 'away', minute: 10 },
      { side: 'away', minute: 20 },
      { side: 'home', minute: 50 },
      { side: 'home', minute: 60 },
      { side: 'home', minute: 88 },
    ];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.01);
    checkMiracle(s, goals, 'home', '相手', 3, 2);
    spy.mockRestore();
    expect(s.miracles?.length).toBe(1);
    expect(s.zone).toBe(3);
    expect(zoneBonus(s, 'ars')).toBeGreaterThan(1);
    for (let i = 0; i < 3; i++) zoneAfterMatch(s);
    expect(zoneBonus(s, 'ars')).toBe(1);
  });

  it('謎の代理人の選手は、獲得して試合を重ねると正体が分かる', () => {
    const s = newGame('テスト', 'ars');
    s.money = 500;
    const p = spawnMystery(s);
    expect(s.mails[0].action).toBe('mystery');
    expect(signMystery(s).ok).toBe(true);
    expect(p.teamId).toBe('ars');
    p.clubApps = 8;
    revealMystery(s, p);
    expect(p.mystery?.revealed).toBe(true);
    const q = spawnMystery(s);
    passMystery(s);
    expect(s.players[q.id]).toBeUndefined();
  });
});
