import { useState } from 'react';
import { Avatar, HAIR_COLOR_LABEL, HAIR_COLORS, HAIR_STYLE_LABEL, SKIN_LABEL, SKINS } from '../components/Avatar';
import { Ovr, Sheet } from '../components/ui';
import { generatePlayer } from '../game/data';
import { autoLineup, fairSalary, overallFor } from '../game/rating';
import { fixUserLineup, squadOf } from '../game/season';
import { MIN_SQUAD } from '../game/transfer';
import { GROWTH_LABEL, POSITIONS, STAT_KEYS, STAT_LABEL, type GameState, type GrowthType, type Player } from '../game/types';
import { useGame } from '../store';

function refreshLineups(d: GameState, teamIds: (string | null)[]) {
  for (const id of teamIds) {
    if (!id) continue;
    if (id === d.userTeamId) fixUserLineup(d);
    else {
      const t = d.teams.find((x) => x.id === id);
      if (t) t.lineup = autoLineup(squadOf(d, id), t.formation);
    }
  }
}

export function PlayerEditor({ id, teamId, onClose }: { id: string | 'new'; teamId?: string | null; onClose: () => void }) {
  const { state, update, toast } = useGame();
  const isNew = id === 'new';
  const [p, setP] = useState<Player>(() => {
    if (!isNew) return structuredClone(state.players[id]);
    const np = generatePlayer({ position: 'CF', level: 65, age: 20, teamId: teamId ?? state.userTeamId });
    np.name = '';
    np.custom = true;
    return np;
  });
  const team = p.teamId ? state.teams.find((t) => t.id === p.teamId) : undefined;
  const set = <K extends keyof Player>(k: K, v: Player[K]) => setP((x) => ({ ...x, [k]: v }));
  const ovr = overallFor(p.stats, p.position);

  const save = () => {
    if (!p.name.trim()) {
      toast('名前を入力してください');
      return;
    }
    update((d) => {
      const prev = d.players[p.id];
      const np: Player = { ...p, name: p.name.trim(), custom: true };
      np.potential = Math.max(np.potential, overallFor(np.stats, np.position));
      if (isNew) np.salary = fairSalary(np);
      d.players[np.id] = np;
      refreshLineups(d, [prev?.teamId ?? null, np.teamId]);
    });
    toast(isNew ? '選手を作成しました' : '保存しました');
    onClose();
  };

  const remove = () => {
    if (p.teamId === state.userTeamId && squadOf(state, state.userTeamId).length <= MIN_SQUAD) {
      toast(`自クラブは最低${MIN_SQUAD}人必要です`);
      return;
    }
    if (!confirm(`${p.name}を削除しますか？この操作は取り消せません。`)) return;
    update((d) => {
      delete d.players[p.id];
      refreshLineups(d, [p.teamId]);
    });
    toast('削除しました');
    onClose();
  };

  return (
    <Sheet title={isNew ? '選手作成' : '選手エディット'} onClose={onClose}>
      <div className="editor-preview">
        <Avatar a={p.appearance} color={team?.color ?? '#475569'} color2={team?.color2 ?? '#fff'} number={p.number} size={96} />
        <div>
          <div className="pd-name">{p.name || '（名前未入力）'}</div>
          <div className="row gap">
            {p.position} 総合 <Ovr v={ovr} />
          </div>
        </div>
      </div>

      <h4>基本情報</h4>
      <label className="field">
        <span>名前</span>
        <input value={p.name} maxLength={24} placeholder="選手名" onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>国籍</span>
          <input value={p.nationality} maxLength={12} onChange={(e) => set('nationality', e.target.value)} />
        </label>
        <label className="field">
          <span>年齢</span>
          <input type="number" min={15} max={45} value={p.age} onChange={(e) => set('age', clampInt(e.target.value, 15, 45))} />
        </label>
        <label className="field">
          <span>背番号</span>
          <input type="number" min={1} max={99} value={p.number} onChange={(e) => set('number', clampInt(e.target.value, 1, 99))} />
        </label>
        <label className="field">
          <span>利き足</span>
          <select value={p.foot} onChange={(e) => set('foot', e.target.value as 'R' | 'L')}>
            <option value="R">右</option>
            <option value="L">左</option>
          </select>
        </label>
        <label className="field">
          <span>ポジション</span>
          <select value={p.position} onChange={(e) => set('position', e.target.value as Player['position'])}>
            {POSITIONS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>成長タイプ</span>
          <select value={p.growth} onChange={(e) => set('growth', e.target.value as GrowthType)}>
            {(Object.keys(GROWTH_LABEL) as GrowthType[]).map((g) => (
              <option key={g} value={g}>
                {GROWTH_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>所属</span>
        <select value={p.teamId ?? ''} onChange={(e) => set('teamId', e.target.value || null)}>
          {state.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="">フリー（移籍市場）</option>
        </select>
      </label>

      <h4>見た目</h4>
      <Picker label="肌" options={SKIN_LABEL} colors={SKINS} value={p.appearance.skin} onChange={(v) => set('appearance', { ...p.appearance, skin: v })} />
      <Picker label="髪型" options={HAIR_STYLE_LABEL} value={p.appearance.hairStyle} onChange={(v) => set('appearance', { ...p.appearance, hairStyle: v })} />
      <Picker label="髪色" options={HAIR_COLOR_LABEL} colors={HAIR_COLORS} value={p.appearance.hairColor} onChange={(v) => set('appearance', { ...p.appearance, hairColor: v })} />

      <h4>能力値</h4>
      {STAT_KEYS.map((k) => (
        <div key={k} className="slider-row">
          <span>{STAT_LABEL[k]}</span>
          <button className="icon-btn" onClick={() => set('stats', { ...p.stats, [k]: Math.max(30, p.stats[k] - 1) })}>
            −
          </button>
          <input type="range" min={30} max={99} value={p.stats[k]} onChange={(e) => set('stats', { ...p.stats, [k]: Number(e.target.value) })} />
          <button className="icon-btn" onClick={() => set('stats', { ...p.stats, [k]: Math.min(99, p.stats[k] + 1) })}>
            ＋
          </button>
          <b>{p.stats[k]}</b>
        </div>
      ))}
      <div className="slider-row">
        <span>伸びしろ</span>
        <span />
        <input type="range" min={40} max={99} value={p.potential} onChange={(e) => set('potential', Number(e.target.value))} />
        <span />
        <b>{p.potential}</b>
      </div>
      <p className="hint">伸びしろ＝成長で到達できる総合値の目安。年齢と成長タイプに応じて伸びます。</p>

      <div className="pd-actions sticky">
        <button className="btn primary" onClick={save}>
          {isNew ? '作成する' : '保存する'}
        </button>
        {!isNew && (
          <button className="btn danger" onClick={remove}>
            削除
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Picker(props: { label: string; options: string[]; colors?: string[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <span>{props.label}</span>
      <div className="seg scroll small">
        {props.options.map((o, i) => (
          <button key={o} className={props.value === i ? 'on' : ''} onClick={() => props.onChange(i)}>
            {props.colors && <i className="swatch" style={{ background: props.colors[i] }} />}
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function clampInt(v: string, min: number, max: number) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? min : Math.max(min, Math.min(max, n));
}
