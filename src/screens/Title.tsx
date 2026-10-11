import { useRef, useState } from 'react';
import { Crest } from '../components/ui';
import { DEFAULT_TEAMS, newGame } from '../game/data';
import { deleteGame, importJson, loadGame, saveGame, SLOTS, slotInfo, type Slot } from '../game/save';
import type { GameState, Team } from '../game/types';

export function Title({ onStart }: { onStart: (s: GameState, slot: Slot) => void }) {
  const [mode, setMode] = useState<'menu' | 'new'>('menu');
  const [slot, setSlot] = useState<Slot>(1);
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState(DEFAULT_TEAMS[0].id);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const infos = SLOTS.map((s) => ({ s, info: slotInfo(s) }));

  if (mode === 'new') {
    return (
      <div className="title-screen">
        <h1 className="title-logo small">新しいキャリア</h1>
        <label className="field">
          <span>監督名</span>
          <input value={name} maxLength={16} placeholder="例：タナカ" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>セーブスロット</span>
          <div className="seg">
            {SLOTS.map((s) => (
              <button key={s} className={slot === s ? 'on' : ''} onClick={() => setSlot(s)}>
                {s}
                {slotInfo(s) ? '（上書き）' : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>率いるクラブ</span>
          <p className="hint">あなたのクラブは他より戦力が低い状態から始まります。移籍とポイント運用で強くしましょう。</p>
          <div className="team-pick">
            {DEFAULT_TEAMS.map((t) => (
              <button key={t.id} className={'team-pick-item' + (teamId === t.id ? ' on' : '')} onClick={() => setTeamId(t.id)}>
                <Crest team={{ ...t, lineup: [] } as Team} size={36} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="row gap">
          <button className="btn ghost" onClick={() => setMode('menu')}>
            戻る
          </button>
          <button
            className="btn primary grow"
            onClick={() => {
              if (slotInfo(slot) && !confirm(`スロット${slot}のデータを上書きします。よろしいですか？`)) return;
              const s = newGame(name.trim() || '監督', teamId);
              saveGame(slot, s);
              onStart(s, slot);
            }}
          >
            キャリア開始
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="title-screen">
      <div className="title-hero">
        <svg viewBox="0 0 120 80" width="160" aria-hidden>
          <rect x="4" y="4" width="112" height="72" rx="6" fill="#1f7a45" stroke="#e8fff0" strokeWidth="2" />
          <line x1="60" y1="4" x2="60" y2="76" stroke="#e8fff0" strokeWidth="1.5" />
          <circle cx="60" cy="40" r="12" fill="none" stroke="#e8fff0" strokeWidth="1.5" />
          <rect x="4" y="24" width="14" height="32" fill="none" stroke="#e8fff0" strokeWidth="1.5" />
          <rect x="102" y="24" width="14" height="32" fill="none" stroke="#e8fff0" strokeWidth="1.5" />
          <circle cx="60" cy="40" r="4" fill="#ffd34d" />
        </svg>
        <h1 className="title-logo">マイクラブ・マスターズ</h1>
        <p className="title-sub">弱小クラブを、あなたの手で頂点へ。</p>
      </div>

      <button className="btn primary big" onClick={() => setMode('new')}>
        ニューゲーム
      </button>

      <h3 className="section-title">つづきから</h3>
      <div className="slots">
        {infos.map(({ s, info }) => (
          <div key={s} className="slot">
            <button
              className="slot-main"
              disabled={!info}
              onClick={() => {
                const g = loadGame(s);
                if (g) onStart(g, s);
              }}
            >
              <b>スロット{s}</b>
              {info ? (
                <span>
                  {info.teamName} / {info.managerName}監督 / シーズン{info.season} 第{info.round + 1}節
                  <br />
                  <small>{new Date(info.updatedAt).toLocaleString('ja-JP')}</small>
                </span>
              ) : (
                <span className="muted">データなし</span>
              )}
            </button>
            {info && (
              <button
                className="icon-btn"
                aria-label="削除"
                onClick={() => {
                  if (confirm(`スロット${s}を削除しますか？`)) {
                    deleteGame(s);
                    force((x) => x + 1);
                  }
                }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="btn ghost" onClick={() => fileRef.current?.click()}>
        ファイルから読み込む
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const g = importJson(await f.text());
            const free = SLOTS.find((s) => !slotInfo(s)) ?? 1;
            if (slotInfo(free) && !confirm(`スロット${free}に上書きして読み込みます。よろしいですか？`)) return;
            saveGame(free, g);
            onStart(g, free);
          } catch (err) {
            alert((err as Error).message);
          } finally {
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
