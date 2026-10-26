/**
 * Drizzle のスキーマ定義。
 * ★ 正本は migrations/*.sql で、このファイルは追従する側。drizzle-kit は使わない。
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { CARD_STATES, RATINGS } from "../lib/scheduler";

const isoTimestampDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const idDefault = sql`(lower(hex(randomblob(16))))`;

export const users = sqliteTable("users", {
	id: text("id").primaryKey().default(idDefault),
	email: text("email").notNull().unique(),
	createdAt: text("created_at").notNull().default(isoTimestampDefault),
});

export const decks = sqliteTable(
	"decks",
	{
		id: text("id").primaryKey().default(idDefault),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		newPerDay: integer("new_per_day").notNull().default(20),
		createdAt: text("created_at").notNull().default(isoTimestampDefault),
		updatedAt: text("updated_at").notNull().default(isoTimestampDefault),
	},
	(t) => [index("decks_user_id").on(t.userId)],
);

export const cards = sqliteTable(
	"cards",
	{
		id: text("id").primaryKey().default(idDefault),
		deckId: text("deck_id")
			.notNull()
			.references(() => decks.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		front: text("front").notNull(),
		back: text("back").notNull(),
		note: text("note").notNull().default(""),
		tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
		state: text("state", { enum: CARD_STATES }).notNull().default("new"),
		due: text("due"),
		intervalDays: integer("interval_days").notNull().default(0),
		ease: real("ease").notNull().default(2.5),
		reps: integer("reps").notNull().default(0),
		lapses: integer("lapses").notNull().default(0),
		lastReviewedAt: text("last_reviewed_at"),
		createdAt: text("created_at").notNull().default(isoTimestampDefault),
		updatedAt: text("updated_at").notNull().default(isoTimestampDefault),
	},
	(t) => [index("cards_deck_due").on(t.deckId, t.state, t.due), index("cards_user_id").on(t.userId)],
);

export const reviews = sqliteTable(
	"reviews",
	{
		id: text("id").primaryKey().default(idDefault),
		cardId: text("card_id")
			.notNull()
			.references(() => cards.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		rating: text("rating", { enum: RATINGS }).notNull(),
		reviewedOn: text("reviewed_on").notNull(),
		intervalBefore: integer("interval_before").notNull(),
		intervalAfter: integer("interval_after").notNull(),
		createdAt: text("created_at").notNull().default(isoTimestampDefault),
	},
	(t) => [index("reviews_user_on").on(t.userId, t.reviewedOn)],
);
