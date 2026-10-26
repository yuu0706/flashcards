import { Hono } from "hono";

import { auth } from "./auth";
import type { AppEnv } from "./env";
import { ValidationError } from "./input";
import { cardRoutes } from "./routes/cards";
import { deckRoutes } from "./routes/decks";
import { meRoutes } from "./routes/me";

const app = new Hono<AppEnv>();

// 認証不要: 稼働確認
app.get("/api/health", (c) => c.json({ ok: true }));

// /api/* は Access の JWT 検証を必須にする。静的アセットは assets バインディングが先に返す。
// ★ app.route() より先に登録すること(後に書くと c.var が undefined のままハンドラが動く)
app.use("/api/*", auth());

app.route("/api/me", meRoutes);
app.route("/api/decks", deckRoutes);
app.route("/api", cardRoutes);

app.notFound((c) => c.json({ error: "見つかりません" }, 404));

app.onError((error, c) => {
	if (error instanceof ValidationError) return c.json({ error: error.message }, 400);
	console.error("Unhandled error:", error);
	return c.json({ error: "サーバーでエラーが発生しました。時間をおいてもう一度お試しください" }, 500);
});

export default app;
