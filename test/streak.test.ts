import { describe, expect, it } from "vitest";

import { streakDays } from "../src/lib/streak";

describe("streakDays", () => {
	it("今日を含めて途切れず続いた日数", () => {
		expect(streakDays(["2026-10-27", "2026-10-26", "2026-10-25"], "2026-10-27")).toBe(3);
	});
	it("今日まだ無くても昨日まで続いていれば数える", () => {
		expect(streakDays(["2026-10-26", "2026-10-25"], "2026-10-27")).toBe(2);
	});
	it("昨日も無ければ 0。途中が抜けたらそこで止まる", () => {
		expect(streakDays(["2026-10-25"], "2026-10-27")).toBe(0);
		expect(streakDays(["2026-10-27", "2026-10-25"], "2026-10-27")).toBe(1);
		expect(streakDays([], "2026-10-27")).toBe(0);
	});
	it("月をまたいでも数える", () => {
		expect(streakDays(["2026-11-01", "2026-10-31", "2026-10-30"], "2026-11-01")).toBe(3);
	});
});
