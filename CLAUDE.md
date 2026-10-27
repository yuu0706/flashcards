# 単語帳（flashcards）

資格勉強用の単語帳。Cloudflare Workers + D1 + Hono + React/Vite。利用者は本人だけで、個人の Cloudflare アカウントに置く。

## コマンド

```sh
npm run dev                 # ローカル開発(vite + workerd)
npm test                    # vitest run(workerd 上。D1 の CHECK 制約と CASCADE を実物で通す)
npm run check               # 型 + ビルド + deploy --dry-run
npm run db:apply:local      # ローカル D1 にマイグレーション
npm run db:apply:remote     # 本番 D1 にマイグレーション(★本番。実行前に確認を取る)
npm run cf-typegen          # wrangler.json を変えたら Env の型を再生成(--strict-vars=false 付き)
```

素の `npx wrangler d1 migrations apply DB` は打たない。`--local` / `--remote` を埋め込んだ npm スクリプト経由で実行する。

## 決まり

- **スキーマの正本は `migrations/*.sql`。** `src/db/schema.ts` は手で追従させる(drizzle-kit は使わない)。
- **日付は利用者の現地日付をクライアントが `today`(YYYY-MM-DD)で渡す。** サーバーは日付を判断しない。
- **間隔反復の計算は `src/lib/scheduler.ts` の純粋関数だけで行う。** DB や日時に依存させず、`test/scheduler.test.ts` で固定する。
- **すべてのクエリは `user_id` で絞る。** 他人の単語帳・札は 404 にする(`test/isolation.test.ts`)。
- **`/api/*` は Cloudflare Access の JWT 検証を必須にする。** ヘッダーの存在だけで信用しない。ローカルのバイパス(`DEV_AUTH_EMAIL`)は localhost でしか効かない。
- **状態を変える `/api/*` は同一オリジンからだけ受ける**(`src/worker/origin.ts`。Origin / Sec-Fetch-Site が他サイトなら 403)。防御のヘッダーは画面側が `public/_headers`、API 側が `secureHeaders`。CSP は `script-src 'self'` なので、外部のスクリプトや CDN を足さない。
- **画面にメールアドレスをそのまま出さない。** 肩越しの覗き見を避けるため `src/lib/mask.ts` の `maskEmail` で伏せる。
- **画面の見た目は Skill `ui-design`、文言は `ui-text` に従う。** 色・余白・寸法は `src/client/index.css` のトークンだけを使う。自分用の道具なので `<html data-text="large">`。編集欄は自動保存で、保存のボタンを置かない。
- **開閉の状態は `<html data-panel>` の1か所に集める**(狭い画面で一覧と詳細を切り替える)。
- **四択の選択肢とヒントは `src/lib/quiz.ts` の純粋関数で、手元の札だけから作る。** AI は使わない。誤答は札の `choices` を優先し、足りない分を学習 API の `pool.backs`(同じ単語帳の裏)から補う。出題の向き(`decks.direction`: forward / reverse / mixed)が裏→表のときは `choices` を使わず `pool.fronts` だけから作る。向きは札ごとに `pickSide` で決め、札の間隔反復の状態は向きに関係なく 1 つ。
- **達成感の演出(進み具合の棒・連続正解・たまに出る称賛・紙吹雪)は 2026-10-27 の利用者の指示で入れた。** `ui-design` の「飾りの動き」の禁止の例外で、動くのは状態が変わった瞬間だけ、長さは `--duration-slow` と紙吹雪の 1.1 秒まで、`prefers-reduced-motion` では出さない。出る確率と節目は `src/lib/quiz.ts` の `rollCheer`。
- **TSV の形式の説明は 3 か所にある。** `src/lib/tsv.ts` の実装、`src/client/pages/Help.tsx` の画面(`/help/tsv`)、配布する `public/help/flashcards-tsv/SKILL.md`。列や上限(`src/worker/routes/cards.ts` の `LIMITS`)を変えたら 3 か所をそろえる。
- **本番の D1 は1つの SQL に結び付けられる値が 100 個まで。** 複数行をまとめた INSERT は使わず、1行ずつの文を `db.batch` でまとめる。手元の SQLite はこの制限を再現しない。

## 本番

個人の Cloudflare アカウント(`yuu0706.workers.dev`)に配置済み。`wrangler.json` の `database_id` は本番のもの。Access の `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` は Worker の secret で、リポジトリには置かない(公開リポジトリのため)。マイグレーションを足したら `npm run db:apply:remote` → `npm run deploy` の順(どちらも利用者が実行する)。
