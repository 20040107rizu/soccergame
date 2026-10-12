import { describe, expect, it } from 'vitest';
import { squadOf } from '../lineup';
import { newGame } from '../season';
import { askingPrice, completeSigning, offerToClub, offerToPlayer, PLAYER_TRIES, playerInterest, salaryDemand, wageRoomFor } from '../transfer';

describe('移籍交渉', () => {
  it('クラブ合意 → 選手合意で移籍が成立する', () => {
    const s = newGame('テスト', 'mci');
    s.money = 500;
    // 控えクラスの選手（非売品にならない）を狙う
    const target = Object.values(s.players).find((p) => p.teamId === 'ful' && p.position === 'CF')!;
    const ask = askingPrice(s, target);
    expect(offerToClub(s, target.id, ask * 0.3).result).toBe('reject');
    expect(offerToClub(s, target.id, ask).result).toBe('accept');
    const it = playerInterest(s, target);
    expect(it.reasons.length).toBeGreaterThan(2);
    const demand = salaryDemand(s, target);
    const r = offerToPlayer(s, target.id, demand, 3);
    expect(r.result).toBe('accept');
    expect(completeSigning(s, target.id, demand, 3).ok).toBe(true);
    expect(s.players[target.id].teamId).toBe('mci');
    expect(s.money).toBeCloseTo(500 - ask, 1);
    expect(squadOf(s, 'ful').length).toBeGreaterThanOrEqual(22);
  });

  it('3回断られると交渉が打ち切られる', () => {
    const s = newGame('テスト', 'ips');
    const target = Object.values(s.players).find((p) => p.teamId === 'bou' && p.position === 'CB')!;
    const ask = askingPrice(s, target);
    offerToClub(s, target.id, ask * 0.5);
    offerToClub(s, target.id, ask * 0.5);
    expect(offerToClub(s, target.id, ask * 0.5).result).toBe('closed');
    expect(offerToClub(s, target.id, ask * 2).result).toBe('closed');
  });

  it('選手との年俸交渉は何度か提示でき、近い条件なら逆提示してくれる', () => {
    const s = newGame('テスト', 'mci');
    s.money = 500;
    const target = Object.values(s.players).find((p) => p.teamId === 'ful' && p.position === 'CF')!;
    offerToClub(s, target.id, askingPrice(s, target));
    const demand = salaryDemand(s, target);
    for (let i = 0; i < PLAYER_TRIES - 1; i++) expect(offerToPlayer(s, target.id, demand * 0.3, 3).result).toBe('reject');
    const r = offerToPlayer(s, target.id, demand * 0.8, 3);
    expect(r.result).toBe('counter');
    expect(offerToPlayer(s, target.id, r.counter!, 3).result).toBe('accept');
  });

  it('年俸の空き枠が足りない時は交渉前に分かる', () => {
    const s = newGame('テスト', 'mci');
    const target = Object.values(s.players).find((p) => p.teamId === 'ful' && p.position === 'CF')!;
    expect(wageRoomFor(s, target).enough).toBe(true);
    for (const p of squadOf(s, 'mci')) p.salary = 20;
    const w = wageRoomFor(s, target);
    expect(w.enough).toBe(false);
    expect(w.room).toBe(0);
    expect(offerToPlayer(s, target.id, 1, 3).message).toContain('空き枠');
  });
});
