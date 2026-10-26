import { describe, expect, it } from "vitest";

import { parseTsv, toTsv } from "../src/lib/tsv";

describe("parseTsv", () => {
	it("表・裏・補足・タグを読む。見出し行は読み飛ばす", () => {
		const r = parseTsv("表\t裏\t補足\tタグ\nTCP\t伝送制御プロトコル\t第4層\tネットワーク,基礎\n");
		expect(r.cards).toEqual([{ front: "TCP", back: "伝送制御プロトコル", note: "第4層", tags: ["ネットワーク", "基礎"] }]);
		expect(r.skipped).toBe(0);
	});

	it("裏が無い行は読み飛ばして数える。CRLF と空行を許す", () => {
		const r = parseTsv("A\tB\r\n\r\nC\r\nD\tE\t\t\r\n");
		expect(r.cards.map((c) => c.front)).toEqual(["A", "D"]);
		expect(r.skipped).toBe(1);
	});

	it("タグは読点でも区切れ、重複を除く", () => {
		const r = parseTsv("A\tB\t\tx、y,x");
		expect(r.cards[0]?.tags).toEqual(["x", "y"]);
	});
});

describe("toTsv", () => {
	it("書き出したものを読み戻せる", () => {
		const cards = [
			{ front: "OSI 参照モデル", back: "7階層", note: "改行\nあり", tags: ["a", "b"] },
			{ front: "F", back: "B", note: "", tags: [] },
		];
		const text = toTsv(cards);
		expect(text.split("\n")[0]).toBe("表\t裏\t補足\tタグ");
		const back = parseTsv(text);
		expect(back.cards).toEqual([{ ...cards[0], note: "改行 あり" }, cards[1]]);
	});
});
