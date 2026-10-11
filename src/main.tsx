import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { backupAll, requestPersistence } from './game/save';
import './styles.css';

// アップデートでデータが壊れても戻せるよう、起動時に各スロットをバックアップ
try {
  backupAll();
} catch {
  // ストレージが使えない環境
}
requestPersistence();

// ホーム画面アプリの iPhone で、ステータスバーの高さ（safe-area）が取れない場合の保険
try {
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (standalone && /iPhone|iPod/.test(navigator.userAgent)) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top);visibility:hidden';
    document.body.appendChild(probe);
    const top = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    if (top < 20) document.documentElement.style.setProperty('--safe-t', '50px');
  }
} catch {
  // 何もしない
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const hadController = !!navigator.serviceWorker.controller;
        // アプリに戻ってきた時に新しいバージョンを確認する
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadController) window.dispatchEvent(new Event('app-update-ready'));
        });
      })
      .catch(() => {});
  });
}
