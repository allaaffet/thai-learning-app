# Thai Learning — タイ語を、ひとつずつ。

日本語を母語とする成人が、文字・発音の仕組みからタイ語を学ぶWebアプリです。カリキュラムを軸に、短い解説・比較・演習・振り返りを組み合わせます。

**Phase 2まで操作できる学習アプリ** を実装しています。アカウント登録、APIキー、有料サービスは不要です。

## できること

- ホーム：次に学ぶレッスン、今日の目標、進捗・XP・連続学習日数。
- ロードマップ：8部のカリキュラム案、第1〜3章の14レッスン、前提に基づく解放。
- レッスン：Learn → Explore → Practice → Review。日本語解説、Thai・IPA・意味の比較、選択式・文字識別の全70問、正誤と理由。Phase 2で8レッスン・40問を追加しています。
- 5問中4問以上でレッスン完了。初回のみXPを付与し、再受講で最高正答率を更新できます。誤答へのペナルティはありません。
- タイ文字ノート：全44子音と32母音パターン、クラス・長短の絞り込み、文字・意味の検索、用例と発音情報。
- 書取り：全44子音と32母音パターンの用例を、マウス・指・ペンでなぞる／手本なしで書く練習。ガイド線、1本戻す、全消去に対応。
- ก・ง・จ・มの4字に、出典の記録軌跡を再生する参考アニメーション。標準筆順は未検証・専門家監修前です。他の40字と母音には未確認の筆順を表示しません。
- ブラウザ内への進捗保存、再読み込み後の復元、保存失敗のお知らせ。
- PC・タブレット・スマートフォン、キーボード操作、ローカル配信のThai対応フォント。
- 画面上部の「タイ語の字体」で、標準（ループあり）とループなしを切り替え。選択はこのブラウザに保存されます。

**教材は専門家レビュー前の教材案です。** Unicode公式資料による文字名・コード等の限定照合と、未検証のIPA・声調・語義を区別しています。4字の運筆例も正しい筆順の保証や採点基準には使いません。音声、検証済みの標準筆順、自動採点、一般的な声調判定、SRS、クラウド同期は未実装です。確認範囲は [教材の出典](docs/CONTENT_SOURCES.md) を参照してください。

## セットアップ

Node.js **24 LTS**（検証版24.19.0）とnpmを使います。`.node-version` に版を記載しています。依存関係は `package-lock.json` で固定しています。

現在の実装は `codex/phase-1-mvp` ブランチにあります。ブランチ名はそのままでPhase 2を追加しています。

```bash
git clone --branch codex/phase-1-mvp https://github.com/allaaffet/thai-learning-app.git
cd thai-learning-app
npm ci
npm run dev
```

ブラウザのアドレス欄に `http://localhost:3000` を入力します。ホームの「学習をはじめる」から体験できます。すでにクラウド上のチェックアウトがある場合は、`/workspace/thai-learning-app` で `npm run dev` を実行してください。クラウド環境のブラウザ表示機能の対応状況は利用中のUIに依存します。

すでにMacなどへ取得済みの場合は、起動中のサーバーを `Control+C` で止め、アプリのフォルダで更新します。第1章の保存済み進捗はそのまま使えます。

```bash
git pull --ff-only
npm ci
npm run dev
```

### Macで古いNode.jsが使われる場合

