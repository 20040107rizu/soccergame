/**
 * マスターリーグ フレンドランキング用 Google Apps Script
 * スプレッドシートの「拡張機能 → Apps Script」に貼り付けて、ウェブアプリとしてデプロイする。
 * ゲームから届いた状況を「ranking」シートに1プレイヤー（端末×スロット）1行で保存し、一覧を返す。
 */
const SHEET = 'ranking';
const HEAD = ['playerId', 'slot', 'nickname', 'club', 'season', 'progress', 'plRank', 'played', 'win', 'draw', 'loss', 'points', 'gf', 'ga', 'money', 'spirit', 'topPlayer', 'achievements', 'clResult', 'titles', 'clTitles', 'version', 'updatedAt'];
const NUMS = ['slot', 'season', 'plRank', 'played', 'win', 'draw', 'loss', 'points', 'gf', 'ga', 'money', 'spirit', 'achievements', 'titles', 'clTitles'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function clean_(d) {
  return HEAD.map(function (h) {
    if (h === 'updatedAt') return new Date();
    const v = d[h];
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
