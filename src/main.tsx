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
