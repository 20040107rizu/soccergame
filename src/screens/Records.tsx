import { useState } from 'react';
import { PosTag, Seg } from '../components/ui';
import { ACHIEVEMENTS } from '../game/events';
import { useGame } from '../store';

/** クラブの記録：実績（トロフィー）と殿堂 */
export function Records() {
  const { state } = useGame();
  const [tab, setTab] = useState<'ach' | 'hof'>('ach');
  const got = state.achievements ?? {};
  const hof = state.hallOfFame ?? [];
  const n = Object.keys(got).length;
  return (
    <>
      <h3 className="section-title">クラブの記録</h3>
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
      ) : hof.length === 0 ? (
        <p className="hint">まだ殿堂入りした選手はいません。長くクラブに貢献した名選手が引退すると、ここに名前が刻まれます。</p>
      ) : (
        <div className="list">
          {hof.map((e) => (
            <div key={e.name + e.season} className="card hof">
              <div className="row gap">
                <PosTag pos={e.position} />
                <b className="grow">{e.name}</b>
                <span className="chip accent">{e.note}</span>
              </div>
              <small className="muted">
                {e.nationality} · {e.apps}試合 {e.goals}得点 · 最高総合値 {e.peak} · シーズン{e.season}に引退
              </small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
