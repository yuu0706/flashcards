import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";

import { reviews } from "../../db/schema";
import { isDateString } from "../../lib/scheduler";
import { requireContext } from "../context";
import type { AppEnv } from "../env";
import { ValidationError } from "../input";

export const meRoutes = new Hono<AppEnv>();

/** ログイン中の利用者と、今日の復習の件数 */
meRoutes.get("/", async (c) => {
	const { actor, db } = requireContext(c);
	const today = c.req.query("today");
	if (!isDateString(today)) throw new ValidationError("today は YYYY-MM-DD で指定してください");
	const [row] = await db
		.select({ reviewedToday: count(reviews.id) })
		.from(reviews)
		.where(and(eq(reviews.userId, actor.id), eq(reviews.reviewedOn, today)));
	return c.json({ email: actor.email, reviewedToday: row?.reviewedToday ?? 0 });
});
