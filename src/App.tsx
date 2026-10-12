import { useCallback, useEffect, useMemo, useState } from 'react';
import { fmtMoney } from './game/economy';
import type { Slot } from './game/save';
import { unreadCount } from './game/mail';
import { playDay, prepareDay, teamById, today } from './game/season';
import type { GameState } from './game/types';
import type { LiveMatch } from './game/engine';
import { friendlyMatch, type TeamSnapshot } from './game/friendly';
import { finishLegendChallenge } from './game/legendChallenge';
import { finishSodeChallenge } from './game/sodegaura';
import { finishCoachChallenge } from './game/hidden2';
import { SODE_NAME } from './data/sodegaura';
import { Club } from './screens/Club';
import { Competitions } from './screens/Competitions';
import { Help } from './screens/Help';
import { InstallGuide, UpdateBanner, WhatsNew } from './components/AppShellExtras';
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
        <WhatsNew />
        <UpdateBanner />
        <InstallGuide />
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
      <UpdateBanner />
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </GameProvider>
  );
}

function Shell({ firstTab }: { firstTab: Tab }) {
  const { state, update, toast } = useGame();
  const [tab, setTab] = useState<Tab>(firstTab);
  const [screen, setScreen] = useState<'tabs' | 'prematch' | 'match'>('tabs');
  const [help, setHelp] = useState(false);
  const [friendly, setFriendly] = useState<{ state: GameState; match: LiveMatch; onEnd?: (gf: number, ga: number) => void } | null>(null);

  // ランキング画面から「親善試合」、メールから「レジェンドXI戦」を始める
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ snap: TeamSnapshot; nickname: string; challenge?: boolean | 'sode' | 'coach' }>).detail;
      const fm = friendlyMatch(state, d.snap, d.nickname);
      setFriendly(
        d.challenge === 'coach'
          ? {
              ...fm,
              onEnd: (gf, ga) => {
                update((s) => finishCoachChallenge(s, gf, ga));
                toast(gf > ga ? `🎩 名将に勝利！（${gf}-${ga}）受信箱を確認しよう` : `名将に敗れた…（${gf}-${ga}）`);
              },
            }
          : d.challenge === 'sode'
          ? {
              ...fm,
              onEnd: (gf, ga) => {
                update((s) => finishSodeChallenge(s, gf, ga));
                toast(gf > ga ? `⚡ ${SODE_NAME}に勝利！（${gf}-${ga}）受信箱を確認しよう` : `${SODE_NAME}に敗れた…（${gf}-${ga}）`);
              },
            }
          : d.challenge
          ? {
              ...fm,
              onEnd: (gf, ga) => {
                update((s) => finishLegendChallenge(s, gf, ga));
                toast(gf > ga ? `🏆 レジェンドXIに勝利！（${gf}-${ga}）受信箱を確認しよう` : `レジェンドXIに敗れた…（${gf}-${ga}）`);
              },
            }
          : fm,
      );
    };
    window.addEventListener('start-friendly', h);
    return () => window.removeEventListener('start-friendly', h);
  }, [state]);
  const unread = unreadCount(state);
  const team = teamById(state, state.userTeamId);
  const day = today(state);

  if (friendly) return <Match key="friendly" friendly={friendly} onExit={() => setFriendly(null)} />;
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
