import { useState } from 'react';
import { Jersey } from '../components/Jersey';
import { PosTag, Seg, Sheet } from '../components/ui';
import { DEX_CATS, type DexCat } from '../game/collection';
import { teamById } from '../game/season';
import { useGame } from '../store';

/** 選手図鑑：これまで自分のクラブに所属した選手 */
export function Dex({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const team = teamById(state, state.userTeamId);
  const entries = Object.values(state.dex ?? {});
  const [cat, setCat] = useState<DexCat>('normal');
  const of = (c: DexCat) => entries.filter((e) => e.cat === c);
  const def = DEX_CATS.find((c) => c.id === cat)!;
  const list = of(cat).sort((a, b) => b.peak - a.peak);
  const total = def.total?.();
  const missing = total ? Math.max(0, total - list.length) : 0;
  // まだ1人も出会っていない特別な枠は、名前も伏せる
  const label = (c: (typeof DEX_CATS)[number]) => (c.rare && of(c.id).length === 0 ? '？？？' : c.label);

  return (
    <Sheet title={`📖 選手図鑑（${entries.length}人）`} onClose={onClose} full>
      <Seg
        scroll
        small
        value={cat}
        onChange={setCat}
        options={DEX_CATS.map((c) => {
          const n = of(c.id).length;
          const t = c.total?.();
          return { v: c.id, label: `${label(c)} ${t ? `${n}/${t}` : n}${t && n >= t ? ' ★' : ''}` };
        })}
      />
      {list.length === 0 && missing === 0 && <p className="hint">{def.rare ? 'まだ出会っていません。' : 'まだ登録された選手はいません。'}</p>}
      <div className="dex-grid">
        {list.map((e) => (
          <div key={e.key} className={'dex-card' + (def.rare ? ' rare' : '')}>
            <Jersey color={e.colors?.[0] ?? team.color} color2={e.colors?.[1] ?? team.color2} number={e.number} size={52} />
            <b>{e.name}</b>
            <small>
              <PosTag pos={e.pos} /> 最高 {e.peak}
            </small>
            <small className="muted">
              {e.club} · S{e.first}〜
            </small>
          </div>
        ))}
        {Array.from({ length: missing }, (_, i) => (
          <div key={'q' + i} className="dex-card unknown">
            <Jersey color="" color2="" unknown size={52} />
            <b>？？？</b>
            <small className="muted">まだ出会っていない</small>
          </div>
        ))}
      </div>
      {total !== undefined && list.length >= total && <p className="hint center">★ コンプリート！</p>}
    </Sheet>
  );
}
