import { describe, expect, it } from 'vitest';
import { computeBadges } from '../badges';
import { simulateToEnd } from '../engine';
import { careerOf } from '../career';
import { squadOf } from '../lineup';
import { newGame } from '../season';
import { answerWCOffer, closeWorldCup, coachMatch, groupTable, maybeStartWorldCup, playWCDay, startWorldCup, WC_DAYS, wcSquads } from '../worldcup';

describe('ワールドカップ', () => {
  it('4シーズンに1回だけ開幕する', () => {
    const s = newGame('テスト', 'ars');
    maybeStartWorldCup(s, 3);
    expect(s.worldCup).toBeUndefined();
    maybeStartWorldCup(s, 4);
    expect(s.worldCup).toBeDefined();
  });

  it('32か国・8グループ。日本は必ず出場し、代表監督のオファーに入る', () => {
    const s = newGame('テスト', 'ars');
    const t0 = Date.now();
    const wc = startWorldCup(s, 4);
    console.log('wc setup ms', Date.now() - t0, wc.nations.slice(0, 8).join(','));
    expect(wc.nations.length).toBe(32);
    expect(new Set(wc.nations).size).toBe(32);
    expect(wc.nations).toContain('日本');
    expect(wc.groups.length).toBe(8);
    expect(wc.groups.every((g) => g.length === 4)).toBe(true);
    expect(wc.offers).toContain('日本');
    expect(Object.values(wcSquads(wc)).every((ids) => ids.length === 23)).toBe(true);
    expect(wc.fixtures.length).toBe(48);
    expect(s.mails[0].subject).toContain('ワールドカップ');
  });

  it('日本代表を率いて最後まで戦い、クラブに戻ると経歴が残る', () => {
    const s = newGame('テスト', 'ars');
    const wc = startWorldCup(s, 4);
    answerWCOffer(s, '日本');
    expect(wc.coach).toBe('日本');
    let live = 0;
    for (let d = 0; d < WC_DAYS && s.worldCup!.stage === 'play'; d++) {
      const cm = coachMatch(s);
      if (cm) {
        live++;
        // 試合画面の代わりに最後まで進める
        simulateToEnd(cm.state, cm.match);
      }
      playWCDay(s, cm ?? undefined);
    }
    expect(live).toBeGreaterThanOrEqual(3);
    expect(s.worldCup!.stage).toBe('done');
    expect(s.worldCup!.champion).toBeTruthy();
    expect(groupTable(s.worldCup!, 0)[0].played).toBe(3);
    expect(s.wcHistory?.[0].coach).toBe('日本');
    const mine = squadOf(s, 'ars').filter((p) => Object.values(wcSquads(s.worldCup!)).some((ids) => ids.includes(p.id)) && s.worldCup!.ratings[p.id]);
    closeWorldCup(s);
    expect(s.worldCup).toBeUndefined();
    expect(mine.length).toBeGreaterThan(0);
    expect(careerOf(s, s.players[mine[0].id]).some((e) => e.k === 'worldcup')).toBe(true);
    computeBadges(s, 1, 0);
  }, 60000);
});
