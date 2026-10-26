import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { reviews } from "../../db/schema";
import { isDateString } from "../../lib/scheduler";
import { streakDays } from "../../lib/streak";
import { requireContext } from "../context";
import type { AppEnv } from "../env";
import { ValidationError } from "../input";

export const meRoutes = new Hono<AppEnv>();

/** ログイン中の利用者と、今日の復習の件数、連続で学習した日数 */
meRoutes.get("/", async (c) => {
	const { actor, db } = requireContext(c);
	const today = c.req.query("today");
	if (!isDateString(today)) throw new ValidationError("today は YYYY-MM-DD で指定してください");
	const [row] = await db
		.select({ reviewedToday: count(reviews.id) })
		.from(reviews)
		.where(and(eq(reviews.userId, actor.id), eq(reviews.reviewedOn, today)));
	// 連続日数は学習した日の一覧から数える。1年以上続いても 400 日分で頭打ち
	const days = await db
		.select({ day: reviews.reviewedOn })
		.from(reviews)
		.where(eq(reviews.userId, actor.id))
		.groupBy(reviews.reviewedOn)
		.orderBy(desc(reviews.reviewedOn))
		.limit(400);
	return c.json({ email: actor.email, reviewedToday: row?.reviewedToday ?? 0, streakDays: streakDays(days.map((d) => d.day), today) });
});
