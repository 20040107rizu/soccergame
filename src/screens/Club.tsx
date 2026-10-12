import { useState } from 'react';
import { Crest, PlayerRow, RepStars } from '../components/ui';
import { fmtMoney } from '../game/economy';
import { squadOf } from '../game/lineup';
import { POSITIONS } from '../game/types';
import { teamById, userPayroll } from '../game/season';
import { MAX_SQUAD } from '../game/transfer';
import { useGame } from '../store';
import { Records } from './Records';
import { ManagerCard } from './ManagerCard';
import { Facilities } from './Facilities';
import { Cosmetics, MyBadges } from './Cosmetics';
import { Feedback } from './Feedback';
import { APP_VERSION } from '../version';

export function Club() {
  const { state, update, editPlayer, openPlayer, toast, quit, slot } = useGame();
  const team = teamById(state, state.userTeamId);
  const [info, setInfo] = useState({ name: team.name, short: team.short, color: team.color, color2: team.color2 });
  const squad = squadOf(state, team.id).sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));
  const { total, cap } = userPayroll(state);
  const [fb, setFb] = useState(false);
  const [manager, setManager] = useState(state.managerName);

  return (
    <div className="screen">
      <div className="club-card" style={{ background: `linear-gradient(135deg, ${team.color}, #0b1410 85%)` }}>
        <Crest team={team} size={52} />
        <div className="grow">
          <div className="club-name">{team.name}</div>
          <div className="club-sub">
            クラブの格 <RepStars rep={team.rep} /> ({team.rep})
          </div>
          <div className="club-sub">
            年俸 {fmtMoney(total)} / 上限 {fmtMoney(cap)}
          </div>
        </div>
      </div>

      <div className="card">
        <label className="field">
          <span>監督名（フレンドランキングの表示名にもなります）</span>
          <div className="row gap">
            <input className="grow" value={manager} maxLength={16} placeholder="例：タナカ" onChange={(e) => setManager(e.target.value)} />
            <button
              className="btn primary"
              disabled={!manager.trim() || manager.trim() === state.managerName}
              onClick={() => {
                update((d) => {
                  d.managerName = manager.trim();
                });
                toast('監督名を変更しました');
              }}
            >
              変更
            </button>
          </div>
        </label>
      </div>

      <ManagerCard />

      <MyBadges />

      <Facilities />

      <Cosmetics />

      <button className="btn feedback-btn" onClick={() => setFb(true)}>
        📝 感想・不具合を送る
      </button>
      {fb && <Feedback onClose={() => setFb(false)} />}

      <Records />

      {team.original ? (
        <>
          <h3 className="section-title">エディット：選手（{squad.length}/{MAX_SQUAD}）</h3>
          <p className="hint">オリジナルチームの選手は、名前・ポジション適性・能力値・特殊スキルまで自由に編集できます。</p>
          <button className="btn primary" disabled={squad.length >= MAX_SQUAD} onClick={() => editPlayer('new')}>
            ＋ 新しい選手を作成
          </button>
          <div className="list">
            {squad.map((p) => (
              <PlayerRow key={p.id} p={p} team={team} onClick={() => (p.custom ? editPlayer(p.id) : openPlayer(p.id))} sub={p.custom ? `${p.age}歳 · ${p.nationality} · タップで編集` : `${p.age}歳 · 移籍で獲得（編集不可）`} />
            ))}
          </div>

          <h3 className="section-title">エディット：クラブ</h3>
          <div className="card">
            <label className="field">
              <span>クラブ名</span>
              <input value={info.name} maxLength={20} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
            </label>
            <div className="grid2">
              <label className="field">
                <span>略称</span>
                <input value={info.short} maxLength={4} onChange={(e) => setInfo({ ...info, short: e.target.value.toUpperCase() })} />
              </label>
              <div className="grid2">
                <label className="field">
                  <span>メイン</span>
                  <input type="color" value={info.color} onChange={(e) => setInfo({ ...info, color: e.target.value })} />
                </label>
                <label className="field">
                  <span>サブ</span>
                  <input type="color" value={info.color2} onChange={(e) => setInfo({ ...info, color2: e.target.value })} />
                </label>
              </div>
            </div>
            <button
              className="btn primary"
              onClick={() => {
                if (!info.name.trim() || !info.short.trim()) return toast('名前と略称を入力してください');
                update((d) => {
                  const t = teamById(d, d.userTeamId);
                  t.name = info.name.trim();
                  t.en = info.name.trim();
                  t.short = info.short.trim();
                  t.color = info.color;
                  t.color2 = info.color2;
                });
                toast('保存しました');
              }}
            >
              クラブ情報を保存
            </button>
          </div>
        </>
      ) : (
        <p className="hint">実在クラブの選手の能力値は編集できません。オリジナルチームでキャリアを始めると、全選手を自由に作成できます。</p>
      )}

      <h3 className="section-title">データ</h3>
      <div className="card">
        <p className="hint">💾 スロット{slot}に自動で保存されています（アプリの中に保存。操作するたびに保存されます）。</p>
        <div className="row gap wrap">
          <button className="btn ghost" onClick={quit}>
            タイトルへ戻る
          </button>
        </div>
        <p className="muted small">バージョン {APP_VERSION}</p>
      </div>
    </div>
  );
}
