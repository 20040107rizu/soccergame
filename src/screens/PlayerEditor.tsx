import { useState } from 'react';
import { Avatar, HAIR_COLOR_LABEL, HAIR_COLORS, HAIR_STYLE_LABEL, SKIN_LABEL, SKINS } from '../components/Avatar';
import { Heatmap } from '../components/Heatmap';
import { Ovr, Seg, Sheet, statColor } from '../components/ui';
import { generatePlayer } from '../game/data';
import { fairSalary } from '../game/economy';
import { repairLineup, squadOf } from '../game/lineup';
import { teamById } from '../game/season';
import { GK_KEYS, overallFor, SKILLS, STAT_GROUPS, STAT_KEYS, STAT_LABEL, STYLES } from '../game/stats';
import { MIN_SQUAD } from '../game/transfer';
import { POSITIONS, type GrowthType, type Player, type Position, type StatKey } from '../game/types';
import { useGame } from '../store';

const MAX_SKILLS = 12;

/** オリジナルチーム専用の選手エディット（名前・適性・能力値・スキルまで全て） */
export function PlayerEditor({ id, onClose }: { id: string | 'new'; onClose: () => void }) {
  const { state, update, toast } = useGame();
  const team = teamById(state, state.userTeamId);
  const isNew = id === 'new';
  const [p, setP] = useState<Player>(() => {
    if (!isNew) return structuredClone(state.players[id]);
    const used = new Set(squadOf(state, team.id).map((x) => x.number));
    let num = 2;
    while (used.has(num)) num++;
    const np = generatePlayer({ position: 'CF', level: 70, age: 20, teamId: team.id, number: num, custom: true });
    np.name = '';
    np.contractYears = 3;
    return np;
  });
  const [tab, setTab] = useState<'basic' | 'stats' | 'skills'>('basic');
  const [mass, setMass] = useState(0);

  if (!team.original || (!isNew && !state.players[id]?.custom)) {
    return (
      <Sheet title="エディット" onClose={onClose}>
        <p>この選手は編集できません。</p>
      </Sheet>
    );
  }

  const set = <K extends keyof Player>(k: K, v: Player[K]) => setP((x) => ({ ...x, [k]: v }));
  const setStat = (k: StatKey, v: number) => setP((x) => ({ ...x, stats: { ...x.stats, [k]: Math.max(35, Math.min(99, v)) } }));
  const ovr = overallFor(p.stats, p.position);

  const setMain = (pos: Position) =>
    setP((x) => {
      const apt = { ...x.aptitudes };
      delete apt[x.position];
      apt[pos] = 3;
      return { ...x, position: pos, aptitudes: apt, style: STYLES[x.style]?.pos.includes(pos) ? x.style : Object.keys(STYLES).find((s) => STYLES[s].pos.includes(pos)) ?? x.style };
    });

  const cycleApt = (pos: Position) =>
    setP((x) => {
      if (pos === x.position) return x;
      const apt = { ...x.aptitudes };
      const cur = apt[pos] ?? 0;
      const next = cur === 0 ? 2 : cur === 2 ? 1 : 0;
      if (next === 0) delete apt[pos];
      else apt[pos] = next as 1 | 2;
      return { ...x, aptitudes: apt };
    });

  const save = () => {
    if (!p.name.trim()) {
      toast('名前を入力してください');
      setTab('basic');
      return;
    }
    update((d) => {
      const np: Player = { ...p, name: p.name.trim(), custom: true };
      np.potential = Math.max(np.potential, overallFor(np.stats, np.position));
      np.salary = isNew ? fairSalary(np) : np.salary;
      d.players[np.id] = np;
      repairLineup(d, teamById(d, d.userTeamId));
    });
    toast(isNew ? '選手を作成しました' : '保存しました');
    onClose();
  };

  const remove = () => {
    if (squadOf(state, team.id).length <= MIN_SQUAD) return toast(`最低${MIN_SQUAD}人は必要です`);
    if (!confirm(`${p.name || 'この選手'}を削除しますか？`)) return;
    update((d) => {
      delete d.players[p.id];
      repairLineup(d, teamById(d, d.userTeamId));
    });
    onClose();
  };

  const statKeys = STAT_KEYS.filter((k) => p.position === 'GK' || !GK_KEYS.includes(k));

  return (
    <Sheet title={isNew ? '選手作成' : '選手エディット'} onClose={onClose} full>
      <div className="editor-preview">
        <Avatar a={p.appearance ?? { skin: 1, hairStyle: 1, hairColor: 0 }} color={team.color} color2={team.color2} number={p.number} size={84} />
        <div className="grow">
          <div className="pd-name">{p.name || '（名前未入力）'}</div>
          <div className="row gap">
            {p.position} 総合 <Ovr v={ovr} />
          </div>
        </div>
      </div>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { v: 'basic', label: '基本・適性' },
          { v: 'stats', label: '能力値' },
          { v: 'skills', label: 'スキル' },
        ]}
      />

      {tab === 'basic' && (
        <>
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
              <input type="number" min={15} max={42} value={p.age} onChange={(e) => set('age', clampInt(e.target.value, 15, 42))} />
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
              <span>メインポジション</span>
              <select value={p.position} onChange={(e) => setMain(e.target.value as Position)}>
                {POSITIONS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>プレースタイル</span>
              <select value={p.style} onChange={(e) => set('style', e.target.value)}>
                {Object.entries(STYLES)
                  .filter(([, s]) => s.pos.includes(p.position))
                  .map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>成長タイプ</span>
              <select value={p.growth} onChange={(e) => set('growth', e.target.value as GrowthType)}>
                <option value="early">早熟</option>
                <option value="normal">標準</option>
                <option value="late">晩成</option>
              </select>
            </label>
            <label className="field">
              <span>伸びしろ（到達総合値）{p.potential}</span>
              <input type="range" min={45} max={99} value={p.potential} onChange={(e) => set('potential', Number(e.target.value))} />
            </label>
          </div>
          <div className="field">
            <span>ポジション適性（タップで 適性 → 可 → なし）</span>
            <Heatmap aptitudes={p.aptitudes} main={p.position} player={p} onTap={cycleApt} />
          </div>
          <h4>特性</h4>
          <Level label="逆足頻度" value={p.traits.weakFootUse} max={4} onChange={(v) => set('traits', { ...p.traits, weakFootUse: v })} />
          <Level label="逆足精度" value={p.traits.weakFootAcc} max={4} onChange={(v) => set('traits', { ...p.traits, weakFootAcc: v })} />
          <Level label="コンディション安定度" value={p.traits.form} max={8} onChange={(v) => set('traits', { ...p.traits, form: v })} />
          <Level label="ケガ耐性" value={p.traits.injuryRes} max={3} onChange={(v) => set('traits', { ...p.traits, injuryRes: v })} />
          <h4>見た目</h4>
          <Picker label="肌" options={SKIN_LABEL} colors={SKINS} value={p.appearance?.skin ?? 0} onChange={(v) => set('appearance', { ...(p.appearance ?? { skin: 0, hairStyle: 1, hairColor: 0 }), skin: v })} />
          <Picker label="髪型" options={HAIR_STYLE_LABEL} value={p.appearance?.hairStyle ?? 1} onChange={(v) => set('appearance', { ...(p.appearance ?? { skin: 0, hairStyle: 1, hairColor: 0 }), hairStyle: v })} />
          <Picker label="髪色" options={HAIR_COLOR_LABEL} colors={HAIR_COLORS} value={p.appearance?.hairColor ?? 0} onChange={(v) => set('appearance', { ...(p.appearance ?? { skin: 0, hairStyle: 1, hairColor: 0 }), hairColor: v })} />
        </>
      )}

      {tab === 'stats' && (
        <>
          <div className="card">
            <span className="small muted">全能力を一括で上げ下げ</span>
            <div className="row gap">
              <input
                type="range"
                className="grow"
                min={-20}
                max={20}
                value={mass}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const diff = v - mass;
                  setMass(v);
                  setP((x) => {
                    const s = { ...x.stats };
                    for (const k of statKeys) s[k] = Math.max(35, Math.min(99, s[k] + diff));
                    return { ...x, stats: s };
                  });
                }}
              />
              <b>{mass > 0 ? `+${mass}` : mass}</b>
            </div>
          </div>
          {STAT_GROUPS.filter((g) => g.label !== 'GK' || p.position === 'GK').map((g) => (
            <div key={g.label}>
              <h4>{g.label}</h4>
              {g.keys.map((k) => (
                <div key={k} className="slider-row">
                  <span>{STAT_LABEL[k]}</span>
                  <button className="icon-btn" onClick={() => setStat(k, p.stats[k] - 1)}>
                    −
                  </button>
                  <input type="range" min={35} max={99} value={p.stats[k]} onChange={(e) => setStat(k, Number(e.target.value))} />
                  <button className="icon-btn" onClick={() => setStat(k, p.stats[k] + 1)}>
                    ＋
                  </button>
                  <b style={{ color: statColor(p.stats[k]) }}>{p.stats[k]}</b>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {tab === 'skills' && (
        <>
          <p className="hint">
            特殊スキルは最大{MAX_SKILLS}個まで（{p.skills.length}/{MAX_SKILLS}）。試合中のシュートやパス、守備に効果があります。
          </p>
          {(['dribble', 'shoot', 'pass', 'defense', 'gk', 'other'] as const).map((cat) => (
            <div key={cat}>
              <h4>{{ dribble: 'ドリブル', shoot: 'シュート', pass: 'パス', defense: '守備', gk: 'GK', other: 'その他' }[cat]}</h4>
              <div className="skills">
                {SKILLS.filter((s) => s.cat === cat).map((s) => {
                  const on = p.skills.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      className={'skill toggle' + (on ? ' on' : '')}
                      onClick={() => {
                        if (!on && p.skills.length >= MAX_SKILLS) return toast(`スキルは${MAX_SKILLS}個までです`);
                        set('skills', on ? p.skills.filter((x) => x !== s.id) : [...p.skills, s.id]);
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="pd-actions sticky">
        <button className="btn primary grow" onClick={save}>
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

function Level({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="level-row">
      <span>{label}</span>
      <div className="dots">
        {Array.from({ length: max }, (_, i) => (
          <button key={i} className={'dot' + (i < value ? ' on' : '')} onClick={() => onChange(i + 1)} aria-label={`${i + 1}`} />
        ))}
      </div>
      <b>{value}</b>
    </div>
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
