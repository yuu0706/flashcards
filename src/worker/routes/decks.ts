import { and, asc, count, eq, isNull, lte, or, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";

import { cards, decks } from "../../db/schema";
import { DECK_DIRECTIONS, DECK_MODES, isDateString, type DeckDirection, type DeckMode } from "../../lib/scheduler";
import { requireContext } from "../context";
import type { AppEnv } from "../env";
import { int, jsonBody, str, ValidationError } from "../input";

export const deckRoutes = new Hono<AppEnv>();

const DECK_COLUMNS = { id: decks.id, name: decks.name, newPerDay: decks.newPerDay, mode: decks.mode, direction: decks.direction, createdAt: decks.createdAt, updatedAt: decks.updatedAt };

function modeParam(v: unknown): DeckMode {
	if (typeof v === "string" && (DECK_MODES as readonly string[]).includes(v)) return v as DeckMode;
	throw new ValidationError("出題の形式は recall か choice で指定してください");
}

function directionParam(v: unknown): DeckDirection {
	if (typeof v === "string" && (DECK_DIRECTIONS as readonly string[]).includes(v)) return v as DeckDirection;
	throw new ValidationError("出題の向きは forward か reverse か mixed で指定してください");
}

function todayParam(c: Context<AppEnv>): string {
	const today = c.req.query("today");
	if (!isDateString(today)) throw new ValidationError("today は YYYY-MM-DD で指定してください");
	return today;
}

/** 一覧。デッキごとに札の総数・今日の期限・未学習の数を付ける */
deckRoutes.get("/", async (c) => {
	const { actor, db } = requireContext(c);
	const today = todayParam(c);
	const rows = await db
		.select({
			...DECK_COLUMNS,
			total: count(cards.id),
			due: sql<number>`coalesce(sum(case when ${cards.state} != 'new' and ${cards.due} <= ${today} then 1 else 0 end), 0)`,
			fresh: sql<number>`coalesce(sum(case when ${cards.state} = 'new' then 1 else 0 end), 0)`,
		})
		.from(decks)
		.leftJoin(cards, eq(cards.deckId, decks.id))
		.where(eq(decks.userId, actor.id))
		.groupBy(decks.id)
		.orderBy(asc(decks.createdAt));
	return c.json({ decks: rows });
});

deckRoutes.post("/", async (c) => {
	const { actor, db } = requireContext(c);
	const body = await jsonBody(c.req.raw);
	const name = str(body["name"], "単語帳の名前", { max: 100, required: true });
	const newPerDay = int(body["newPerDay"], "1日の新しい札の数", { min: 0, max: 1000, fallback: 20 });
	const mode = "mode" in body ? modeParam(body["mode"]) : "recall";
	const direction = "direction" in body ? directionParam(body["direction"]) : "forward";
	const inserted = await db.insert(decks).values({ userId: actor.id, name, newPerDay, mode, direction }).returning(DECK_COLUMNS);
	return c.json({ deck: inserted[0] }, 201);
});

async function ownDeck(c: Context<AppEnv>, id: string) {
	const { actor, db } = requireContext(c);
	const rows = await db
		.select(DECK_COLUMNS)
		.from(decks)
		.where(and(eq(decks.id, id), eq(decks.userId, actor.id)))
		.limit(1);
	return rows[0] ?? null;
}

deckRoutes.get("/:id", async (c) => {
	const deck = await ownDeck(c, c.req.param("id"));
	if (!deck) return c.json({ error: "単語帳が見つかりません" }, 404);
	return c.json({ deck });
});

deckRoutes.patch("/:id", async (c) => {
	const { db } = requireContext(c);
	const deck = await ownDeck(c, c.req.param("id"));
	if (!deck) return c.json({ error: "単語帳が見つかりません" }, 404);
	const body = await jsonBody(c.req.raw);
	const patch: Partial<{ name: string; newPerDay: number; mode: DeckMode; direction: DeckDirection }> = {};
	if ("name" in body) patch.name = str(body["name"], "単語帳の名前", { max: 100, required: true });
	if ("newPerDay" in body) patch.newPerDay = int(body["newPerDay"], "1日の新しい札の数", { min: 0, max: 1000 });
	if ("mode" in body) patch.mode = modeParam(body["mode"]);
	if ("direction" in body) patch.direction = directionParam(body["direction"]);
	const updated = await db
		.update(decks)
		.set({ ...patch, updatedAt: new Date().toISOString() })
		.where(eq(decks.id, deck.id))
		.returning(DECK_COLUMNS);
	return c.json({ deck: updated[0] });
});

deckRoutes.delete("/:id", async (c) => {
	const { db } = requireContext(c);
	const deck = await ownDeck(c, c.req.param("id"));
	if (!deck) return c.json({ error: "単語帳が見つかりません" }, 404);
	// 札と復習の記録は外部キーの ON DELETE CASCADE で消える
	await db.delete(decks).where(eq(decks.id, deck.id));
	return c.body(null, 204);
});

const STUDY_COLUMNS = {
	id: cards.id,
	front: cards.front,
	back: cards.back,
	note: cards.note,
	tags: cards.tags,
	choices: cards.choices,
	state: cards.state,
	due: cards.due,
	intervalDays: cards.intervalDays,
	ease: cards.ease,
	reps: cards.reps,
	lapses: cards.lapses,
};

/**
 * 今日の学習の札。期限が来た札(覚え直し → 復習の順)と、上限までの新しい札を返す。
 * 並び順は固定にせず、同じ札ばかり先頭に来ないよう期限内は作成順にする
 */
deckRoutes.get("/:id/study", async (c) => {
	const { db } = requireContext(c);
	const deck = await ownDeck(c, c.req.param("id"));
	if (!deck) return c.json({ error: "単語帳が見つかりません" }, 404);
	const today = todayParam(c);

	const due = await db
		.select(STUDY_COLUMNS)
		.from(cards)
		.where(and(eq(cards.deckId, deck.id), or(eq(cards.state, "learning"), and(eq(cards.state, "review"), lte(cards.due, today)))))
		.orderBy(sql`case ${cards.state} when 'learning' then 0 else 1 end`, asc(cards.due), asc(cards.createdAt))
		.limit(500);

	const fresh =
		deck.newPerDay > 0
			? await db
					.select(STUDY_COLUMNS)
					.from(cards)
					.where(and(eq(cards.deckId, deck.id), eq(cards.state, "new"), isNull(cards.due)))
					.orderBy(asc(cards.createdAt))
					.limit(deck.newPerDay)
			: [];

	// 四択の誤答の候補。自前の選択肢が無い札は、同じ単語帳の他の札の裏(表を答える向きでは表)から画面側で選ぶ。
	// 全札を返すと大きくなるため、無作為に 200 件まで(重複は除く)
	const sample = async (column: typeof cards.back | typeof cards.front) =>
		(
			await db
				.select({ v: column })
				.from(cards)
				.where(eq(cards.deckId, deck.id))
				.groupBy(column)
				.orderBy(sql`random()`)
				.limit(200)
		).map((r) => r.v);
	const pool = { backs: await sample(cards.back), fronts: await sample(cards.front) };

	return c.json({ deck, cards: [...due, ...fresh], pool });
});
