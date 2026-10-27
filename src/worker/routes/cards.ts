import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";

import { cards, decks, reviews } from "../../db/schema";
import { isDateString, RATINGS, schedule, type Rating } from "../../lib/scheduler";
import { parseTsv, toTsv } from "../../lib/tsv";
import { requireContext } from "../context";
import type { AppEnv } from "../env";
import { jsonBody, str, strArray, ValidationError } from "../input";

export const cardRoutes = new Hono<AppEnv>();

const CARD_COLUMNS = {
	id: cards.id,
	deckId: cards.deckId,
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
	lastReviewedAt: cards.lastReviewedAt,
	createdAt: cards.createdAt,
	updatedAt: cards.updatedAt,
};

const LIMITS = { front: 2000, back: 4000, note: 4000, tag: 50, tags: 20, choice: 500, choices: 5, importRows: 2000, importBytes: 4 * 1024 * 1024 };

type Ctx = Context<AppEnv>;

async function ownDeckId(c: Ctx, deckId: string): Promise<string | null> {
	const { actor, db } = requireContext(c);
	const rows = await db
		.select({ id: decks.id })
		.from(decks)
		.where(and(eq(decks.id, deckId), eq(decks.userId, actor.id)))
		.limit(1);
	return rows[0]?.id ?? null;
}

async function ownCard(c: Ctx, id: string) {
	const { actor, db } = requireContext(c);
	const rows = await db
		.select(CARD_COLUMNS)
		.from(cards)
		.where(and(eq(cards.id, id), eq(cards.userId, actor.id)))
		.limit(1);
	return rows[0] ?? null;
}

function cardInput(body: Record<string, unknown>, partial: boolean) {
	const out: Partial<{ front: string; back: string; note: string; tags: string[]; choices: string[] }> = {};
	if (!partial || "front" in body) out.front = str(body["front"], "表", { max: LIMITS.front, required: true });
	if (!partial || "back" in body) out.back = str(body["back"], "裏", { max: LIMITS.back, required: true });
	if (!partial || "note" in body) out.note = str(body["note"], "補足", { max: LIMITS.note });
	if (!partial || "tags" in body) out.tags = strArray(body["tags"], "タグ", { maxItems: LIMITS.tags, maxLen: LIMITS.tag });
	if (!partial || "choices" in body) out.choices = strArray(body["choices"], "選択肢", { maxItems: LIMITS.choices, maxLen: LIMITS.choice });
	return out;
}

/** 単語帳の札の一覧。q で表・裏・補足・タグを部分一致で絞る */
cardRoutes.get("/decks/:deckId/cards", async (c) => {
	const { db } = requireContext(c);
	const deckId = await ownDeckId(c, c.req.param("deckId"));
	if (!deckId) return c.json({ error: "単語帳が見つかりません" }, 404);
	const q = (c.req.query("q") ?? "").trim();
	const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
	const rows = await db
		.select(CARD_COLUMNS)
		.from(cards)
		.where(
			and(
				eq(cards.deckId, deckId),
				q
					? or(
							like(cards.front, pattern),
							like(cards.back, pattern),
							like(cards.note, pattern),
							sql`${cards.tags} LIKE ${pattern} ESCAPE '\\'`,
						)
					: undefined,
			),
		)
		.orderBy(desc(cards.createdAt))
		.limit(2000);
	return c.json({ cards: rows });
});

cardRoutes.post("/decks/:deckId/cards", async (c) => {
	const { actor, db } = requireContext(c);
	const deckId = await ownDeckId(c, c.req.param("deckId"));
	if (!deckId) return c.json({ error: "単語帳が見つかりません" }, 404);
	const input = cardInput(await jsonBody(c.req.raw), false);
	const inserted = await db
		.insert(cards)
		.values({ deckId, userId: actor.id, front: input.front!, back: input.back!, note: input.note ?? "", tags: input.tags ?? [], choices: input.choices ?? [] })
		.returning(CARD_COLUMNS);
	return c.json({ card: inserted[0] }, 201);
});

