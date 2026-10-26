# 単語帳（flashcards）

資格勉強用の、自分でカスタマイズできる単語帳の Web アプリ。スマートフォンのブラウザで使い、ホーム画面に追加して PWA として開ける。
サーバーは Cloudflare Workers、データは Cloudflare D1 に置く。ログインは Cloudflare Access（Zero Trust）のメール認証で行い、アプリ側に認証コードを持たない。

## 機能

- 単語帳（デッキ）を資格ごと・分野ごとに作る。
- 札は「表・裏・補足・タグ」の文字。画面から追加・編集（自動保存）・削除する。
- スプレッドシートからコピーした TSV（表、裏、補足、タグの4列）を一括で取り込む。TSV に書き出す。
- 間隔反復（SM-2 相当）で出題する。答えを見て「忘れた / あやふや / 覚えた」を押すと、次に出る日が伸び縮みする。
- 1日に新しく出す札の数を単語帳ごとに決める（既定 20）。

## 技術スタック

| 役割 | 使うもの |
| --- | --- |
| 実行環境 | Cloudflare Workers（静的アセット + API） |
| データ | Cloudflare D1（SQLite）+ Drizzle ORM |
| API | Hono |
| 画面 | React + Vite（SPA、PWA） |
| 認証 | Cloudflare Access（One-time PIN またはお好みの IdP） |
| テスト | Vitest（`@cloudflare/vitest-plugin` で workerd 上で実行） |

## 開発

```sh
npm install
cp .dev.vars.example .dev.vars      # DEV_AUTH_EMAIL を自分のメールに変える
npm run db:apply:local              # ローカル D1 にマイグレーションを当てる
npm run dev                         # http://localhost:5173
npm test                            # 単体テストと API の結合テスト
npm run check                       # 型 + ビルド + deploy --dry-run
```

ローカルでは Cloudflare Access を経由できないため、`.dev.vars` の `DEV_AUTH_EMAIL` の利用者としてログイン済みの扱いになる。接続先が localhost のときだけ効く（`src/worker/auth.ts`）。

## 初回のデプロイ

1. Cloudflare にログインする。
   ```sh
   npx wrangler login
   ```
2. D1 を作り、出力された `database_id` を `wrangler.json` に貼る。
   ```sh
   npx wrangler d1 create flashcards
   ```
3. 本番の D1 にマイグレーションを当てる。
   ```sh
   npm run db:apply:remote
   ```
4. デプロイする。
   ```sh
   npm run deploy
   ```
5. Cloudflare Zero Trust で Access アプリケーションを作る（Access → Applications → Add → Self-hosted）。
   - Application domain: デプロイ先のホスト名（`flashcards.<account>.workers.dev` か独自ドメイン）
   - Policy: Allow、Include で自分のメールアドレス（または Emails ending in 自分のドメイン）
   - Identity providers: One-time PIN で十分
6. Access アプリケーションの Overview にある Application Audience (AUD) Tag と、Zero Trust のチームドメイン（`<team>.cloudflareaccess.com`）を `wrangler.json` の `vars` に書いて、もう一度デプロイする。
   - `ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` が空のままだと `/api/*` は 500 を返し、誰も通れない（安全側）。

スマートフォンでは、ブラウザで開いてから「ホーム画面に追加」する。

## TSV の形式

タブ区切りで、1行に1枚。先頭行が `表	裏	補足	タグ` なら見出しとして読み飛ばす。

```
表	裏	補足	タグ
TCP	伝送制御プロトコル	第4層	ネットワーク,基礎
```

- 表と裏は必須。どちらかが無い行は取り込まない（件数を画面に出す）。
- タグは読点（、）かカンマで区切る。

## ディレクトリ

```
migrations/          D1 のマイグレーション(スキーマの正本)
src/
  lib/               サーバーと画面の両方で使う純粋な処理(間隔反復の計算、TSV)
  db/                Drizzle のスキーマとクライアント
  worker/            Hono の API(認証、入力検証、ルート)
  client/            React の画面
test/                Vitest(workerd 上で実行)
```
