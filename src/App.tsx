import { useCallback, useEffect, useMemo, useState } from 'react';
import { fmtMoney } from './game/economy';
import type { Slot } from './game/save';
import { unreadCount } from './game/mail';
import { playDay, prepareDay, teamById, today } from './game/season';
import type { GameState } from './game/types';
import { Club } from './screens/Club';
import { Competitions } from './screens/Competitions';
import { Help } from './screens/Help';
import { Home } from './screens/Home';
import { Match } from './screens/Match';
import { Negotiation } from './screens/Negotiation';
import { PlayerDetail } from './screens/PlayerDetail';
import { PlayerEditor } from './screens/PlayerEditor';
import { Squad } from './screens/Squad';
import { Title } from './screens/Title';
import { Transfer } from './screens/Transfer';
import { GameProvider, useGame, type UiActions } from './store';

type Tab = 'home' | 'squad' | 'transfer' | 'comp' | 'club';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: '🏟' },
  { id: 'squad', label: 'チーム', icon: '👕' },
  { id: 'transfer', label: '移籍', icon: '🔁' },
  { id: 'comp', label: '大会', icon: '🏆' },
  { id: 'club', label: 'クラブ', icon: '⚙️' },
];

export function App() {
  const [game, setGame] = useState<{ state: GameState; slot: Slot; firstRun?: 'original' } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [nego, setNego] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const toast = useCallback((m: string) => setToastMsg(m), []);
  const actions: UiActions = useMemo(
    () => ({
      openPlayer: setDetail,
      openNegotiation: setNego,
      editPlayer: setEditing,
      toast,
      quit: () => {
        setDetail(null);
        setNego(null);
        setEditing(null);
        setGame(null);
      },
    }),
    [toast],
  );

  if (!game) {
    return (
      <>
        <Title onStart={(state, slot, firstRun) => setGame({ state, slot, firstRun })} />
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </>
    );
  }

  return (
    <GameProvider key={game.slot + ':' + game.state.createdAt} initial={game.state} slot={game.slot} actions={actions}>
      <Shell firstTab={game.firstRun === 'original' ? 'club' : 'home'} />
      {detail && <PlayerDetail id={detail} onClose={() => setDetail(null)} />}
      {nego && <Negotiation id={nego} onClose={() => setNego(null)} />}
      {editing && <PlayerEditor id={editing} onClose={() => setEditing(null)} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </GameProvider>
  );
}

function Shell({ firstTab }: { firstTab: Tab }) {
  const { state, update, toast } = useGame();
  const [tab, setTab] = useState<Tab>(firstTab);
  const [screen, setScreen] = useState<'tabs' | 'prematch' | 'match'>('tabs');
  const [help, setHelp] = useState(false);
  const unread = unreadCount(state);
  const team = teamById(state, state.userTeamId);
  const day = today(state);

  if (screen === 'match') return <Match onExit={() => setScreen('tabs')} />;
  if (screen === 'prematch') {
    return (
      <div className="app">
        <main className="content">
          <Squad
            mode="prematch"
            onBack={() => setScreen('tabs')}
            onKickoff={() => {
              update((d) => prepareDay(d));
              setScreen('match');
            }}
            onQuick={() => {
              const r = update((d) => {
                prepareDay(d);
                return playDay(d);
              });
              if (r.userResult) toast(`${r.userResult.label}（賞金 +${fmtMoney(r.userResult.prize)}）`);
              setScreen('tabs');
              setTab('home');
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar" style={{ borderColor: team.color }}>
        <span className="topbar-title">{team.name}</span>
        <span className="topbar-meta">{day ? day.label : 'シーズン終了'}</span>
        <span className="money-badge">{fmtMoney(state.money)}</span>
        <button className="help-btn" aria-label="ヘルプ" onClick={() => setHelp(true)}>
          ？
        </button>
      </header>
      <main className="content">
        {tab === 'home' && <Home onPreMatch={() => setScreen('prematch')} />}
        {tab === 'squad' && <Squad />}
        {tab === 'transfer' && <Transfer />}
        {tab === 'comp' && <Competitions />}
        {tab === 'club' && <Club />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">
              {t.icon}
              {t.id === 'home' && unread > 0 && <i className="tab-badge">{unread > 99 ? '99+' : unread}</i>}
            </span>
            <span>{t.id === 'club' && team.original ? 'エディット' : t.label}</span>
          </button>
        ))}
      </nav>
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
