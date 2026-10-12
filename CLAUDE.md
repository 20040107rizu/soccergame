# マスターリーグ 開発メモ

スマホ向けサッカー経営 PWA（React + TypeScript + Vite）。GitHub Pages で公開し、友人がテストプレイ中。

## メンテナンス時の絶対ルール：プレイヤーのセーブデータを消さない

テストプレイヤーの進行中データ（端末の localStorage）は、アップデート後もそのまま遊べること。

- `src/game/save.ts` の `SAVE_VERSION` を上げて古いセーブを読めなくする変更は禁止。
- データ構造を変える時は、`migrate()` に古いセーブを新しい形へ変換する処理を足す（新しい項目は省略可能にするか、既定値で補う）。
- セーブキー（`masterleague.save.*` / `masterleague.backup.*`）の名前を変えない。
- 起動時に `backupAll()` が各スロットをバックアップし、本体が壊れていればバックアップから読む。この仕組みを外さない。
- 変更後は `src/game/__tests__/save.test.ts` に「前のバージョンのセーブが読める」テストを足す。

## リリース手順

1. `src/version.ts` の `APP_VERSION` を上げ、`CHANGELOG` の先頭に変更点を追加（アップデート後に「お知らせ」として表示される）。
2. `public/sw.js` の `CACHE` 名を上げる（新しい版が確実に配信される）。
3. `npx tsc --noEmit -p . && npm test && npm run build` が通ることを確認。
4. `claude/soccer-management-game-lmdy7e` に push → GitHub Actions が Pages にデプロイ。

## ネタバレ禁止

- 開発者本人もこのゲームを遊んでいる。確率・出現率・計算式・隠しイベントの発生条件など、ゲームの内部の仕組みを会話で明かさない。
- 「どうしたらいい？」と聞かれたら、プレイヤー目線の一般的なヒントだけを答える（例：「余裕があるなら試してみる価値はある」）。具体的な数値や判定ロジックは、本人がはっきり求めた時だけ答える。

## その他

- お金は内部では百万ユーロ、表示は円（`fmtMoney`）。
- ゲームロジックは `src/game/`（UI 非依存）、画面は `src/screens/`。
