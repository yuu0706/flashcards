/**
 * 他人のデータに触れないことの確認。
 * DEV_AUTH_EMAIL は固定なので、別の利用者のデータは DB に直接作る。
 */
import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { createDb } from "../src/db/client";
import { cards, decks, users } from "../src/db/schema";

const TODAY = "2026-10-26";

async function seedOther() {
	const db = createDb(env.DB);
	const [u] = await db.insert(users).values({ email: "other@example.com" }).returning({ id: users.id });
	const [d] = await db.insert(decks).values({ userId: u!.id, name: "他人の単語帳" }).returning({ id: decks.id });
	const [c] = await db.insert(cards).values({ userId: u!.id, deckId: d!.id, front: "x", back: "y" }).returning({ id: cards.id });
	return { deckId: d!.id, cardId: c!.id };
}

describe("利用者の分離", () => {
	it("他人の単語帳と札は 404 になり、変更もできない", async () => {
		const other = await seedOther();
		const get = (p: string) => SELF.fetch(`http://localhost${p}`);
		expect((await get(`/api/decks?today=${TODAY}`)).status).toBe(200);
		expect(((await (await get(`/api/decks?today=${TODAY}`)).json()) as { decks: unknown[] }).decks).toHaveLength(0);
		expect((await get(`/api/decks/${other.deckId}`)).status).toBe(404);
		expect((await get(`/api/decks/${other.deckId}/cards`)).status).toBe(404);
		expect((await get(`/api/decks/${other.deckId}/cards/export`)).status).toBe(404);
		expect((await get(`/api/decks/${other.deckId}/study?today=${TODAY}`)).status).toBe(404);
		const patch = await SELF.fetch(`http://localhost/api/cards/${other.cardId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ front: "改ざん" }),
		});
		expect(patch.status).toBe(404);
		expect((await SELF.fetch(`http://localhost/api/cards/${other.cardId}`, { method: "DELETE" })).status).toBe(404);
		expect((await SELF.fetch(`http://localhost/api/decks/${other.deckId}`, { method: "DELETE" })).status).toBe(404);
		const review = await SELF.fetch(`http://localhost/api/cards/${other.cardId}/review`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ rating: "good", today: TODAY }),
		});
		expect(review.status).toBe(404);
	});
});
