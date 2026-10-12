import { useState } from 'react';
import { Avatar, BEARD_LABEL, BROW_LABEL, FACE_LABEL, HAIR_COLOR_LABEL, HAIR_COLORS, HAIR_STYLE_LABEL, SKIN_LABEL, SKINS } from '../components/Avatar';
import { Sheet } from '../components/ui';
import { teamById } from '../game/season';
import type { Appearance } from '../game/types';
import { useGame } from '../store';

/** 顔（見た目）のエディット。能力値とは関係ないので、実在選手でも編集できる */
export function AppearanceEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, update, toast } = useGame();
  const p = state.players[id];
  const [a, setA] = useState<Appearance>({ beard: 0, face: 0, brow: 0, ...p.appearance });
  const team = p.teamId ? teamById(state, p.teamId) : undefined;
  return (
    <Sheet title="顔の編集" onClose={onClose}>
      <div className="face-preview">
        <Avatar a={a} color={team?.color ?? '#475569'} color2={team?.color2 ?? '#fff'} number={p.number} size={120} />
        <p className="pd-name">{p.name}</p>
      </div>
      <AppearanceFields a={a} onChange={setA} />
      <button
        className="btn primary big"
        onClick={() => {
          update((d) => {
            d.players[id].appearance = a;
          });
          toast('見た目を保存しました');
          onClose();
        }}
      >
        保存する
      </button>
    </Sheet>
  );
}

export function AppearanceFields({ a, onChange }: { a: Appearance; onChange: (a: Appearance) => void }) {
  return (
    <>
      <Picker label="肌" options={SKIN_LABEL} colors={SKINS} value={a.skin} onChange={(v) => onChange({ ...a, skin: v })} />
      <Picker label="顔の形" options={FACE_LABEL} value={a.face ?? 0} onChange={(v) => onChange({ ...a, face: v })} />
      <Picker label="髪型" options={HAIR_STYLE_LABEL} value={a.hairStyle} onChange={(v) => onChange({ ...a, hairStyle: v })} />
      <Picker label="髪色" options={HAIR_COLOR_LABEL} colors={HAIR_COLORS} value={a.hairColor} onChange={(v) => onChange({ ...a, hairColor: v })} />
      <Picker label="ひげ" options={BEARD_LABEL} value={a.beard ?? 0} onChange={(v) => onChange({ ...a, beard: v })} />
      <Picker label="眉" options={BROW_LABEL} value={a.brow ?? 0} onChange={(v) => onChange({ ...a, brow: v })} />
    </>
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
