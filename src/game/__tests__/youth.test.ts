import { describe, expect, it } from 'vitest';
import { squadOf } from '../lineup';
import { endSeason, newGame, playDay } from '../season';
import { overall } from '../stats';
import { answerSlump, answerYouthOffer, consultAgent, CONSULT_COST, convertKid, makeKid, promoteKid, setMentor, youthKids, youthTick, YOUTH_MAX } from '../youth';

describe('ユースチーム', () => {
  it('新しいゲームではユースに3人いて、トップチームの登録とは別', () => {
    const s = newGame('テスト', 'ars');
    const kids = youthKids(s);
    expect(kids.length).toBe(3);
    expect(kids.every((k) => !s.players[k.id] && k.teamId === null && k.youth)).toBe(true);
    expect(s.mails.some((m) => m.subject.includes('ユース'))).toBe(true);
  });

  it('1シーズンで成長し、シーズン終了で年を取り新しい子が入る', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s).find((k) => k.age === 15)!;
    const before = overall(kid);
    for (let d = 0; d < s.calendar.length; d++) {
      s.day = d;
      youthTick(s);
    }
    expect(overall(kid)).toBeGreaterThan(before);
    s.day = s.calendar.length;
    endSeason(s);
    expect(kid.age).toBe(16);
    expect(kid.youth!.hist.length).toBe(2);
    expect(youthKids(s).length).toBeGreaterThan(3);
    expect(youthKids(s).length).toBeLessThanOrEqual(YOUTH_MAX);
  });

  it('昇格するとトップチームの選手になり、成長アルバムが続く', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s).find((k) => k.age === 16)!;
    const n = squadOf(s, 'ars').length;
    expect(promoteKid(s, kid.id).ok).toBe(true);
    expect(squadOf(s, 'ars').length).toBe(n + 1);
    const p = s.players[kid.id];
    expect(p.academy).toBe(true);
    expect(p.salary).toBeGreaterThan(0);
    expect(p.potential).toBeGreaterThanOrEqual(overall(p));
    expect(squadOf(s, 'ars').filter((x) => x.number === p.number).length).toBe(1);
    expect(s.youth!.kids[kid.id]).toBeUndefined();
  });

  it('15歳は昇格できない', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s).find((k) => k.age === 15)!;
    expect(promoteKid(s, kid.id).ok).toBe(false);
  });

  it('代理人への相談は1シーズン1回で、お金がかかる', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s)[0];
    const money = s.money;
    const r = consultAgent(s, kid.id);
    expect(r.ok).toBe(true);
    expect(r.text).toBeTruthy();
    expect(s.money).toBeCloseTo(money - CONSULT_COST);
    expect(consultAgent(s, kid.id).ok).toBe(false);
    expect(kid.youth!.hints.length).toBe(2);
  });

  it('コンバート・師匠', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s)[0];
    const to = kid.position === 'GK' ? 'CB' : 'GK';
    expect(convertKid(s, kid.id, to).ok).toBe(true);
    expect(kid.position).toBe(to);
    expect(kid.aptitudes[to]).toBe(3);
    const vet = squadOf(s, 'ars').find((p) => p.age >= 27 && overall(p) >= 78)!;
    expect(setMentor(s, kid.id, vet.id).ok).toBe(true);
    expect(kid.youth!.mentor).toBe(vet.id);
  });

  it('引き抜きを受けると補償金が入り、ユースからいなくなる', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s)[0];
    kid.youth!.offer = { club: 'rma', fee: 20, expires: s.day + 5 };
    const money = s.money;
    expect(answerYouthOffer(s, kid.id, true).ok).toBe(true);
    expect(s.money).toBeCloseTo(money + 20);
    expect(s.youth!.kids[kid.id]).toBeUndefined();
  });

  it('伸び悩みには一度だけ答えられる', () => {
    const s = newGame('テスト', 'ars');
    const kid = youthKids(s)[0];
    kid.youth!.slump = { until: s.day + 8 };
    expect(answerSlump(s, kid.id, 'watch').ok).toBe(true);
    expect(answerSlump(s, kid.id, 'talk').ok).toBe(false);
  });

  it('天才型は大器晩成より18歳の時点で総合値が高い（平均）', () => {
    const s = newGame('テスト', 'ars');
    const avg = (t: 'genius' | 'grand') => {
      let sum = 0;
      for (let i = 0; i < 20; i++) sum += overall(makeKid(s, 18, t));
      return sum / 20;
    };
    expect(avg('genius')).toBeGreaterThan(avg('grand') + 5);
  });

  it('試合を進めてもユースの子はトップチームの試合に出ない', () => {
    const s = newGame('テスト', 'ars');
    const ids = youthKids(s).map((k) => k.id);
    for (let i = 0; i < 3; i++) playDay(s);
    for (const t of s.teams) expect(t.lineup.some((id) => ids.includes(id))).toBe(false);
  });
});
