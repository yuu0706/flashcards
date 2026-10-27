import { describe, expect, it } from "vitest";

import { buildChoices, buildHint, CHEER_WORDS, CHOICE_COUNT, pickSide, rollCheer, shuffle, sides } from "../src/lib/quiz";

/** 乱数を固定する。常に 0 を返すと shuffle は末尾から順に先頭へ回す */
const zero = () => 0;

describe("buildChoices", () => {
	it("正解を含む 4 つを返し、自前の誤答を他の札より優先する", () => {
		const r = buildChoices("正", ["誤1", "誤2"], ["他1", "他2", "他3", "正"], zero);
		expect(r).toHaveLength(CHOICE_COUNT);
		expect(r).toContain("正");
		expect(r).toContain("誤1");
		expect(r).toContain("誤2");
		expect(r!.filter((x) => x.startsWith("他"))).toHaveLength(1);
	});

	it("正解と同じ裏は誤答に使わず、重複も除く", () => {
		const r = buildChoices("正", ["正"], ["正", "正", "他1"], zero);
		expect(r).toEqual(expect.arrayContaining(["正", "他1"]));
		expect(r).toHaveLength(2);
	});

	it("誤答の候補が無ければ null", () => {
		expect(buildChoices("正", [], ["正"], zero)).toBeNull();
	});

	it("shuffle は要素を増減させない", () => {
		expect(shuffle([1, 2, 3, 4], zero).sort()).toEqual([1, 2, 3, 4]);
	});
});

describe("buildHint", () => {
	it("補足があればそれを返す", () => {
		expect(buildHint("TCP", " 第4層 ")).toBe("第4層");
	});
	it("補足が無ければ頭文字と文字数", () => {
		expect(buildHint("伝送制御プロトコル", "")).toBe("答えは「伝」で始まる 9 文字です");
		expect(buildHint("A", "")).toBe("答えは 1 文字です");
	});
});

describe("出題の向き", () => {
	const card = { front: "TCP", back: "伝送制御プロトコル" };
	it("forward は表を問いに、reverse は裏を問いにする", () => {
		expect(sides(card, "forward")).toEqual({ question: "TCP", answer: "伝送制御プロトコル" });
		expect(sides(card, "reverse")).toEqual({ question: "伝送制御プロトコル", answer: "TCP" });
	});
	it("pickSide は forward / reverse をそのまま返し、mixed は乱数で決める", () => {
		expect(pickSide("forward", () => 0.9)).toBe("forward");
		expect(pickSide("reverse", () => 0.1)).toBe("reverse");
		expect(pickSide("mixed", () => 0.2)).toBe("forward");
		expect(pickSide("mixed", () => 0.7)).toBe("reverse");
	});
});

describe("rollCheer", () => {
	it("節目では乱数に関係なく大きく出る", () => {
		expect(rollCheer(5, () => 0.99)).toEqual({ text: "5 連続正解", big: true });
		expect(rollCheer(10, () => 0.99)?.big).toBe(true);
	});
	it("乱数が 0.18 以上なら出ない。0.03 未満は大きく、0.18 未満は小さく", () => {
		expect(rollCheer(2, () => 0.5)).toBeNull();
		expect(rollCheer(2, () => 0.18)).toBeNull();
		expect(rollCheer(2, () => 0.1)).toEqual({ text: CHEER_WORDS[0], big: false });
		expect(rollCheer(2, () => 0.01)).toEqual({ text: CHEER_WORDS[0], big: true });
	});
});
