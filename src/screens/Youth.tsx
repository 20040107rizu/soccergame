import { useState } from 'react';
import { GrowthAlbum } from '../components/GrowthAlbum';
import { Ovr, PlayerIcon, PosTag, Seg, Sheet, statColor } from '../components/ui';
import { facilityLevel } from '../game/club';
import { fmtMoney } from '../game/economy';
import { squadOf } from '../game/lineup';
import { teamById } from '../game/season';
import { overall } from '../game/stats';
import { MAX_SQUAD } from '../game/transfer';
import type { Player, Position, YouthFocus } from '../game/types';
import { POSITIONS } from '../game/types';
import { consultAgent, CONSULT_COST, convertKid, FOCUS_KEYS, FOCUS_OPTIONS, intakeCount, lastYearGain, mentorCandidates, promoteKid, releaseKid, setFocus, setMentor, youthKids, YOUTH_MAX } from '../game/youth';
import { useGame } from '../store';

const GROUP_LABEL: Record<keyof typeof FOCUS_KEYS, string> = {
  shoot: 'シュート',
  pass: 'パス',
  dribble: 'ドリブル',
  defense: '守備',
  physical: 'フィジカル',
  gk: 'GK',
};

/** ユースチーム：15歳の子を預かって、一流のプロに育てる */
export function Youth({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const kids = youthKids(state);
  const squad = squadOf(state, state.userTeamId).length;
  return (
    <Sheet title={`🌱 ユースチーム（${kids.length}/${YOUTH_MAX}）`} onClose={onClose} full>
      <p className="hint">
        毎シーズン{intakeCount(state)}人前後の15歳がユースに入ってきます（ユースアカデミー Lv.{facilityLevel(state, 'academy')}）。トップチームの登録人数（{squad}/{MAX_SQUAD}）には含まれません。
        <br />
        18歳になったら、昇格させるか・残すか・送り出すかを決めましょう。ユースにいられるのは19歳まで。
      </p>
      {kids.length === 0 && <p className="muted">いまユースに選手はいません。次のシーズンに新しい子が入ってきます。</p>}
      {kids.map((k) => (
        <KidCard key={k.id} kid={k} />
      ))}
      <Graduates />
    </Sheet>
  );
}

function groupAvg(p: Player, g: keyof typeof FOCUS_KEYS): number {
  const ks = FOCUS_KEYS[g];
  return Math.round(ks.reduce((a, k) => a + p.stats[k], 0) / ks.length);
}

function KidCard({ kid }: { kid: Player }) {
  const { state, update, toast } = useGame();
  const [open, setOpen] = useState(false);
  const [conv, setConv] = useState(false);
  const team = teamById(state, state.userTeamId);
  const y = kid.youth!;
  const gain = lastYearGain(kid);
  const hint = y.hints[y.hints.length - 1];
  const mentor = y.mentor ? state.players[y.mentor] : undefined;
  const cands = mentorCandidates(state);
  const slump = y.slump && y.slump.until > state.day;
  const full = squadOf(state, state.userTeamId).length >= MAX_SQUAD;
  return (
    <div className="card youth-kid">
      <div className="youth-head" onClick={() => setOpen(!open)}>
        <PlayerIcon p={kid} team={team} size={40} />
        <div className="grow">
          <b>{kid.name}</b>
          <div className="row gap small">
            <PosTag pos={kid.position} /> {kid.age}歳 · {kid.height}cm{gain !== null && gain > 0 && <span className="muted"> · 今季 +{gain}</span>}
          </div>
        </div>
        <Ovr v={overall(kid)} />
      </div>
      <div className="youth-tags">
        {kid.age >= 18 && <span className="chip accent">決断の時</span>}
        {slump && <span className="chip">😣 伸び悩み中</span>}
        {y.spurt && <span className="chip">📏 成長期を経験</span>}
        {mentor && <span className="chip">🤝 師匠：{mentor.name}</span>}
        {y.offer && <span className="chip">📨 引き抜きの話あり</span>}
      </div>
      {hint && (
        <div className="youth-hint">
          <small>🤝 代理人の見立て（{hint.season === state.season ? '今季' : `${state.season - hint.season}年前`}）</small>「{hint.text}」
        </div>
      )}
      <div>
        <small className="muted">練習の方針</small>
        <Seg scroll small value={y.focus} options={FOCUS_OPTIONS} onChange={(v: YouthFocus) => update((d) => setFocus(d, kid.id, v))} />
      </div>
      {open && (
        <>
          <div className="youth-groups">
            {(Object.keys(GROUP_LABEL) as (keyof typeof FOCUS_KEYS)[]).map((g) => {
              const v = groupAvg(kid, g);
              return (
                <span key={g}>
                  {GROUP_LABEL[g]} <b style={{ color: statColor(v) }}>{v}</b>
                </span>
              );
            })}
          </div>
          <GrowthAlbum p={kid} />
          {y.hints.length > 1 && (
            <details>
              <summary className="small muted">これまでの見立て（{y.hints.length}件）</summary>
              {y.hints
                .slice()
                .reverse()
                .map((h, i) => (
                  <p key={i} className="small">
                    {h.season === state.season ? '今季' : `${state.season - h.season}年前`}
                    {h.paid ? '（相談）' : '（入団時）'}「{h.text}」
                  </p>
                ))}
            </details>
          )}
          <label className="field">
            <span>師匠（トップチームのベテランが面倒を見ると伸びやすい）</span>
            <select
              value={y.mentor ?? ''}
              onChange={(e) => {
                const r = update((d) => setMentor(d, kid.id, e.target.value || null));
                toast(r.message ?? '');
              }}
            >
              <option value="">なし</option>
              {mentor && <option value={mentor.id}>{mentor.name}</option>}
              {cands.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.position}・{p.age}歳・{overall(p)}）
                </option>
              ))}
            </select>
          </label>
          {conv ? (
            <label className="field">
              <span>コンバート先のポジション</span>
              <select
                value={kid.position}
                onChange={(e) => {
                  const r = update((d) => convertKid(d, kid.id, e.target.value as Position));
                  toast(r.message ?? '');
                  setConv(false);
                }}
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      )}
      <div className="youth-actions">
        <button
          className="btn small"
          disabled={y.consulted === state.season || state.money < CONSULT_COST}
          onClick={() => {
            if (!confirm(`代理人に${kid.name}のことを相談しますか？（${fmtMoney(CONSULT_COST)}）`)) return;
            const r = update((d) => consultAgent(d, kid.id));
            if (r.text) alert(`🤝 代理人「${r.text}」`);
            else toast(r.message ?? '');
          }}
        >
          {y.consulted === state.season ? '今季は相談済み' : '代理人に相談'}
          <br />
          <small>{fmtMoney(CONSULT_COST)}</small>
        </button>
        <button className="btn small" onClick={() => (open ? setConv(!conv) : (setOpen(true), setConv(true)))}>
          コンバート
        </button>
        <button className="btn small ghost" onClick={() => setOpen(!open)}>
          {open ? '閉じる' : 'くわしく'}
        </button>
        <button
          className="btn small primary"
          disabled={kid.age < 16 || full}
          onClick={() => {
            if (!confirm(`${kid.name}をトップチームに昇格させますか？`)) return;
            const r = update((d) => promoteKid(d, kid.id));
            toast(r.message ?? '');
          }}
        >
          昇格させる
          {kid.age < 16 ? <small>（16歳から）</small> : full ? <small>（登録枠が満杯）</small> : null}
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            if (!confirm(`${kid.name}をユースから送り出しますか？（もう戻ってきません）`)) return;
            const r = update((d) => releaseKid(d, kid.id));
            toast(r.message ?? '');
          }}
        >
          送り出す
        </button>
      </div>
    </div>
  );
}

/** ユースから昇格した選手たち */
function Graduates() {
  const { state, openPlayer } = useGame();
  const list = Object.values(state.players)
    .filter((p) => p.youth && p.teamId === state.userTeamId)
    .sort((a, b) => overall(b) - overall(a));
  if (!list.length) return null;
  return (
    <>
      <h3 className="section-title">🎓 ユースから育った選手</h3>
      <div className="card">
        {list.map((p) => (
          <div key={p.id} className="fac-row" onClick={() => openPlayer(p.id)}>
            <div className="grow">
              <b>{p.name}</b>
              <small className="muted">
                {p.position} · {p.age}歳 · {p.youth!.hist[0]?.[0] ?? 15}歳で入団
              </small>
            </div>
            <Ovr v={overall(p)} />
          </div>
        ))}
      </div>
    </>
  );
}
