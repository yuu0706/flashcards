import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const TEST_ACCESS_TEAM_DOMAIN = "test-team.cloudflareaccess.com";

/** テスト用の RSA 鍵。公開鍵は Access の JWKS の代わりに outboundService から返す */
async function generateTestAccessKeys() {
	const pair = await crypto.subtle.generateKey(
		{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
		true,
		["sign", "verify"],
	);
	const publicJwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "test-kid-1", alg: "RS256", use: "sig" };
	const privateJwk = { ...(await crypto.subtle.exportKey("jwk", pair.privateKey)), kid: "test-kid-1", alg: "RS256" };
	return { publicJwk, privateJwk };
}

// テストは workerd 上で実行する。Node 上で D1 をモックすると CHECK 制約や CASCADE を通らない
export default defineConfig({
	plugins: [
		cloudflareTest(async () => {
			const keys = await generateTestAccessKeys();
			return {
				wrangler: { configPath: "./wrangler.json" },
				miniflare: {
					outboundService(request: Request) {
						const url = new URL(request.url);
						if (url.hostname === TEST_ACCESS_TEAM_DOMAIN && url.pathname === "/cdn-cgi/access/certs") {
							return Response.json({ keys: [keys.publicJwk] });
						}
						return new Response("テスト中の外部通信は許可されていません: " + request.url, { status: 404 });
					},
					bindings: {
						TEST_MIGRATIONS: await readD1Migrations(new URL("migrations", import.meta.url).pathname),
						ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM_DOMAIN,
						ACCESS_AUD: "test-aud-tag",
						TEST_ACCESS_PRIVATE_JWK: JSON.stringify(keys.privateJwk),
						DEV_AUTH_EMAIL: "dev@example.com",
					},
				},
			};
		}),
	],
	test: {
		include: ["test/**/*.test.ts"],
		setupFiles: ["./test/apply-migrations.ts"],
	},
});
