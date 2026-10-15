import { useState } from 'react';
import { PlayerRow, Sheet } from '../components/ui';
import { fmtMoney } from '../game/economy';
import { FROM_LABEL } from '../game/mail';
import { teamById } from '../game/season';
import { acceptOffer, rejectOffer } from '../game/transfer';
import type { Mail } from '../game/types';
import { useGame } from '../store';
import { OfferNegotiation } from './OfferNegotiation';
import { LegendPanel } from './LegendPanel';
import { EventPanel } from './EventPanels';

const FROM_ICON: Record<string, string> = {
  club: '🏢',
  agent: '🤝',
  advisor: '📋',
  medical: '🩺',
  league: '🏆',
  coach: '🧑‍🏫',
  scout: '🔭',
  board: '👔',
};

type Cat = 'all' | 'unread' | 'important' | 'transfer' | 'team' | 'scout' | 'club' | 'legend';

const CATS: { v: Cat; label: string; test: (m: Mail) => boolean }[] = [
  { v: 'all', label: 'すべて', test: () => true },
  { v: 'unread', label: '未読', test: (m) => !m.read },
  { v: 'important', label: '❗重要', test: (m) => !!m.important },
  { v: 'transfer', label: '🤝移籍', test: (m) => !m.legend && !m.sode && (m.from === 'agent' || m.from === 'club' || !!m.offerId) },
  { v: 'team', label: '🧑‍🏫チーム', test: (m) => !m.legend && (m.from === 'coach' || m.from === 'medical' || m.from === 'advisor') },
  { v: 'scout', label: '🔭スカウト', test: (m) => !m.legend && m.from === 'scout' },
  { v: 'club', label: '🏆クラブ・大会', test: (m) => !m.legend && !m.sode && (m.from === 'board' || m.from === 'league') },
  { v: 'legend', label: '🌟極秘', test: (m) => !!m.legend || !!m.sode },
];

/** メールの受信箱（ホーム画面） */
export function InboxList({ limit }: { limit?: number }) {
  const { state, update } = useGame();
  const [open, setOpen] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat>('all');
  const mails = state.mails ?? [];
  const cur = CATS.find((c) => c.v === cat)!;
  const filtered = mails.filter(cur.test);
  const list = limit ? filtered.slice(0, limit) : filtered;
  const mail = mails.find((m) => m.id === open);
  // メールがある種類だけ表示（「すべて」「未読」は常に表示）
  const cats = CATS.filter((c) => c.v === 'all' || c.v === 'unread' || c.v === cat || mails.some(c.test));
  const unreadIn = filtered.filter((m) => !m.read).length;
  return (
    <>
      <div className="inbox-filter">
        {cats.map((c) => {
          const n = c.v === 'all' || c.v === 'unread' ? 0 : mails.filter((m) => !m.read && c.test(m)).length;
          const total = c.v === 'unread' ? mails.filter((m) => !m.read).length : 0;
          return (
            <button key={c.v} className={'chip' + (cat === c.v ? ' on' : '')} onClick={() => setCat(c.v)}>
              {c.label}
              {(n > 0 || total > 0) && <span className="chip-count">{n || total}</span>}
            </button>
          );
        })}
      </div>
      {unreadIn > 0 && (
        <button
          className="inbox-readall"
          onClick={() =>
            update((d) => {
              for (const m of d.mails) if (cur.test(m)) m.read = true;
            })
          }
        >
          {cat === 'all' ? 'すべて既読にする' : `「${cur.label}」を既読にする`}
        </button>
      )}
      <div className="inbox">
        {list.length === 0 && <p className="muted center">{cat === 'all' ? 'メールはありません' : 'この種類のメールはありません'}</p>}
        {list.map((m) => (
          <button
            key={m.id}
            className={'mail-row' + (m.read ? '' : ' unread') + (m.important ? ' important' : '') + (m.legend ? ' legend' : '') + (m.sode ? ' sode' : '') + (m.action === 'saudi' ? ' saudi' : '')}
            onClick={() => {
              setOpen(m.id);
              if (!m.read)
                update((d) => {
                  const x = d.mails.find((y) => y.id === m.id);
                  if (x) x.read = true;
                });
            }}
          >
            <span className="mail-icon">{m.legend ? '🌟' : m.sode ? '⚡' : FROM_ICON[m.from] ?? '✉️'}</span>
            <span className="mail-main">
              <small>
                {m.sender} · {state.calendar[Math.min(m.day, state.calendar.length - 1)]?.label ?? ''}
              </small>
              <b>{m.subject}</b>
            </span>
            {!m.read && <i className="dot-unread" />}
          </button>
        ))}
      </div>
      {mail && <MailView mail={mail} onClose={() => setOpen(null)} />}
    </>
  );
}

function MailView({ mail, onClose }: { mail: Mail; onClose: () => void }) {
  const { state, update, toast, openPlayer } = useGame();
  const offer = mail.offerId ? state.offers.find((o) => o.id === mail.offerId) : undefined;
  const p = mail.playerId ? state.players[mail.playerId] : undefined;
  const [nego, setNego] = useState(false);
  if (nego && offer) return <OfferNegotiation offerId={offer.id} onClose={() => setNego(false)} />;
  return (
    <Sheet title={FROM_LABEL[mail.from]} onClose={onClose}>
      <div className="mail-view">
        <small className="muted">
          差出人：{mail.sender} · シーズン{mail.season}
        </small>
        <h3>{mail.subject}</h3>
        <p className="mail-body">{mail.body}</p>

        {p && !(p.gem && !p.gem.revealed) && (
          <PlayerRow
            p={p}
            team={p.teamId ? teamById(state, p.teamId) : undefined}
            onClick={() => {
              onClose();
              openPlayer(p.id);
            }}
          />
        )}
        {mail.players && mail.players.length > 0 && (
          <div className="list">
            {mail.players
              .map((id) => state.players[id])
              .filter(Boolean)
              .map((x) => (
                <PlayerRow
                  key={x.id}
                  p={x}
                  team={x.teamId ? teamById(state, x.teamId) : undefined}
                  onClick={() => {
                    onClose();
                    openPlayer(x.id);
                  }}
                />
              ))}
          </div>
        )}

        {mail.action && <EventPanel mail={mail} onDone={onClose} />}
        {mail.legend && mail.playerId && <LegendPanel playerId={mail.playerId} onDone={onClose} />}
        {mail.offerId &&
          (offer ? (
            <div className="row gap">
              <button
                className="btn ghost grow"
                onClick={() => {
                  update((d) => rejectOffer(d, offer.id));
                  toast('オファーを断りました');
                  onClose();
                }}
              >
                断る
              </button>
              <button className="btn grow" onClick={() => setNego(true)}>
                交渉する
              </button>
              <button
                className="btn primary grow"
                onClick={() => {
                  if (!confirm(`${p?.name}を ${fmtMoney(offer.fee)} で売却しますか？`)) return;
                  const r = update((d) => acceptOffer(d, offer.id));
                  toast(r.ok ? '売却が成立しました' : r.message);
                  if (r.ok) onClose();
                }}
              >
                受諾（{fmtMoney(offer.fee)}）
              </button>
            </div>
          ) : (
            <p className="hint">このオファーはすでに対応済み、または期限切れです。</p>
          ))}
      </div>
    </Sheet>
  );
}
