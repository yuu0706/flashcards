import type { Context } from "hono";

import type { Db } from "../db/client";
import type { Actor, AppEnv } from "./env";

/**
 * ルートハンドラが actor と db を取り出す唯一の入口。
 * ミドルウェアの登録順を誤ると c.var が undefined になるため、ここで実行時に落とす
 */
export function requireContext(c: Context<AppEnv>): { actor: Actor; db: Db } {
	const actor = c.get("actor");
	const db = c.get("db");
	if (!actor || !db) {
		throw new Error("認証ミドルウェアが適用されていません。src/worker/index.ts で app.use() を app.route() より先に登録すること");
	}
	return { actor, db };
}
