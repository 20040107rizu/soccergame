import { describe, expect, it } from 'vitest';
import { computeBadges } from '../badges';
import { marketValue } from '../economy';
import { squadOf } from '../lineup';
import { answerSaudi, saudiTick, spawnSaudi } from '../saudi';
import { newGame } from '../season';
import { overall } from '../stats';

describe('サウジアラビアの超高額オファー', () => {
  it('チームの主力に、1000億円以上かつ市場価値の3倍以上が届く', () => {
    for (let i = 0; i < 10; i++) {
      const s = newGame('テスト', 'ars');
      expect(spawnSaudi(s)).toBe(true);
      const o = s.saudiOffer!;
      const p = s.players[o.playerId];
      const squad = squadOf(s, 'ars');
      const best = Math.max(...squad.map(overall));
      expect(overall(p) === best || p.age >= 28).toBe(true);
      expect(o.fee).toBeGreaterThanOrEqual(625);
      expect(o.fee).toBeGreaterThanOrEqual(marketValue(p) * 3 - 0.01);
      expect(s.mails[0].action).toBe('saudi');
    }
  });

  it('受けるとお金が入り、選手はすぐにいなくなる', () => {
    const s = newGame('テスト', 'ars');
    spawnSaudi(s);
    const o = s.saudiOffer!;
    const money = s.money;
    expect(answerSaudi(s, true).ok).toBe(true);
    expect(s.money).toBeCloseTo(money + o.fee);
    expect(s.players[o.playerId]).toBeUndefined();
    const team = s.teams.find((t) => t.id === 'ars')!;
    expect(team.lineup.length).toBe(11);
    expect(team.lineup.every((id) => s.players[id])).toBe(true);
    expect(computeBadges(s, 1, 0)).toContain('oilMoney');
  });

  it('3回断ると「金では買えない」（期限切れも断った扱い）', () => {
    const s = newGame('テスト', 'ars');
    spawnSaudi(s);
    answerSaudi(s, false);
    spawnSaudi(s);
    answerSaudi(s, false);
    expect(computeBadges(s, 1, 0)).not.toContain('notForSale');
    spawnSaudi(s);
    s.day = s.saudiOffer!.expires + 1;
    saudiTick(s);
    expect(s.saudiOffer).toBeUndefined();
    expect(computeBadges(s, 1, 0)).toContain('notForSale');
  });

  it('10シーズンに1回くらい', () => {
    const s = newGame('テスト', 'ars');
    let n = 0;
    const seasons = 600;
    for (let i = 0; i < seasons * s.calendar.length; i++) {
      saudiTick(s);
      if (s.saudiOffer) {
        n++;
        delete s.saudiOffer;
      }
    }
    const per = seasons / n;
    console.log('saudi: 1 per', per.toFixed(1), 'seasons');
    expect(per).toBeGreaterThan(7);
    expect(per).toBeLessThan(14);
  });
});
