/**
 * マスターリーグ フレンドランキング用 Google Apps Script
 * ウェブアプリとしてデプロイする（実行ユーザー：自分 / アクセス：全員）。
 * ゲームから届いた状況をスプレッドシートの最初のシートに1プレイヤー（端末×スロット）1行で保存し、一覧を返す。
 */
const HEAD = ['playerId', 'slot', 'nickname', 'club', 'season', 'progress', 'plRank', 'played', 'win', 'draw', 'loss', 'points', 'gf', 'ga', 'money', 'spirit', 'topPlayer', 'achievements', 'clResult', 'titles', 'clTitles', 'version', 'updatedAt', 'team'];
const NUMS = ['slot', 'season', 'plRank', 'played', 'win', 'draw', 'loss', 'points', 'gf', 'ga', 'money', 'spirit', 'achievements', 'titles', 'clTitles'];

// 記録先のスプレッドシート（「マスターリーグ ランキング」）
const SPREADSHEET_ID = '1EgfWehzady0eZ_CZG_DYgE_DlheAY88x2gv0_57RcNw';

function sheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // 最初のシートに1プレイヤー1行で記録する（1行目は見出し）
  const sh = ss.getSheets()[0];
  // 見出しは常に最新にそろえる（列を足しても前のデータはそのまま）
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
  return sh;
}

function clean_(d) {
  return HEAD.map(function (h) {
    if (h === 'updatedAt') return new Date();
    const v = d[h];
    // チーム情報（親善試合用の JSON）は長いので別扱い
    if (h === 'team') return String(v == null ? '' : v).slice(0, 40000);
    if (NUMS.indexOf(h) >= 0) {
      const n = Number(v);
      return isFinite(n) ? Math.max(-1e6, Math.min(1e7, Math.round(n))) : 0;
    }
    return String(v == null ? '' : v).slice(0, 40);
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d || !d.playerId) return out_({ ok: false });
    const sh = sheet_();
    const rec = clean_(d);
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(rec[0]) && Number(vals[i][1]) === Number(rec[1])) {
        sh.getRange(i + 1, 1, 1, HEAD.length).setValues([rec]);
        return out_({ ok: true });
      }
    }
    if (vals.length > 500) return out_({ ok: false, error: 'full' });
    sh.appendRow(rec);
    return out_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const vals = sheet_().getDataRange().getValues();
  const rows = vals.slice(1).map(function (r) {
    const o = {};
    HEAD.forEach(function (h, i) {
      o[h] = h === 'updatedAt' && r[i] instanceof Date ? r[i].toISOString() : r[i];
    });
    return o;
  });
  return out_({ rows: rows });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
