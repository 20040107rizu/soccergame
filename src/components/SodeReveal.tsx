import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SODE_NAME, SODE_PLAYERS, type SodeSeed } from '../data/sodegaura';
import { isTopSode, makeSodePlayer, sodeStats } from '../game/sodegaura';
import { overall, STAT_LABEL, STYLES } from '../game/stats';
import type { StatKey } from '../game/types';

/** 期待度の色：青 → 緑 → 赤 → 金 → 虹（強い選手ほど上がる） */
const TIERS = [
  { min: 0, color: '#3da5ff' },
  { min: 88, color: '#35e07a' },
  { min: 91, color: '#ff3b3b' },
  { min: 95, color: '#ffc400' },
  { min: 99, color: 'rainbow' },
];
const tierOf = (efo: number) => TIERS.reduce((a, t, i) => (efo >= t.min ? i : a), 0);
const posCls = (p: string) => (p === 'GK' ? 'gk' : ['CB', 'LSB', 'RSB'].includes(p) ? 'df' : ['DMF', 'CMF', 'OMF', 'LMF', 'RMF'].includes(p) ? 'mf' : '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const buzz = (p: number | number[]) => navigator.vibrate?.(p);

function topStats(s: SodeSeed): [string, number][] {
  const st = sodeStats(s);
  const keys = (Object.keys(st) as StatKey[]).filter((k) => (s.pos === 'GK' ? k.startsWith('gk') : !k.startsWith('gk') && k !== 'defEngagement'));
  return keys
    .sort((a, b) => st[b] - st[a])
    .slice(0, 3)
    .map((k) => [STAT_LABEL[k], st[k]]);
}

/** ひみつのチームに勝った後の「運命の1人」演出（カード抽選 → 保留変化 → イナズマ → めくり） */
export function SodeReveal({ pick, onDone }: { pick: number; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<{ b: string; s?: string }>({ b: '' });
  const [finished, setFinished] = useState(false);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    let alive = true;
    const el = root.current!;
    const board = el.querySelector('.sr-board') as HTMLDivElement;
    const $ = (sel: string) => el.querySelector(sel) as HTMLElement;
    const wait = async (ms: number) => {
      await sleep(ms);
      if (!alive) throw new Error('closed');
    };
    const setTier = (i: number) => el.style.setProperty('--tier', TIERS[i].color === 'rainbow' ? '#ffffff' : TIERS[i].color);
    const shake = () => {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    };
    const flash = () => {
      const f = $('.sr-flash');
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
    };
    const slotXY = (i: number) => ({ left: 1 + (i % 5) * 19.8 + '%', top: Math.floor(i / 5) * 23 + '%' });

    const seed = SODE_PLAYERS[pick];
    const ti = tierOf(seed.efo);
    const rainbow = TIERS[ti].color === 'rainbow';
    const player = makeSodePlayer(seed);

    const cards = SODE_PLAYERS.map((p, i) => {
      const c = document.createElement('div');
      c.className = 'sr-card small';
      c.innerHTML = '<div class="sr-inner"><div class="sr-face sr-back"><div class="sr-crest">袖</div></div><div class="sr-face sr-front"></div></div>';
      const { left, top } = slotXY(i);
      c.style.left = left;
      c.style.top = top;
      board.appendChild(c);
      return { el: c, p };
    });
    setTier(0);

    const shuffle = async (times: number) => {
      for (let t = 0; t < times; t++) {
        const order = [...cards.keys()].sort(() => Math.random() - 0.5);
        order.forEach((ci, slot) => Object.assign(cards[ci].el.style, slotXY(slot)));
        await wait(360);
      }
      cards.forEach((c) => Object.assign(c.el.style, { left: '41%', top: '30%' }));
      await wait(550);
      const order = [...cards.keys()].sort(() => Math.random() - 0.5);
      for (let s = 0; s < order.length; s++) {
        Object.assign(cards[order[s]].el.style, slotXY(s));
        await wait(45);
      }
      await wait(450);
    };

    const roulette = async () => {
      const steps = 30 + Math.floor(Math.random() * 6);
      let idx = Math.floor(Math.random() * cards.length);
      let tier = 0;
      for (let s = 0; s < steps; s++) {
        cards.forEach((c) => c.el.classList.remove('lit', 'rainbow'));
        idx = s === steps - 1 ? pick : (idx + 1 + Math.floor(Math.random() * 6)) % cards.length;
        if (s === steps - 2 && idx === pick) idx = (idx + 4) % cards.length;
        const k = s / steps;
        if (k > 0.62 && tier < ti && Math.random() < 0.45) {
          tier++;
          setTier(tier);
          shake();
          buzz([20, 30, 20]);
        }
        cards[idx].el.classList.add('lit');
        if (TIERS[tier].color === 'rainbow') cards[idx].el.classList.add('rainbow');
        buzz(6);
        await wait(55 + Math.pow(k, 3) * 560);
      }
      while (tier < ti) {
        await wait(420);
        tier++;
        setTier(tier);
        if (TIERS[tier].color === 'rainbow') cards[pick].el.classList.add('rainbow');
        shake();
        flash();
        buzz([30, 30, 60]);
      }
      await wait(800);
    };

    const boltPath = (x0: number, y0: number, x1: number, y1: number) => {
      const pts = [[x0, y0]];
      for (let i = 1; i < 9; i++) {
        const k = i / 9;
        pts.push([x0 + (x1 - x0) * k + (Math.random() - 0.5) * 16, y0 + (y1 - y0) * k + (Math.random() - 0.5) * 4]);
      }
      pts.push([x1, y1]);
      return pts.map((p) => p.join(',')).join(' ');
    };

    const lightning = async (hero: HTMLElement) => {
      const svg = $('.sr-bolt'), dark = $('.sr-dark'), impact = $('.sr-impact');
      const cr = hero.getBoundingClientRect();
      const tx = ((cr.left + cr.width / 2) / innerWidth) * 100;
      const ty = ((cr.top + 6) / innerHeight) * 100;
      $('.sr-rays').classList.remove('on');
      dark.classList.add('on');
      await wait(700);
      for (let i = 0; i < 4; i++) {
        const last = i === 3;
        const sx = last ? tx + (Math.random() - 0.5) * 10 : 15 + Math.random() * 70;
        const main = boltPath(sx, -3, last ? tx : sx + (Math.random() - 0.5) * 30, last ? ty : 30 + Math.random() * 40);
        const branches = [0, 1, 2].map(() => {
          const bx = sx + (Math.random() - 0.5) * 20, by = 8 + Math.random() * 25;
          return boltPath(bx, by, bx + (Math.random() - 0.5) * 40, by + 10 + Math.random() * 20);
        });
        svg.innerHTML = [main, ...branches]
          .map((pts, j) => `<polyline points="${pts}" class="glow${j ? ' thin' : ''}" /><polyline points="${pts}" class="core${j ? ' thin' : ''}" />`)
          .join('');
        svg.classList.remove('go');
        void svg.getBoundingClientRect();
        svg.classList.add('go');
        flash();
        shake();
        buzz(last ? [80, 40, 160] : [40]);
        if (last) {
          hero.classList.add('charged');
          impact.classList.remove('go');
          void impact.offsetWidth;
          impact.classList.add('go');
        }
        await wait(last ? 900 : 450 + Math.random() * 350);
      }
      svg.innerHTML = '';
      dark.classList.remove('on');
      $('.sr-rays').classList.add('on');
      await wait(300);
      hero.classList.remove('charged');
    };

    const sparks = () => {
      const r = board.getBoundingClientRect();
      const cols = rainbow ? ['#ff4d4d', '#ffd84d', '#4dff88', '#4db8ff', '#c04dff'] : [getComputedStyle(el).getPropertyValue('--tier').trim(), '#ffd84d', '#fff'];
      for (let i = 0; i < 46; i++) {
        const s = document.createElement('div');
        s.className = 'sr-spark';
        s.style.background = cols[i % cols.length];
        s.style.left = r.width / 2 + 'px';
        s.style.top = r.height * 0.38 + 'px';
        board.appendChild(s);
        const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 180;
        s.animate(
          [
            { transform: 'translate(0,0) rotate(0) scale(1.2)', opacity: 1 },
            { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 80}px) rotate(${Math.random() * 720}deg) scale(.4)`, opacity: 0 },
          ],
          { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' },
        );
      }
    };

    const rollNumber = async (n: HTMLElement, final: number) => {
      n.classList.add('roll');
      for (let i = 0; i < 22; i++) {
        n.textContent = String(40 + Math.floor(Math.random() * 60));
        await wait(35 + i * 4);
      }
      n.classList.remove('roll');
      n.textContent = String(final);
      n.classList.add('land');
      shake();
      buzz(50);
    };

    (async () => {
      await wait(2200);
      setIntro(false);
      setMsg({ b: `${SODE_NAME}の18人`, s: 'この中から、運命の1人が選ばれる' });
      await wait(1300);
      setMsg({ b: 'シャッフル中…' });
      await shuffle(4);
      setMsg({ b: '誰が来る…？' });
      await roulette();
      setMsg({ b: '' });
      const hero = cards[pick].el;
      cards.forEach((c, i) => i !== pick && c.el.classList.add('out'));
      await wait(550);
      hero.classList.remove('lit', 'small');
      hero.classList.add('hero');
      $('.sr-rays').classList.add('on');
      if (rainbow) $('.sr-rays').classList.add('rainbow');
      await wait(500);
      if (isTopSode(seed)) await lightning(hero);
      const front = hero.querySelector('.sr-front') as HTMLElement;
      if (rainbow) front.classList.add('rainbow');
      front.innerHTML = `
        <div class="sr-ftop"><div class="sr-pos ${posCls(seed.pos)}">${seed.pos}</div></div>
        <div class="sr-ovr-wrap"><div class="sr-ovr-label">OVERALL</div><div class="sr-ovr">--</div></div>
        <div class="sr-name">${seed.name}</div>
        <div class="sr-style">${STYLES[seed.style]?.label ?? ''}</div>
        <div class="sr-bars">${topStats(seed)
          .map(([k, v]) => `<div class="sr-bar"><span>${k}</span><i style="--w:${v}%"></i><b>${v}</b></div>`)
          .join('')}</div>`;
      flash();
      hero.classList.add('flip');
      sparks();
      await wait(700);
      await rollNumber(front.querySelector('.sr-ovr') as HTMLElement, overall(player));
      await wait(250);
      front.querySelector('.sr-name')!.classList.add('in');
      await wait(420);
      shake();
      buzz(40);
      front.querySelector('.sr-style')!.classList.add('in');
      front.querySelector('.sr-bars')!.classList.add('in');
      await wait(600);
      setMsg({ b: `${seed.name}（${seed.pos}）`, s: ti >= 3 ? 'チームの中心選手が、あなたのクラブに興味を示している！' : '移籍の話を聞いてくれるようだ' });
      setFinished(true);
    })().catch(() => {});
    return () => {
      alive = false;
      board.querySelectorAll('.sr-card, .sr-spark').forEach((x) => x.remove());
    };
  }, [pick]);

  return createPortal(
    <div className="sr" ref={root}>
      <div className="sr-msg">
        <b>{msg.b || ' '}</b>
        <small>{msg.s || ' '}</small>
      </div>
      <div className="sr-board">
        <div className="sr-rays" />
        <div className="sr-dark" />
        <div className="sr-impact" />
      </div>
      <div className="sr-actions">
        {finished ? (
          <button className="btn primary big" onClick={onDone}>
            交渉へ進む
          </button>
        ) : (
          <button className="btn ghost" onClick={onDone}>
            スキップ
          </button>
        )}
      </div>
      <div className={'sr-intro' + (intro ? '' : ' hide')}>
        <div>
          <h1>{SODE_NAME} 撃破</h1>
          <p>
            健闘をたたえ合ったあと――
            <br />
            1人の選手が、あなたのクラブに興味を示している…
          </p>
        </div>
      </div>
      <svg className="sr-bolt" viewBox="0 0 100 100" preserveAspectRatio="none" />
      <div className="sr-flash" />
    </div>,
    document.body,
  );
}
