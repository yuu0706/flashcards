/**
 * 他のサイトから送られた状態を変える要求(CSRF)を拒む。
 *
 * ブラウザは別のオリジンからの POST に必ず Origin を付け、対応するブラウザは Sec-Fetch-Site も付ける。
 * 取り込み API は text/plain を受けるため、CORS の事前確認(preflight)が起きず、この確認が無いと
 * ログイン中に悪意のページを開いただけで札を足される。GET と HEAD と OPTIONS は対象にしない。
 * どちらのヘッダーも無い要求(ブラウザ以外)は通す。その経路には Access の Cookie が乗らないため
 */
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "./env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function sameOriginOnly() {
	return createMiddleware<AppEnv>(async (c, next) => {
		if (SAFE_METHODS.has(c.req.method)) return next();
		const origin = c.req.header("Origin");
		const site = c.req.header("Sec-Fetch-Site");
		const self = new URL(c.req.url).origin;
		const crossOrigin = origin !== undefined && origin !== "null" && origin !== self;
		const crossSite = site !== undefined && site !== "same-origin" && site !== "none";
		if (crossOrigin || origin === "null" || crossSite) {
			return c.json({ error: "この操作は単語帳の画面からだけ行えます" }, 403);
		}
		return next();
	});
}
