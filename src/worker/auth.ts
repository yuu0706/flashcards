/**
 * Cloudflare Access(Zero Trust)の JWT を検証し、利用者を解決して actor を c.var に載せる。
 *
 * Access はエッジで認証を済ませ、Worker には `Cf-Access-Jwt-Assertion` ヘッダーに生の JWT を渡す。
 * Access を経由しない経路からは誰でも任意のヘッダーを付けられるため、必ず署名を検証する。
 */
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { verifyWithJwks } from "hono/jwt";

import { createDb } from "../db/client";
import { users } from "../db/schema";
import type { Actor, AppEnv } from "./env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function jsonError(message: string, status: 401 | 500, extra: Record<string, unknown> = {}) {
	return Response.json({ error: message, ...extra }, { status });
}

/** ログインし直すための URL。チームドメイン側のログアウトで古い Cookie を破棄する */
function logoutUrl(env: Env): string {
	return `https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/logout`;
}

/**
 * ローカル開発用のバイパス。.dev.vars の DEV_AUTH_EMAIL があり、接続先が localhost のときだけ効く。
 * 本番の vars には存在せず、仮に混入しても workers.dev / 独自ドメインでは条件を満たさない
 */
function devEmail(env: Env, url: URL): string | null {
	if (!env.DEV_AUTH_EMAIL || !LOCAL_HOSTS.has(url.hostname)) return null;
	return env.DEV_AUTH_EMAIL;
}

function extractToken(req: Request): string | null {
	const header = req.headers.get("Cf-Access-Jwt-Assertion");
	if (header) return header;
	const cookie = req.headers.get("Cookie") ?? "";
	const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
	return match?.[1] ?? null;
}

type Jwks = { keys: (JsonWebKey & { kid?: string; alg?: string })[] };
const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache: { url: string; fetchedAt: number; jwks: Jwks } | null = null;

async function loadJwks(teamDomain: string, opts: { force?: boolean } = {}): Promise<Jwks> {
	const url = `https://${teamDomain}/cdn-cgi/access/certs`;
	if (!opts.force && jwksCache && jwksCache.url === url && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
		return jwksCache.jwks;
	}
	const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
	if (!res.ok) throw new Error(`JWKS の取得に失敗しました (${res.status})`);
	const jwks = (await res.json()) as Jwks;
	if (!Array.isArray(jwks.keys)) throw new Error("JWKS の形式が不正です");
	jwksCache = { url, fetchedAt: Date.now(), jwks };
	return jwks;
}

function kidOf(token: string): string | undefined {
	try {
		const header = JSON.parse(atob(token.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/"))) as { kid?: string };
		return header.kid;
	} catch {
		return undefined;
	}
}

async function verifyAccessJwt(env: Env, token: string): Promise<string> {
	const teamDomain = env.ACCESS_TEAM_DOMAIN;
	let jwks = await loadJwks(teamDomain);
	const kid = kidOf(token);
	if (kid && !jwks.keys.some((k) => k.kid === kid)) jwks = await loadJwks(teamDomain, { force: true });

	const payload = await verifyWithJwks(token, {
		keys: jwks.keys,
		// header.alg を信用しない。Access は RS256 でしか署名しない
		allowedAlgorithms: ["RS256"],
		// aud / iss を省くと hono は検証しない(同一チームの別アプリのトークンが通る)
		verification: { aud: env.ACCESS_AUD, iss: `https://${teamDomain}` },
	});
	const email = typeof payload["email"] === "string" ? payload["email"] : null;
	if (!email) throw new Error("email クレームがありません");
	return email;
}

async function resolveUser(env: Env, rawEmail: string): Promise<Actor> {
	const db = createDb(env.DB);
	const email = rawEmail.trim().toLowerCase();
	const found = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
	if (found[0]) return found[0];
	const inserted = await db.insert(users).values({ email }).returning({ id: users.id, email: users.email });
	const row = inserted[0];
	if (!row) throw new Error("利用者レコードの作成に失敗しました");
	return row;
}

export function auth() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const url = new URL(c.req.url);
		let email = devEmail(c.env, url);

		if (!email) {
			if (!c.env.ACCESS_TEAM_DOMAIN || !c.env.ACCESS_AUD) {
				// 設定漏れで無認証のまま通すより落とす
				return jsonError("サーバー側の認証設定が未完了です(ACCESS_TEAM_DOMAIN / ACCESS_AUD)", 500);
			}
			const token = extractToken(c.req.raw);
			if (!token) return jsonError("ログインが必要です", 401, { logoutUrl: logoutUrl(c.env) });
			try {
				email = await verifyAccessJwt(c.env, token);
			} catch (error) {
				// 失敗理由をクライアントに返さない(何を偽装すれば通るかのヒントになる)
				console.warn("Access JWT rejected:", error instanceof Error ? error.message : error);
				return jsonError("ログインの有効期限が切れました", 401, { logoutUrl: logoutUrl(c.env) });
			}
		}

		c.set("actor", await resolveUser(c.env, email));
		c.set("db", createDb(c.env.DB));
		await next();
	});
}
