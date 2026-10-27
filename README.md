# 単語帳（flashcards）

資格勉強用の、自分でカスタマイズできる単語帳の Web アプリ。スマートフォンのブラウザで使い、ホーム画面に追加して PWA として開ける。
サーバーは Cloudflare Workers、データは Cloudflare D1 に置く。ログインは Cloudflare Access（Zero Trust）のメール認証で行い、アプリ側に認証コードを持たない。

## 機能

- 単語帳（デッキ）を資格ごと・分野ごとに作る。
- 札は「表・裏・補足・タグ」の文字。画面から追加・編集（自動保存）・削除する。
- スプレッドシートからコピーした TSV（表、裏、補足、タグ、選択肢の5列）を一括で取り込む。TSV に書き出す。
- 出題の形式を単語帳ごとに「記述」か「四択」から選ぶ。四択の誤答は、札に書いた選択肢か、同じ単語帳の他の札の裏から自動で作る。
- 記述では「ヒント」で補足（無ければ答えの頭文字と文字数）を出せる。
- 出題の向きを単語帳ごとに「表→裏」「裏→表」「混ぜる」から選ぶ。「裏→表」は裏の説明を見て表の用語を答える。四択の誤答は、裏→表では同じ単語帳の他の札の表から作る（札に書いた選択肢は使わない）。札の学習の進み具合は向きに関係なく 1 つ。
- 進み具合の棒、連続正解、評価のボタンに添える「次はいつ出るか」、正解のときにたまに出る称賛、学習の終わりの成績と紙吹雪、連続で学習した日数で張り合いを持たせる。OS の「視差効果を減らす」設定では動きを出さない。
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
6. Access アプリケーションの Overview にある Application Audience (AUD) Tag と、Zero Trust のチームドメイン（`<team>.cloudflareaccess.com`）を secret として入れる。デプロイのやり直しは要らない。

   ```sh
   npx wrangler secret put ACCESS_TEAM_DOMAIN   # 例: example.cloudflareaccess.com
   npx wrangler secret put ACCESS_AUD           # 64桁の AUD タグ
   ```

   - どちらも未設定のうちは `/api/*` が 500 を返し、誰も通れない（安全側）。
   - ログインしていない状態でサイトを開くと Access のログイン画面へ転送され、その URL にチームドメインと AUD（`kid=`）が出る。ダッシュボードで見つからないときはそこから拾える。

スマートフォンでは、ブラウザで開いてから「ホーム画面に追加」する。

## TSV の形式

タブ区切りで、1行に1枚。先頭行が `表	裏` で始まるなら見出しとして読み飛ばす。

```
表	裏	補足	タグ	選択肢
TCP	伝送制御プロトコル	第4層	ネットワーク,基礎	
DNSSEC が提供するものはどれか。	応答の完全性と真正性	暗号化はしない	文章問題	DNS 応答の機密性|サーバーの可用性|ゾーン転送の高速化
```

- 表と裏は必須。どちらかが無い行は取り込まない（件数を画面に出す）。
- タグは読点（、）かカンマで区切る。
- 選択肢は四択の誤答で、`|` で区切る（3つまで使う）。空なら同じ単語帳の他の札の裏から作る。
- セルの中の改行は `\n` の2文字で表す。書き出しでも同じ形になる。
- 画面の「TSV の形式」（`/help/tsv`）に同じ説明と見本（`public/help/sample.tsv`）があり、AI に札を作らせるための Claude 用スキル（`public/help/flashcards-tsv/SKILL.md`）と依頼文を配布している。形式を変えたら 3 か所（`src/lib/tsv.ts`、`/help/tsv` の画面、SKILL.md）をそろえる。
- `samples/` に情報処理安全確保支援士向けの見本がある。用語 `sc-terms.tsv`（76 枚）、文章問題と四択は `sc-questions.tsv`（21 問、基礎）、`sc-questions-tech.tsv`（48 問、暗号・認証・ネットワーク・Web・攻撃・対策・メール）、`sc-questions-ops.tsv`（42 問、インシデント対応・マネジメント・法規）。

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
