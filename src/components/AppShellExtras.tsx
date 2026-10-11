import { useEffect, useState } from 'react';
import { APP_VERSION, CHANGELOG } from '../version';
import { Sheet } from './ui';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);
/** ホーム画面から起動している（アプリとして表示中） */
export const isStandalone =
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
/** LINE・Instagram などのアプリ内ブラウザ */
const inAppBrowser = /Line\/|Instagram|FBAN|FBAV|Twitter|MicroMessenger|GSA\//.test(ua);
const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

const DISMISS_KEY = 'masterleague.installGuide.dismissed';
const SEEN_KEY = 'masterleague.seenVersion';

function getLS(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function setLS(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // 何もしない
  }
}

/** iPhone で URL から開いた時、最初にホーム画面への追加（アプリとして表示）を案内する */
export function InstallGuide() {
  const [open, setOpen] = useState(() => isIOS && !isStandalone && !getLS(DISMISS_KEY));
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const url = location.href.split('#')[0];
  return (
    <div className="install-guide">
      <div className="install-card">
        <img src="apple-touch-icon.png" alt="" width={64} height={64} className="install-icon" />
        <h2>ホーム画面に追加して遊ぼう</h2>
        <p className="muted small">アプリのように全画面で遊べて、セーブデータも安全に保存されます。</p>

        {inAppBrowser || otherBrowser ? (
          <>
            <div className="install-warn">
              {inAppBrowser ? 'LINEなどのアプリの中のブラウザでは、ホーム画面に追加できません。' : 'このブラウザより Safari がおすすめです。'}
              <br />
              <b>Safari で開き直してください。</b>
            </div>
            <ol className="install-steps">
              <li>
                画面の右下（または右上）の <b>「…」や共有ボタン</b> をタップ
              </li>
              <li>
                <b>「Safariで開く」</b>（「ブラウザで開く」）を選ぶ
              </li>
              <li>開いたら、この案内に従ってホーム画面に追加</li>
            </ol>
            <button
              className="btn"
              onClick={() => {
                navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {});
              }}
            >
              {copied ? 'コピーしました！ Safari に貼り付けて開いてください' : 'URLをコピーする'}
            </button>
          </>
        ) : (
          <>
            <h3 className="install-sub">iOS 26 の場合</h3>
            <ol className="install-steps">
              <li>
                画面右下の <span className="key">…</span> をタップ
              </li>
              <li>
                <span className="key">共有</span> をタップ
              </li>
              <li>
                <span className="key">ホーム画面に追加</span> をタップ（見つからなければ「その他」の中）
              </li>
              <li>
                <span className="key">Webアプリとして開く</span> がオンになっているのを確認して <span className="key">追加</span>
              </li>
            </ol>
            <h3 className="install-sub">iOS 18 以前の場合</h3>
            <ol className="install-steps">
              <li>
                画面下の共有ボタン <span className="key">□↑</span> をタップ
              </li>
              <li>
                <span className="key">ホーム画面に追加</span> → <span className="key">追加</span>
              </li>
            </ol>
          </>
        )}

        <div className="install-warn">
          ⚠️ 追加したら、<b>ホーム画面の「マスターリーグ」アイコンから</b>開いてください。Safariで遊んだデータとアプリのデータは別々に保存されます。
        </div>
        <button
          className="btn ghost small"
          onClick={() => {
            setLS(DISMISS_KEY, '1');
            setOpen(false);
          }}
        >
          このままブラウザで遊ぶ（おすすめしません）
        </button>
      </div>
    </div>
  );
}

/** アップデート後に初めて開いた時、変更点を表示する */
export function WhatsNew() {
  const [items] = useState(() => {
    const seen = getLS(SEEN_KEY);
    setLS(SEEN_KEY, APP_VERSION);
    // 初めて遊ぶ人には出さない
    const hasSave = (() => {
      try {
        return Object.keys(localStorage).some((k) => k.startsWith('masterleague.save.'));
      } catch {
        return false;
      }
    })();
    if (!seen && !hasSave) return [];
    if (seen === APP_VERSION) return [];
    const idx = CHANGELOG.findIndex((c) => c.version === seen);
    return idx === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, idx);
  });
  const [open, setOpen] = useState(items.length > 0);
  if (!open) return null;
  return (
    <Sheet title="アップデートのお知らせ" onClose={() => setOpen(false)}>
      <p className="hint">セーブデータはそのまま引き継がれています。</p>
      {items.map((c) => (
        <div key={c.version} className="help-item">
          <b>
            v{c.version}（{c.date}）
          </b>
          <ul className="changelog">
            {c.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
      <button className="btn primary big" onClick={() => setOpen(false)}>
        OK
      </button>
    </Sheet>
  );
}

/** 新しいバージョンが届いたら、再読み込みを促す（プレイ中のデータは消えない） */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const h = () => setReady(true);
    window.addEventListener('app-update-ready', h);
    return () => window.removeEventListener('app-update-ready', h);
  }, []);
  if (!ready) return null;
  return (
    <button className="update-banner" onClick={() => location.reload()}>
      🔄 新しいバージョンがあります。タップで更新（データはそのまま）
    </button>
  );
}
