import { POSITIONS, type GameState, type Position } from './types';

/**
 * 名簿CSV：スプレッドシートで選手名などを一括で書き換えるための形式。
 * id 列で既存の選手と対応付けるので、id は消さないこと。
 */
const HEADER = ['id', 'club', 'name', 'position', 'number', 'age', 'nationality', 'foot'];

function esc(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportRosterCsv(state: GameState): string {
  const teams = Object.fromEntries(state.teams.map((t) => [t.id, t.name]));
  const rows = Object.values(state.players)
    .sort((a, b) => (a.teamId ?? 'zz').localeCompare(b.teamId ?? 'zz') || POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position))
    .map((p) => [p.id, p.teamId ? teams[p.teamId] : 'フリー', p.name, p.position, p.number, p.age, p.nationality, p.foot].map(esc).join(','));
  return [HEADER.join(','), ...rows].join('\n');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** CSVの内容を反映。更新した人数を返す（破壊的に更新） */
export function importRosterCsv(state: GameState, text: string): number {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSVが空です');
  const head = rows[0].map((h) => h.trim());
  const col = (name: string) => head.indexOf(name);
  if (col('id') < 0) throw new Error('id 列が見つかりません');
  let n = 0;
  for (const r of rows.slice(1)) {
    const p = state.players[r[col('id')]?.trim()];
    if (!p) continue;
    const get = (name: string) => (col(name) >= 0 ? r[col(name)]?.trim() : undefined);
    const name = get('name');
    if (name) p.name = name;
    const pos = get('position') as Position | undefined;
    if (pos && POSITIONS.includes(pos)) p.position = pos;
    const num = Number(get('number'));
    if (num >= 1 && num <= 99) p.number = num;
    const age = Number(get('age'));
    if (age >= 15 && age <= 45) p.age = age;
    const nat = get('nationality');
    if (nat) p.nationality = nat;
    const foot = get('foot');
    if (foot === 'R' || foot === 'L') p.foot = foot;
    p.custom = true;
    n++;
  }
  return n;
}
