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
- **画面の見た目は Skill `ui-design`、文言は `ui-text` に従う。** 色・余白・寸法は `src/client/index.css` のトークンだけを使う。自分用の道具なので `<html data-text="large">`。編集欄は自動保存で、保存のボタンを置かない。
- **開閉の状態は `<html data-panel>` の1か所に集める**(狭い画面で一覧と詳細を切り替える)。

## 未完了

- `wrangler.json` の `database_id` と `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` は、Cloudflare 側の作成後に埋める(README「初回のデプロイ」)。
