import { describe, expect, it } from 'vitest';
import { careerOf } from '../career';
import { spawnGem, signGem } from '../events';
import { squadOf } from '../lineup';
import { newGame } from '../season';
import { completeSigning } from '../transfer';
import { promoteKid, youthKids } from '../youth';

describe('選手の経歴', () => {
  it('移籍で加入すると、元のクラブ・移籍金・年齢・総合値が残る', () => {
    const s = newGame('テスト', 'ars');
    const p = squadOf(s, 'liv')[0];
    s.negotiations[p.id] = { closed: false, clubTries: 0, playerTries: 0, agreedFee: 50 };
    s.money = 1000;
    expect(completeSigning(s, p.id, p.salary, 3).ok).toBe(true);
    const c = careerOf(s, p);
    const e = c.find((x) => x.k === 'transfer')!;
    expect(e.t).toContain('リヴァプール');
    expect(e.a).toBe(p.age);
    expect(e.o).toBeGreaterThan(0);
  });

  it('掘り出し物は、どこから来てどうだったかが分かる', () => {
    const s = newGame('テスト', 'ars');
    s.money = 1000;
    spawnGem(s);
    const id = s.gemOffer!.playerId;
    signGem(s);
    const e = careerOf(s, s.players[id]).find((x) => x.k === 'gem')!;
    expect(e.t).toContain('掘り出し物');
    expect(e.t).toMatch(/逸材|堅実|期待外れ/);
  });

  it('ユース育ちは入団時と代理人の見立て、昇格が並ぶ', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s).find((k) => k.age === 16)!;
    const hint = kid.youth!.hints[0].text;
    promoteKid(s, kid.id);
    const c = careerOf(s, s.players[kid.id]);
    expect(c.map((x) => x.k)).toEqual(['youthIn', 'hint', 'youthUp']);
    expect(c[1].t).toContain(hint);
  });

  it('記録が始まる前の選手も、分かる範囲で表示する', () => {
    const s = newGame('テスト', 'ars');
    const p = squadOf(s, 'ars')[0];
    expect(careerOf(s, p)[0].t).toContain('監督就任時から在籍');
    const q = squadOf(s, 'ars')[1];
    q.gem = { origin: '南米', tier: 'jackpot', revealed: true };
    q.joinedSeason = 1;
    expect(careerOf(s, q)[0].t).toContain('とんでもない逸材');
  });
});
