import { useMemo, useRef, useState } from 'react';
import { Crest, RepStars } from '../components/ui';
import { PL_SEEDS, playerFromSeed, teamFromSeed } from '../game/data';
import { fmtMoney } from '../game/economy';
import { deleteGame, importJson, loadGame, saveGame, SLOTS, slotInfo, type Slot } from '../game/save';
import { newGame } from '../game/season';
import { overall } from '../game/stats';
import type { GameState } from '../game/types';

type Mode = 'menu' | 'club' | 'original';

export function Title({ onStart }: { onStart: (s: GameState, slot: Slot, firstRun?: 'original') => void }) {
  const [mode, setMode] = useState<Mode>('menu');
  const [slot, setSlot] = useState<Slot>(1);
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('ars');
  const [orig, setOrig] = useState({ name: 'FCマスターズ', short: 'FCM', color: '#0f766e', color2: '#fde047', replaces: 'hul' });
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const clubs = useMemo(
    () =>
      [...PL_SEEDS]
        .map((s) => {
          const ps = s.players.map((l) => playerFromSeed(l, s.id)).map(overall).sort((a, b) => b - a);
          const top = ps.slice(0, 11);
          return { seed: s, team: teamFromSeed(s), avg: Math.round(top.reduce((a, b) => a + b, 0) / top.length) };
        })
        .sort((a, b) => b.avg - a.avg),
    [],
  );

  const start = (original?: boolean) => {
    if (slotInfo(slot) && !confirm(`スロット${slot}のデータを上書きします。よろしいですか？`)) return;
    setBusy(true);
    setTimeout(() => {
      const s = newGame(name.trim() || 'ゲスト', teamId, original ? { ...orig, name: orig.name.trim() || 'FCマスターズ', short: (orig.short.trim() || 'FCM').slice(0, 4) } : undefined);
      saveGame(slot, s);
      onStart(s, slot, original ? 'original' : undefined);
    }, 30);
  };

  if (mode === 'club' || mode === 'original') {
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

        {mode === 'club' ? (
          <>
            <div className="field">
              <span>ベースチームを選ぶ（プレミアリーグ 2026-27）</span>
            </div>
            <div className="club-grid">
              {clubs.map(({ seed, team, avg }) => (
                <button key={seed.id} className={'club-pick' + (teamId === seed.id ? ' on' : '')} onClick={() => setTeamId(seed.id)}>
                  <Crest team={team} size={34} />
                  <div className="club-pick-main">
                    <b>{seed.name}</b>
                    <small>
                      <RepStars rep={seed.rep} /> 戦力{avg} · 資金{fmtMoney(seed.budget)}
                    </small>
                  </div>
                </button>
              ))}
              <button className="club-pick original" onClick={() => setMode('original')}>
                <span className="orig-icon">＋</span>
                <div className="club-pick-main">
                  <b>オリジナルチーム</b>
                  <small>選手を全員自分で作成（21チーム目）</small>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="row gap">
                <Crest team={{ ...teamFromSeed(PL_SEEDS[0]), color: orig.color, color2: orig.color2, short: orig.short || 'FCM' }} size={56} />
                <div>
                  <b>{orig.name || 'クラブ名'}</b>
                  <p className="hint">オリジナルチームは選手の名前・能力値・特殊スキルまで全て自由に作れます。</p>
                </div>
              </div>
              <label className="field">
                <span>クラブ名</span>
                <input value={orig.name} maxLength={20} onChange={(e) => setOrig({ ...orig, name: e.target.value })} />
              </label>
              <div className="grid2">
                <label className="field">
                  <span>略称（3〜4文字）</span>
                  <input value={orig.short} maxLength={4} onChange={(e) => setOrig({ ...orig, short: e.target.value.toUpperCase() })} />
                </label>
                <div className="grid2">
                  <label className="field">
                    <span>メイン</span>
                    <input type="color" value={orig.color} onChange={(e) => setOrig({ ...orig, color: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>サブ</span>
                    <input type="color" value={orig.color2} onChange={(e) => setOrig({ ...orig, color2: e.target.value })} />
                  </label>
                </div>
              </div>
              <label className="field">
                <span>入れ替えるクラブ（このクラブの代わりにプレミアリーグへ参戦）</span>
                <select value={orig.replaces} onChange={(e) => setOrig({ ...orig, replaces: e.target.value })}>
                  {PL_SEEDS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint">開始後、「クラブ」タブのエディットで全選手を作り込めます（最初は仮の選手が 22 人入っています）。</p>
            </div>
          </>
        )}

        <div className="row gap sticky-bottom">
          <button className="btn ghost" onClick={() => setMode(mode === 'original' ? 'club' : 'menu')}>
            戻る
          </button>
          <button className="btn primary grow" disabled={busy} onClick={() => start(mode === 'original')}>
            {busy ? '準備中…' : mode === 'original' ? 'オリジナルチームで開始' : `${clubs.find((c) => c.seed.id === teamId)?.seed.name}で開始`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="title-screen">
      <div className="title-hero">
        <svg viewBox="0 0 120 80" width="150" aria-hidden>
          <rect x="4" y="4" width="112" height="72" rx="6" fill="#1f7a45" stroke="#e8fff0" strokeWidth="2" />
          <line x1="60" y1="4" x2="60" y2="76" stroke="#e8fff0" strokeWidth="1.5" />
          <circle cx="60" cy="40" r="12" fill="none" stroke="#e8fff0" strokeWidth="1.5" />
          <rect x="4" y="24" width="14" height="32" fill="none" stroke="#e8fff0" strokeWidth="1.5" />
          <rect x="102" y="24" width="14" height="32" fill="none" stroke="#e8fff0" strokeWidth="1.5" />
          <circle cx="60" cy="40" r="4" fill="#ffd34d" />
        </svg>
        <h1 className="title-logo">マスターリーグ</h1>
        <p className="title-sub">PREMIER LEAGUE 2026-27</p>
      </div>

      <button className="btn primary big" onClick={() => setMode('club')}>
        ニューゲーム
      </button>

      <h3 className="section-title">つづきから</h3>
      <div className="slots">
        {SLOTS.map((s) => {
          const info = slotInfo(s);
          return (
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
                    {info.teamName} / {info.managerName}監督 / シーズン{info.season}
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
          );
        })}
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
      <p className="hint center">
        選手データは 2026-27 シーズン開幕時点の所属をもとにしています。能力値は推定値です。
      </p>
    </div>
  );
}
