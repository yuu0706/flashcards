import { describe, expect, it } from "vitest";

import { addDays, INITIAL_SCHEDULE, schedule } from "../src/lib/scheduler";

const TODAY = "2026-10-26";

describe("addDays", () => {
	it("月末をまたいで足せる", () => {
		expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
	});
});

describe("schedule", () => {
	it("新しい札を「覚えた」にすると翌日に出る", () => {
		const s = schedule(INITIAL_SCHEDULE, "good", TODAY);
		expect(s).toMatchObject({ state: "review", due: "2026-10-27", intervalDays: 1, reps: 1, ease: 2.5 });
	});

	it("2回目の「覚えた」は6日後、3回目は間隔 × ease", () => {
		const s1 = schedule(INITIAL_SCHEDULE, "good", TODAY);
		const s2 = schedule(s1, "good", "2026-10-27");
		expect(s2).toMatchObject({ due: "2026-11-02", intervalDays: 6, reps: 2 });
		const s3 = schedule(s2, "good", "2026-11-02");
		expect(s3.intervalDays).toBe(15);
		expect(s3.due).toBe("2026-11-17");
	});

	it("「忘れた」は当日中に再出題し、ease を下げる", () => {
		const s1 = schedule(INITIAL_SCHEDULE, "good", TODAY);
		const s2 = schedule(s1, "again", "2026-10-27");
		expect(s2).toMatchObject({ state: "learning", due: "2026-10-27", intervalDays: 0, reps: 0, ease: 2.3, lapses: 1 });
	});

	it("新しい札の「忘れた」は lapses を増やさない", () => {
		const s = schedule(INITIAL_SCHEDULE, "again", TODAY);
		expect(s.lapses).toBe(0);
		expect(s.state).toBe("learning");
	});

	it("「あやふや」は間隔を少しだけ伸ばし ease を少し下げる", () => {
		const s1 = schedule(INITIAL_SCHEDULE, "hard", TODAY);
		expect(s1).toMatchObject({ intervalDays: 1, ease: 2.35, reps: 1 });
		const base = { ...s1, intervalDays: 10, reps: 3 };
		const s2 = schedule(base, "hard", TODAY);
		expect(s2.intervalDays).toBe(12);
		expect(s2.ease).toBe(2.2);
	});

	it("ease は 1.3 を下回らず、間隔は 365 日を超えない", () => {
		let s = { ...INITIAL_SCHEDULE, ease: 1.35, reps: 1 };
		s = schedule(s, "again", TODAY);
		expect(s.ease).toBe(1.3);
		const long = { ...INITIAL_SCHEDULE, state: "review" as const, intervalDays: 300, ease: 2.5, reps: 5 };
		expect(schedule(long, "good", TODAY).intervalDays).toBe(365);
	});
});
