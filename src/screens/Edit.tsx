import { useRef, useState } from 'react';
import { Crest, PlayerRow } from '../components/ui';
import { overall } from '../game/rating';
import { exportRosterCsv, importRosterCsv } from '../game/roster';
import { exportJson } from '../game/save';
import { fixUserLineup } from '../game/season';
import { POSITIONS, type Team } from '../game/types';
import { useGame } from '../store';

export function Edit() {
  const { state, update, editPlayer, toast, quit, slot } = useGame();
  const [tab, setTab] = useState<'players' | 'clubs' | 'data'>('players');
  const [teamId, setTeamId] = useState<string>(state.userTeamId);
  const [clubEdit, setClubEdit] = useState<Team | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const teams = Object.fromEntries(state.teams.map((t) => [t.id, t]));

  const players = Object.values(state.players)
    .filter((p) => (teamId === 'free' ? !p.teamId : p.teamId === teamId))
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || overall(b) - overall(a));

  return (
    <div className="screen">
      <h2 className="screen-title">エディット</h2>
      <div className="seg">
        <button className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>
          選手
        </button>
        <button className={tab === 'clubs' ? 'on' : ''} onClick={() => setTab('clubs')}>
          クラブ
        </button>
        <button className={tab === 'data' ? 'on' : ''} onClick={() => setTab('data')}>
          データ
        </button>
      </div>

      {tab === 'players' && (
        <>
          <div className="row gap">
            <select className="grow" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="free">フリー選手</option>
            </select>
            <button className="btn primary small" onClick={() => editPlayer('new', teamId === 'free' ? null : teamId)}>
              ＋ 選手作成
            </button>
          </div>
          <div className="list">
            {players.map((p) => (
              <PlayerRow key={p.id} p={p} team={p.teamId ? teams[p.teamId] : undefined} onClick={() => editPlayer(p.id)} />
            ))}
          </div>
        </>
      )}

      {tab === 'clubs' && (
        <div className="list">
          {state.teams.map((t) => (
            <button key={t.id} className="player-row" onClick={() => setClubEdit({ ...t })}>
              <Crest team={t} size={40} />
              <div className="player-row-main">
                <div className="player-row-name">{t.name}</div>
                <div className="player-row-sub">
                  {t.short} · {t.formation}
                </div>
              </div>
              <span className="muted">編集 ›</span>
            </button>
          ))}
          {clubEdit && (
            <div className="card">
              <div className="row gap">
                <Crest team={clubEdit} size={48} />
                <b>{clubEdit.name}</b>
              </div>
              <label className="field">
                <span>クラブ名</span>
                <input value={clubEdit.name} maxLength={24} onChange={(e) => setClubEdit({ ...clubEdit, name: e.target.value })} />
              </label>
              <label className="field">
                <span>略称（3文字）</span>
                <input value={clubEdit.short} maxLength={4} onChange={(e) => setClubEdit({ ...clubEdit, short: e.target.value.toUpperCase() })} />
              </label>
              <div className="grid2">
                <label className="field">
                  <span>メインカラー</span>
                  <input type="color" value={clubEdit.color} onChange={(e) => setClubEdit({ ...clubEdit, color: e.target.value })} />
                </label>
                <label className="field">
                  <span>サブカラー</span>
                  <input type="color" value={clubEdit.color2} onChange={(e) => setClubEdit({ ...clubEdit, color2: e.target.value })} />
                </label>
              </div>
              <div className="row gap">
                <button className="btn ghost" onClick={() => setClubEdit(null)}>
                  キャンセル
                </button>
                <button
                  className="btn primary grow"
                  onClick={() => {
                    if (!clubEdit.name.trim() || !clubEdit.short.trim()) return toast('名前と略称を入力してください');
                    update((d) => {
                      const t = d.teams.find((x) => x.id === clubEdit.id)!;
                      t.name = clubEdit.name.trim();
                      t.short = clubEdit.short.trim();
                      t.color = clubEdit.color;
                      t.color2 = clubEdit.color2;
                    });
                    setClubEdit(null);
                    toast('保存しました');
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'data' && (
        <div className="list">
          <div className="card">
            <h4>名簿の一括編集（CSV）</h4>
            <p className="hint">
              全選手の名前・ポジション・背番号・年齢・国籍を CSV で書き出し、スプレッドシートで編集して読み込めます。好きな選手の名前に一気に置き換えたいときに便利です（id 列は消さないでください）。
            </p>
            <div className="row gap wrap">
              <button className="btn" onClick={() => download(`roster-s${state.season}.csv`, '﻿' + exportRosterCsv(state), 'text/csv')}>
                CSV書き出し
              </button>
              <button className="btn" onClick={() => csvRef.current?.click()}>
                CSV読み込み
              </button>
            </div>
            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                try {
                  const n = update((d) => {
                    const c = importRosterCsv(d, text);
                    fixUserLineup(d);
                    return c;
                  });
                  toast(`${n}人を更新しました`);
                } catch (err) {
                  toast((err as Error).message);
                } finally {
                  e.target.value = '';
                }
              }}
            />
          </div>
          <div className="card">
            <h4>セーブデータ</h4>
            <p className="hint">
              スロット{slot}に自動セーブされています。機種変更やバックアップには、ファイルに書き出してタイトル画面から読み込んでください。
            </p>
            <div className="row gap wrap">
              <button className="btn" onClick={() => download(`myclub-slot${slot}-s${state.season}.json`, exportJson(state), 'application/json')}>
                ファイルに書き出す
              </button>
              <button className="btn ghost" onClick={quit}>
                タイトルへ戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
