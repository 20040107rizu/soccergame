import { useCallback, useEffect, useState } from 'react';
import { fmtP } from './components/ui';
import type { Slot } from './game/save';
import type { GameState } from './game/types';
import { Edit } from './screens/Edit';
import { Home } from './screens/Home';
import { League } from './screens/League';
import { Match } from './screens/Match';
import { PlayerDetail } from './screens/PlayerDetail';
import { PlayerEditor } from './screens/PlayerEditor';
import { Squad } from './screens/Squad';
import { Title } from './screens/Title';
import { Transfer } from './screens/Transfer';
import { GameProvider, useGame } from './store';

type Tab = 'home' | 'squad' | 'transfer' | 'league' | 'edit';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: '🏟' },
  { id: 'squad', label: 'チーム', icon: '👕' },
  { id: 'transfer', label: '移籍', icon: '🔁' },
  { id: 'league', label: 'リーグ', icon: '🏆' },
  { id: 'edit', label: 'エディット', icon: '✏️' },
];

export function App() {
  const [game, setGame] = useState<{ state: GameState; slot: Slot } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | 'new'; teamId?: string | null } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const toast = useCallback((m: string) => setToastMsg(m), []);

  if (!game) {
    return <Title onStart={(state, slot) => setGame({ state, slot })} />;
  }

  return (
    <GameProvider
      key={game.slot + ':' + game.state.createdAt}
      initial={game.state}
      slot={game.slot}
      openPlayer={setDetail}
      editPlayer={(id, teamId) => setEditing({ id, teamId })}
      toast={toast}
      quit={() => {
        setDetail(null);
        setEditing(null);
        setGame(null);
      }}
    >
      <Shell />
      {detail && <PlayerDetail id={detail} onClose={() => setDetail(null)} />}
      {editing && <PlayerEditor id={editing.id} teamId={editing.teamId} onClose={() => setEditing(null)} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </GameProvider>
  );
}

function Shell() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [inMatch, setInMatch] = useState(false);
  const team = state.teams.find((t) => t.id === state.userTeamId)!;

  if (inMatch) return <Match onExit={() => setInMatch(false)} />;

  return (
    <div className="app">
      <header className="topbar" style={{ borderColor: team.color }}>
        <span className="topbar-title">{team.short}</span>
        <span className="topbar-meta">
          S{state.season} · 第{state.round + 1}節
        </span>
        <span className="points-badge">{fmtP(state.points)}</span>
      </header>
      <main className="content">
        {tab === 'home' && <Home onPlayMatch={() => setInMatch(true)} />}
        {tab === 'squad' && <Squad />}
        {tab === 'transfer' && <Transfer />}
        {tab === 'league' && <League />}
        {tab === 'edit' && <Edit />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
