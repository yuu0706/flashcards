import { describe, expect, it } from "vitest";

import { maskEmail } from "../src/lib/mask";

describe("maskEmail", () => {
	it("ローカル部とドメインを先頭 1 文字だけ残して伏せる", () => {
		expect(maskEmail("yamada@example.com")).toBe("y***@e***.com");
		expect(maskEmail("a.b@mail.example.co.jp")).toBe("a***@m***.jp");
	});
	it("@ が無い・先頭にある文字列も落ちずに伏せる", () => {
		expect(maskEmail("user")).toBe("u***");
		expect(maskEmail("@example.com")).toBe("@***");
		expect(maskEmail("")).toBe("***");
	});
});