[Node.js公式サイト](https://nodejs.org/ja/download)からmacOS用の24 LTSインストーラー（`.pkg`）を入れ、ターミナルを開き直します。`node -v` が `v24.…` になれば準備完了です。npmの番号は24である必要はありません。

Anacondaを使っていてエラーに `/opt/anaconda3/bin/node`・`node v6.13.1` が出る場合は、同じターミナルで次を実行し、新しくインストールしたNode.jsを優先します。この変更はそのターミナルだけに適用されます。

```bash
export PATH="/usr/local/bin:$PATH"
hash -r
node -v
npm -v
```

`node -v` が24系になってから `npm ci` と `npm run dev` を実行してください。

このクラウド環境ではnpmの標準キャッシュ先が書き込めないため、依存の再インストール時は以下を使います。

```bash
npm ci --cache /tmp/thai-learning-npm-cache
```

本番と同じ構成で確認する場合：

```bash
npm run build
npm run start
```

ポート3000をすでに使用している場合は、開発サーバーを `npm run dev -- --port 3001` で起動できます。開発・本番のサーバーは同じチェックアウトで同時に動かさず、起動中のものを `Ctrl+C` で停止してから切り替えてください。

## テスト

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

まとめて実行するには `npm run check`。ユニットテストは教材の参照整合性・前提関係、80%境界、初回回答、XP重複防止、進捗の検証・保存・復元を確認します。

E2Eはビルド済みアプリをPCとスマートフォンの画面サイズで操作します。

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Linuxでブラウザの共有ライブラリが不足している場合は、Playwright公式手順の `npx playwright install --with-deps chromium` を使ってください。このクラウド環境はChromiumが導入済みなので、ダウンロードなしで以下を実行できます。

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

テストは必要に応じてポート3000で本番サーバーを起動します。既存サーバーを再利用する場合は、最新のビルドであることを確認してください。結果は `playwright-report/`、スクリーンショットは `test-results/` に出力され、Gitには含めません。

## 保存と学習ルール

- 保存キーは `thai-learning.progress.v1`。このブラウザ・同じオリジン内だけの保存です。別の端末とは同期しません。
- 正答率は各受講回の各問題で最初に確定した答えから計算します。回答後の選び直しで成績を上げることはできません。
- 受講結果と学習日は、クイズ終了時に記録します。合格した受講は「レッスンを完了する」を押した時点で完了とXPを保存します。
- 途中のページ位置や未終了クイズは保存しません。「学習をつづける」は未完了の最初のレッスンに戻ります。
- 再受講でXPは増えず、以前の完了と最高正答率は維持します。学習日・連続日数は利用者のローカル日付を使います。
- 第1章は240XP、追加の第2・3章は330XP、14レッスンの初回完了は合計570XPです。第2章は第1章最後のレッスンを完了すると開きます。
- 書取りは採点・XP加算・進捗保存の対象外です。描いた線は文字の変更や画面移動で消えます。薄い手本は全体の字体切替にかかわらず、標準のループあり字体を使います。
- 保存先が使用できない場合も、その画面では学習を続けられます。保存できていない旨を表示します。
- ブラウザのサイトデータを削除すると進捗も消えます。壊れたJSONや未知の保存版は検証して安全に扱い、読み込みだけで元の保存データを上書きしません。

## 構成と資料

実行したチェック、テスト件数、ブラウザの確認範囲、開発用依存の既知事項は [検証結果](docs/VALIDATION.md) を参照してください。自動テストの成功は教材の言語学的な監修完了を意味しません。

Next.js App Router / React / TypeScript / Tailwind CSS / shadcn/ui方式のローカルUI部品 / Vitest / Playwright。

| 資料                                             | 内容                             |
| ------------------------------------------------ | -------------------------------- |
| [プロダクト仕様](docs/PRODUCT_SPEC.md)           | 体験・画面・完成条件             |
| [カリキュラム](docs/CURRICULUM.md)               | 8部・第1〜3章14レッスン・IPA表記 |
| [アーキテクチャ](docs/ARCHITECTURE.md)           | 教材型・UI・進捗保存の境界       |
| [開発計画](docs/ROADMAP.md)                      | Phase 1・2の実装と未実装範囲     |
| [教材の出典](docs/CONTENT_SOURCES.md)            | 限定照合の根拠・未検証事項       |
| [Phase 2仕様](docs/PHASE2_SPEC.md)               | 文字・母音ノートと書取りの範囲   |
| [Phase 2教材](docs/PHASE2_CONTENT.md)            | 44子音・32母音のデータ方針       |
| [運筆資料の調査](docs/PHASE2_STROKE_RESEARCH.md) | 4字の参考軌跡・利用条件・限界    |
| [開発ルール](AGENTS.md)                          | Codex向けの品質・教材作成規約    |

教材全体の参照先は `src/data/course.ts` です。既存第1章は `curriculum.ts`、追加レッスンは `phase-two.ts`、文字と母音は `alphabet.ts` に分離しています。型は `src/lib/content-types.ts`・`alphabet-types.ts`、保存と進捗は `src/lib/progress.ts`、書取りの入力処理は `src/lib/handwriting.ts` です。一般的な声調判定エンジンはPhase 3で独立モジュールとして実装する予定です。Phase 3には着手していません。

日本語フォントはNoto Sans JP、Thaiは標準（ループあり）のNoto Sans Thai LoopedとループなしのNoto Sans Thaiを使います（SIL Open Font License）。画面上部のスイッチはオフが標準、オンがループなしで、文字ノート・解説・問題のタイ語へ共通で反映します。字体だけの変更で、教材の綴りやIPAは変えません。保存先を使用できない場合も、その画面では切り替えられます。

フォントはnpmパッケージから自己配信し、Google Fonts APIを利用しません。[フォントのライセンス](public/licenses/) を同梱しています。4字の参考運筆データはMITライセンスで、[著作権表示・許諾文](public/licenses/ThaiWritingPractice-MIT.txt)を同梱しています。アプリの公開デプロイは今回行っていません。
