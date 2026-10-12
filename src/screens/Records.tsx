import { useState } from 'react';
import { Jersey } from '../components/Jersey';
import { PosTag, Seg, Sheet } from '../components/ui';
import { ACHIEVEMENTS } from '../game/events';
import { teamById } from '../game/season';
import type { HallEntry, Position } from '../game/types';
import { useGame } from '../store';
import { Dex } from './Dex';

const hofKey = (e: HallEntry) => `${e.name}@${e.season}`;

/** 歴代ベストイレブンの枠（4-3-3） */
const XI_SLOTS: { pos: Position; x: number; y: number }[] = [
  { pos: 'LWG', x: 16, y: 14 },
  { pos: 'CF', x: 50, y: 9 },
  { pos: 'RWG', x: 84, y: 14 },
  { pos: 'CMF', x: 22, y: 40 },
  { pos: 'CMF', x: 50, y: 46 },
  { pos: 'CMF', x: 78, y: 40 },
  { pos: 'LSB', x: 12, y: 68 },
  { pos: 'CB', x: 37, y: 72 },
  { pos: 'CB', x: 63, y: 72 },
  { pos: 'RSB', x: 88, y: 68 },
  { pos: 'GK', x: 50, y: 90 },
];

/** クラブの記録：実績（トロフィー）・殿堂・図鑑 */
export function Records() {
  const { state } = useGame();
  const [tab, setTab] = useState<'ach' | 'hof'>('ach');
  const [dex, setDex] = useState(false);
  const got = state.achievements ?? {};
  const hof = state.hallOfFame ?? [];
  const n = Object.keys(got).length;
  return (
    <>
      <h3 className="section-title">クラブの記録</h3>
      <button className="btn dex-btn" onClick={() => setDex(true)}>
        📖 選手図鑑（{Object.keys(state.dex ?? {}).length}人）
      </button>
      {dex && <Dex onClose={() => setDex(false)} />}
      <Seg
        small
        value={tab}
        onChange={setTab}
        options={[
          { v: 'ach', label: `🏆 実績 ${n}/${ACHIEVEMENTS.length}` },
          { v: 'hof', label: `🏛 殿堂 ${hof.length}人` },
        ]}
      />
      {tab === 'ach' ? (
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const g = got[a.id];
            const secret = a.hidden && !g;
            return (
              <div key={a.id} className={'ach' + (g ? ' on' : '')}>
                <b>{secret ? '？？？' : a.label}</b>
                <small>{secret ? '隠し実績' : a.desc}</small>
                {g && <small className="ach-season">シーズン{g.season}</small>}
              </div>
            );
          })}
        </div>
      ) : (
        <HallOfFame hof={hof} />
      )}
    </>
  );
}

function HallOfFame({ hof }: { hof: HallEntry[] }) {
  const { state, update } = useGame();
  const team = teamById(state, state.userTeamId);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const clubs = [...new Set(hof.map((e) => e.club ?? team.name))];
  const [club, setClub] = useState(clubs.includes(team.name) ? team.name : clubs[0] ?? team.name);
  if (hof.length === 0) return <p className="hint">まだ殿堂入りした選手はいません。長くクラブに貢献した名選手が引退すると、ここに名前が刻まれます。</p>;
  const list = hof.filter((e) => (e.club ?? team.name) === club);
  const xi = state.hofXI ?? [];
  const byKey = new Map(hof.map((e) => [hofKey(e), e]));
  const colors = (e?: HallEntry): [string, string] => e?.colors ?? [team.color, team.color2];

  return (
    <>
      {clubs.length > 1 && <Seg small scroll value={club} onChange={setClub} options={clubs.map((c) => ({ v: c, label: c }))} />}
      <div className="hof-grid">
        {list.map((e) => (
          <div key={hofKey(e)} className="hof-card">
            <Jersey color={colors(e)[0]} color2={colors(e)[1]} number={e.number ?? '★'} size={60} />
            <div className="grow">
              <div className="row gap">
                <PosTag pos={e.position} />
                <b>{e.name}</b>
              </div>
              <span className="chip accent">{e.note}</span>
              <small className="muted">
                {e.apps}試合 {e.goals}得点 · 最高総合値 {e.peak}
                <br />
                {e.nationality} · シーズン{e.season}に引退
              </small>
            </div>
          </div>
        ))}
      </div>

      <h3 className="section-title">歴代ベストイレブン</h3>
      <p className="hint">枠をタップして、殿堂入りした選手から選びましょう。</p>
      <div className="hof-pitch">
        {XI_SLOTS.map((s, i) => {
          const e = xi[i] ? byKey.get(xi[i]!) : undefined;
          return (
            <button key={i} className="hof-slot" style={{ left: `${s.x}%`, top: `${s.y}%` }} onClick={() => setPickSlot(i)}>
              <Jersey color={colors(e)[0]} color2={colors(e)[1]} number={e ? e.number ?? '★' : '+'} size={40} unknown={!e} />
              <small>{e ? e.name : s.pos}</small>
            </button>
          );
        })}
      </div>
      {pickSlot !== null && (
        <Sheet title={`${XI_SLOTS[pickSlot].pos} を選ぶ`} onClose={() => setPickSlot(null)}>
          <div className="list">
            {hof.map((e) => (
              <button
                key={hofKey(e)}
                className="card row gap hof-pick"
                onClick={() => {
                  update((d) => {
                    const next = [...(d.hofXI ?? Array(11).fill(null))];
                    for (let j = 0; j < next.length; j++) if (next[j] === hofKey(e)) next[j] = null;
                    next[pickSlot] = hofKey(e);
                    d.hofXI = next;
                  });
                  setPickSlot(null);
                }}
              >
                <PosTag pos={e.position} />
                <b className="grow">{e.name}</b>
                <small className="muted">最高 {e.peak}</small>
              </button>
            ))}
            {xi[pickSlot] && (
              <button
                className="btn ghost"
                onClick={() => {
                  update((d) => {
                    const next = [...(d.hofXI ?? Array(11).fill(null))];
                    next[pickSlot] = null;
                    d.hofXI = next;
                  });
                  setPickSlot(null);
                }}
              >
                この枠を空ける
              </button>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
