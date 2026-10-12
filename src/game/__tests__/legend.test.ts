import { describe, expect, it } from 'vitest';
import { acceptLegend, spawnLegend } from '../legend';
import { prepareDay, playDay, newGame, teamById } from '../season';
import { overall } from '../stats';
import { negotiateOffer } from '../transfer';
import { round2 } from '../economy';

describe('レジェンド', () => {
  it('急成長期待の選手は試合を重ねると急激に成長する', () => {
    const s = newGame('テスト', 'ars');
    const p = spawnLegend(s, 'prodigy')!;
    expect(p.legend?.kind).toBe('prodigy');
    expect(s.legendOffer?.playerId).toBe(p.id);
    expect(s.mails[0].legend).toBe(true);
    s.money = 9999;
    s.legendOffer!.chance = 1;
    const r = acceptLegend(s);
    expect(r.ok && r.joined).toBe(true);
    expect(s.players[p.id].teamId).toBe('ars');
    expect(s.players[p.id].number).toBe(p.position === 'GK' ? 1 : 10);
    const start = overall(s.players[p.id]);
    for (let i = 0; i < 20; i++) {
      const t = teamById(s, 'ars');
      if (!t.lineup.includes(p.id)) t.lineup[t.lineup.length - 1] = p.id;
      prepareDay(s);
      playDay(s);
    }
    expect(overall(s.players[p.id])).toBeGreaterThan(start + 6);
  }, 60000);

  it('断られると選手は消える', () => {
    const s = newGame('テスト', 'ars');
    const p = spawnLegend(s, 'monster')!;
    expect(overall(p)).toBeGreaterThanOrEqual(90);
    s.money = 9999;
    s.legendOffer!.chance = 0;
    const r = acceptLegend(s);
    expect(r.ok && r.joined).toBe(false);
    expect(s.players[p.id]).toBeUndefined();
    expect(s.legendOffer).toBeUndefined();
  });
});

describe('チームスピリット', () => {
  it('1シーズンかけて最大近くまで上がる（1節では上がりきらない）', () => {
    const s = newGame('テスト', 'ars');
    const t = teamById(s, 'ars');
    t.spirit = 70;
    prepareDay(s);
    playDay(s);
    expect(teamById(s, 'ars').spirit).toBeLessThan(76);
  });
});

describe('オファー交渉', () => {
  it('上限内の希望額なら合意、吹っかけすぎると決裂', () => {
    const s = newGame('テスト', 'ars');
    const pid = Object.values(s.players).find((p) => p.teamId === 'ars')!.id;
    s.offers.push({ id: 'o1', playerId: pid, fromTeam: 'mci', fee: 50, day: 0, maxFee: 60, tries: 0 });
    expect(negotiateOffer(s, 'o1', 58).result).toBe('accept');
    expect(s.offers[0].fee).toBe(58);
    s.offers.push({ id: 'o2', playerId: pid, fromTeam: 'liv', fee: 50, day: 0, maxFee: 60, tries: 0 });
    expect(negotiateOffer(s, 'o2', round2(50 * 3)).result).toBe('walkaway');
    expect(s.offers.find((o) => o.id === 'o2')).toBeUndefined();
  });
});

describe('ダビド・ビジャ', () => {
  it('レジェンドとして出現しうる（2世の元にもなる）', async () => {
    const { spawnHeir, legendName } = await import('../legend');
    expect(legendName('villa')).toBe('ダビド・ビジャ');
    const s = newGame('テスト', 'ars');
    const h = spawnHeir(s, 'villa')!;
    expect(h.name).toBe('ダビド・ビジャ2世');
    expect(h.position).toBe('CF');
  });
});

describe('フレンドランキング', () => {
  it('状況のまとめに個人情報以外の項目がそろう', async () => {
    const { rankingSummary } = await import('../ranking');
    const s = newGame('テスト監督', 'ars');
    const r = rankingSummary(s, 1);
    expect(r.nickname).toBe('テスト監督');
    expect(r.club).toBe('アーセナル');
    expect(r.season).toBe(1);
    expect(typeof r.money).toBe('number');
  });
});

describe('親善試合', () => {
  it('フレンドのチームと試合ができ、自分のセーブは変わらない', async () => {
    const { teamSnapshot, friendlyMatch, parseSnapshot } = await import('../friendly');
    const { simulateToEnd } = await import('../engine');
    const friendState = newGame('フレンド', 'liv');
    const snap = parseSnapshot(JSON.stringify(teamSnapshot(friendState)))!;
    expect(snap.players.length).toBeGreaterThanOrEqual(11);
    expect(JSON.stringify(snap).length).toBeLessThan(40000);
    const mine = newGame('自分', 'ars');
    const before = JSON.stringify(mine);
    const { state, match } = friendlyMatch(mine, snap, 'フレンド');
    simulateToEnd(state, match);
    expect(match.finished).toBe(true);
    expect(JSON.stringify(mine)).toBe(before);
  });
});
