import { describe, expect, it } from "vitest";

import { parseTsv, toTsv } from "../src/lib/tsv";

describe("parseTsv", () => {
	it("表・裏・補足・タグを読む。見出し行は読み飛ばす", () => {
		const r = parseTsv("表\t裏\t補足\tタグ\nTCP\t伝送制御プロトコル\t第4層\tネットワーク,基礎\n");
		expect(r.cards).toEqual([{ front: "TCP", back: "伝送制御プロトコル", note: "第4層", tags: ["ネットワーク", "基礎"], choices: [] }]);
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

	it("5列目の選択肢は | で区切る。セルの \\n は改行に戻す", () => {
		const r = parseTsv("次のうち正しいのは\\nどれか\t正解\t\t\t誤1|誤2｜誤1");
		expect(r.cards[0]).toEqual({ front: "次のうち正しいのは\nどれか", back: "正解", note: "", tags: [], choices: ["誤1", "誤2"] });
	});
});

describe("toTsv", () => {
	it("書き出したものを読み戻せる", () => {
		const cards = [
			{ front: "OSI 参照モデル", back: "7階層", note: "改行\nあり", tags: ["a", "b"], choices: ["5階層", "4階層"] },
			{ front: "F", back: "B", note: "", tags: [], choices: [] },
		];
		const text = toTsv(cards);
		expect(text.split("\n")[0]).toBe("表\t裏\t補足\tタグ\t選択肢");
		expect(text.split("\n")[1]).toBe("OSI 参照モデル\t7階層\t改行\\nあり\ta,b\t5階層|4階層");
		const back = parseTsv(text);
		expect(back.cards).toEqual(cards);
	});
});