/** TSV の一括取り込み。本文は text/plain の TSV そのもの */
cardRoutes.post("/decks/:deckId/cards/import", async (c) => {
	const { actor, db } = requireContext(c);
	const deckId = await ownDeckId(c, c.req.param("deckId"));
	if (!deckId) return c.json({ error: "単語帳が見つかりません" }, 404);
	// 行数の上限より先に本文の大きさで止める(巨大な本文を全部読んで分解しない)
	const declared = Number(c.req.header("Content-Length") ?? 0);
	if (declared > LIMITS.importBytes) throw new ValidationError("一度に取り込めるのは 4 MB までです");
	const text = await c.req.text();
	if (new TextEncoder().encode(text).length > LIMITS.importBytes) throw new ValidationError("一度に取り込めるのは 4 MB までです");
	const { cards: parsed, skipped } = parseTsv(text);
	if (parsed.length === 0) throw new ValidationError("取り込める行がありません。1列目に表、2列目に裏をタブ区切りで入れてください");
	if (parsed.length > LIMITS.importRows) throw new ValidationError(`一度に取り込めるのは${LIMITS.importRows}行までです`);
	for (const p of parsed) {
		if (p.front.length > LIMITS.front || p.back.length > LIMITS.back || p.note.length > LIMITS.note) {
			throw new ValidationError("1つの札の文字数が上限を超えています");
		}
		if (p.choices.length > LIMITS.choices || p.choices.some((x) => x.length > LIMITS.choice)) {
			throw new ValidationError(`選択肢は${LIMITS.choices}件まで、1件${LIMITS.choice}文字以内にしてください`);
		}
	}
	// 同じ表の札が既にあれば、裏・補足・タグ・選択肢を書き換える(学習の進み具合は保つ)。
	// 見本の誤答や補足を直して取り込み直すときに、札を消して作り直さずに済ませるため。同じ表が複数あれば作成順の先頭だけ
	const existing = await db
		.select({ id: cards.id, front: cards.front })
		.from(cards)
		.where(eq(cards.deckId, deckId))
		.orderBy(asc(cards.createdAt));
	const idByFront = new Map<string, string>();
	for (const row of existing) if (!idByFront.has(row.front)) idByFront.set(row.front, row.id);

	// 本番の D1 は1つの SQL に結び付けられる値が 100 個までのため、複数行をまとめた INSERT は使えない。
	// 1行ずつの文を batch で1回の往復にまとめる(手元の SQLite はこの制限が無く、テストでは気付けない)
	const now = new Date().toISOString();
	const BATCH = 100;
	let inserted = 0;
	let updated = 0;
	// 取り込みの中で同じ表が重なったときは、後の行で前の行を上書きする
	const seen = new Set<string>();
	for (let i = 0; i < parsed.length; i += BATCH) {
		const statements = parsed.slice(i, i + BATCH).map((p, j) => {
			const fields = { back: p.back, note: p.note, tags: p.tags.slice(0, LIMITS.tags), choices: p.choices };
			const id = idByFront.get(p.front);
			if (id) {
				updated++;
				return db.update(cards).set({ ...fields, updatedAt: now }).where(eq(cards.id, id));
			}
			if (seen.has(p.front)) {
				updated++;
				return db.update(cards).set({ ...fields, updatedAt: now }).where(and(eq(cards.deckId, deckId), eq(cards.front, p.front)));
			}
			seen.add(p.front);
			inserted++;
			return db.insert(cards).values({
				deckId,
				userId: actor.id,
				front: p.front,
				...fields,
				// 作成順(= 取り込みの行順)を保つため、ミリ秒を1ずつずらす
				createdAt: new Date(Date.parse(now) + i + j).toISOString(),
			});
		});
		await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
	}
	return c.json({ inserted, updated, skipped }, 201);
});

/** TSV の書き出し。スプレッドシートに貼り付けられる形 */
cardRoutes.get("/decks/:deckId/cards/export", async (c) => {
	const { db } = requireContext(c);
	const deckId = await ownDeckId(c, c.req.param("deckId"));
	if (!deckId) return c.json({ error: "単語帳が見つかりません" }, 404);
	const rows = await db
		.select({ front: cards.front, back: cards.back, note: cards.note, tags: cards.tags, choices: cards.choices })
		.from(cards)
		.where(eq(cards.deckId, deckId))
		.orderBy(asc(cards.createdAt));
	return c.body(toTsv(rows), 200, {
		"Content-Type": "text/tab-separated-values; charset=utf-8",
		"Content-Disposition": `attachment; filename="cards-${deckId.slice(0, 8)}.tsv"`,
	});
});

cardRoutes.patch("/cards/:id", async (c) => {
	const { db } = requireContext(c);
	const card = await ownCard(c, c.req.param("id"));
	if (!card) return c.json({ error: "札が見つかりません" }, 404);
	const input = cardInput(await jsonBody(c.req.raw), true);
	const updated = await db
		.update(cards)
		.set({ ...input, updatedAt: new Date().toISOString() })
		.where(eq(cards.id, card.id))
		.returning(CARD_COLUMNS);
	return c.json({ card: updated[0] });
});

cardRoutes.delete("/cards/:id", async (c) => {
	const { db } = requireContext(c);
	const card = await ownCard(c, c.req.param("id"));
	if (!card) return c.json({ error: "札が見つかりません" }, 404);
	await db.delete(cards).where(eq(cards.id, card.id));
	return c.body(null, 204);
});

/** 学習の進み具合を最初に戻す(未学習にする) */
cardRoutes.post("/cards/:id/reset", async (c) => {
	const { db } = requireContext(c);
	const card = await ownCard(c, c.req.param("id"));
	if (!card) return c.json({ error: "札が見つかりません" }, 404);
	const updated = await db
		.update(cards)
		.set({ state: "new", due: null, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, lastReviewedAt: null, updatedAt: new Date().toISOString() })
		.where(eq(cards.id, card.id))
		.returning(CARD_COLUMNS);
	return c.json({ card: updated[0] });
});

/** 評価を記録して次の予定を決める */
cardRoutes.post("/cards/:id/review", async (c) => {
	const { actor, db } = requireContext(c);
	const card = await ownCard(c, c.req.param("id"));
	if (!card) return c.json({ error: "札が見つかりません" }, 404);
	const body = await jsonBody(c.req.raw);
	const rating = body["rating"];
	if (!RATINGS.includes(rating as Rating)) throw new ValidationError("評価は again / hard / good のいずれかで指定してください");
	const today = body["today"];
	if (!isDateString(today)) throw new ValidationError("today は YYYY-MM-DD で指定してください");

	const next = schedule(card, rating as Rating, today);
	const now = new Date().toISOString();
	const [updated] = await db.batch([
		db
			.update(cards)
			.set({ ...next, lastReviewedAt: now, updatedAt: now })
			.where(eq(cards.id, card.id))
			.returning(CARD_COLUMNS),
		db.insert(reviews).values({
			cardId: card.id,
			userId: actor.id,
			rating: rating as Rating,
			reviewedOn: today,
			intervalBefore: card.intervalDays,
			intervalAfter: next.intervalDays,
		}),
	]);
	return c.json({ card: updated[0] });
});
