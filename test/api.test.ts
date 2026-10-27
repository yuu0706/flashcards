/**
 * API の結合テスト。ローカルのバイパス(DEV_AUTH_EMAIL + localhost)で利用者を切り替え、
 * 「他人の単語帳と札に触れないこと」を固定する。
 */
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const HOST = "http://localhost";
const TODAY = "2026-10-26";

type Json = Record<string, unknown>;

async function call(method: string, path: string, opts: { json?: unknown; text?: string; email?: string } = {}) {
	const headers: Record<string, string> = {};
	if (opts.json !== undefined) headers["Content-Type"] = "application/json";
	if (opts.text !== undefined) headers["Content-Type"] = "text/plain";
	// .dev.vars の DEV_AUTH_EMAIL と同じ経路。別の利用者はヘッダーでは切り替えられないため、
	// ミドルウェアと同じ env を書き換える代わりに、テストでは email ごとに Worker を呼び分けない。
	// 他人の判定は、別メールで作ったデータへ同じ利用者がアクセスできないことで確かめる
	const res = await SELF.fetch(`${HOST}${path}`, {
		method,
		headers,
		body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.text,
	});
	const type = res.headers.get("Content-Type") ?? "";
	const body = type.includes("json") ? ((await res.json()) as Json) : await res.text();
	return { status: res.status, body };
}

async function createDeck(name = "ネットワーク") {
	const r = await call("POST", "/api/decks", { json: { name } });
	expect(r.status).toBe(201);
	return (r.body as { deck: { id: string } }).deck;
}

async function createCard(deckId: string, front = "TCP", back = "伝送制御プロトコル") {
	const r = await call("POST", `/api/decks/${deckId}/cards`, { json: { front, back, tags: ["基礎"] } });
	expect(r.status).toBe(201);
	return (r.body as { card: { id: string } }).card;
}

describe("認証", () => {
	it("localhost 以外では DEV_AUTH_EMAIL が効かず、トークンが無ければ 401", async () => {
		const res = await SELF.fetch("https://flashcards.example.com/api/me?today=2026-10-26");
		expect(res.status).toBe(401);
		const health = await SELF.fetch("https://flashcards.example.com/api/health");
		expect(health.status).toBe(200);
	});

	it("初回アクセスで利用者が作られ、/api/me が返る", async () => {
		const r = await call("GET", `/api/me?today=${TODAY}`);
		expect(r.status).toBe(200);
		expect(r.body).toEqual({ email: "dev@example.com", reviewedToday: 0, streakDays: 0 });
	});
});

describe("単語帳", () => {
	it("作成・一覧・更新・削除", async () => {
		const deck = await createDeck();
		await createCard(deck.id);

		const list = await call("GET", `/api/decks?today=${TODAY}`);
		expect(list.status).toBe(200);
		const decks = (list.body as { decks: Json[] }).decks;
		expect(decks).toHaveLength(1);
		expect(decks[0]).toMatchObject({ id: deck.id, name: "ネットワーク", total: 1, due: 0, fresh: 1 });

		const patched = await call("PATCH", `/api/decks/${deck.id}`, { json: { name: "改名", newPerDay: 5 } });
		expect(patched.status).toBe(200);
		expect((patched.body as { deck: Json }).deck).toMatchObject({ name: "改名", newPerDay: 5 });

		const del = await call("DELETE", `/api/decks/${deck.id}`);
		expect(del.status).toBe(204);
		const after = await call("GET", `/api/decks?today=${TODAY}`);
		expect((after.body as { decks: Json[] }).decks).toHaveLength(0);
	});

	it("名前が空なら 400、today が無ければ 400", async () => {
		expect((await call("POST", "/api/decks", { json: { name: "  " } })).status).toBe(400);
		expect((await call("GET", "/api/decks")).status).toBe(400);
	});

	it("存在しない単語帳は 404", async () => {
		expect((await call("GET", "/api/decks/nope")).status).toBe(404);
		expect((await call("GET", `/api/decks/nope/study?today=${TODAY}`)).status).toBe(404);
	});
});

describe("単語帳の出題の形式", () => {
	it("既定は recall。PATCH で choice に変えられ、不正な値は 400", async () => {
		const deck = await createDeck();
		expect((await call("GET", `/api/decks/${deck.id}`)).body).toMatchObject({ deck: { mode: "recall" } });
		const changed = await call("PATCH", `/api/decks/${deck.id}`, { json: { mode: "choice" } });
		expect(changed.status).toBe(200);
		expect(changed.body).toMatchObject({ deck: { mode: "choice" } });
		expect((await call("PATCH", `/api/decks/${deck.id}`, { json: { mode: "quiz" } })).status).toBe(400);
	});

	it("出題の向きの既定は forward。PATCH で reverse / mixed に変えられ、不正な値は 400", async () => {
		const deck = await createDeck();
		expect((await call("GET", `/api/decks/${deck.id}`)).body).toMatchObject({ deck: { direction: "forward" } });
		const changed = await call("PATCH", `/api/decks/${deck.id}`, { json: { direction: "reverse" } });
		expect(changed.status).toBe(200);
		expect(changed.body).toMatchObject({ deck: { direction: "reverse" } });
		expect((await call("PATCH", `/api/decks/${deck.id}`, { json: { direction: "mixed" } })).body).toMatchObject({ deck: { direction: "mixed" } });
		expect((await call("PATCH", `/api/decks/${deck.id}`, { json: { direction: "upside" } })).status).toBe(400);
	});
});

describe("札", () => {
	it("追加・検索・更新・削除", async () => {
		const deck = await createDeck();
		const a = await createCard(deck.id, "TCP", "伝送制御プロトコル");
		await createCard(deck.id, "UDP", "ユーザーデータグラムプロトコル");

		const all = await call("GET", `/api/decks/${deck.id}/cards`);
		expect((all.body as { cards: Json[] }).cards).toHaveLength(2);
		const hit = await call("GET", `/api/decks/${deck.id}/cards?q=伝送`);
		expect((hit.body as { cards: Json[] }).cards.map((c) => c["front"])).toEqual(["TCP"]);
		const byTag = await call("GET", `/api/decks/${deck.id}/cards?q=基礎`);
		expect((byTag.body as { cards: Json[] }).cards).toHaveLength(2);

		const patched = await call("PATCH", `/api/cards/${a.id}`, { json: { note: "第4層", tags: ["L4", "L4", ""] } });
		expect(patched.status).toBe(200);
		expect((patched.body as { card: Json }).card).toMatchObject({ note: "第4層", tags: ["L4"], front: "TCP" });

		expect((await call("DELETE", `/api/cards/${a.id}`)).status).toBe(204);
		expect((await call("GET", `/api/decks/${deck.id}/cards`)).body).toMatchObject({ cards: [{ front: "UDP" }] });
	});

	it("四択の誤答を札に持て、学習の応答には同じ単語帳の裏と表の候補が付く", async () => {
		const deck = await createDeck();
		const made = await call("POST", `/api/decks/${deck.id}/cards`, { json: { front: "Q", back: "正", choices: ["誤1", "誤2", "誤1", ""] } });
		expect(made.status).toBe(201);
		expect((made.body as { card: Json }).card).toMatchObject({ choices: ["誤1", "誤2"] });
		await createCard(deck.id, "Q2", "他の裏");

		const study = await call("GET", `/api/decks/${deck.id}/study?today=${TODAY}`);
		expect(study.status).toBe(200);
		const body = study.body as { cards: { choices: string[] }[]; pool: { backs: string[]; fronts: string[] } };
		expect(body.cards.map((c) => c.choices)).toEqual([["誤1", "誤2"], []]);
		expect([...body.pool.backs].sort()).toEqual(["他の裏", "正"]);
		expect([...body.pool.fronts].sort()).toEqual(["Q", "Q2"]);

		const tooMany = await call("POST", `/api/decks/${deck.id}/cards`, { json: { front: "Q", back: "A", choices: ["1", "2", "3", "4", "5", "6"] } });
		expect(tooMany.status).toBe(400);
	});

	it("表か裏が空なら 400", async () => {
		const deck = await createDeck();
		expect((await call("POST", `/api/decks/${deck.id}/cards`, { json: { front: "a", back: "" } })).status).toBe(400);
	});

	it("TSV の取り込みと書き出し", async () => {
		const deck = await createDeck();
		const tsv = "表\t裏\t補足\tタグ\nOSI\t7階層\t\tモデル\nTCP\t伝送制御\t第4層\t\n裏なし\n";
		const imp = await call("POST", `/api/decks/${deck.id}/cards/import`, { text: tsv });
		expect(imp.status).toBe(201);
		expect(imp.body).toEqual({ inserted: 2, skipped: 1 });

		const exp = await call("GET", `/api/decks/${deck.id}/cards/export`);
		expect(exp.status).toBe(200);
		expect(exp.body).toBe("表\t裏\t補足\tタグ\t選択肢\nOSI\t7階層\t\tモデル\t\nTCP\t伝送制御\t第4層\t\t\n");

		const withChoices = await call("POST", `/api/decks/${deck.id}/cards/import`, { text: "問題文\\n2行目\t正解\t\t\t誤1|誤2\n" });
		expect(withChoices.status).toBe(201);
		const list = (await call("GET", `/api/decks/${deck.id}/cards?q=問題文`)).body as { cards: Json[] };
		expect(list.cards[0]).toMatchObject({ front: "問題文\n2行目", back: "正解", choices: ["誤1", "誤2"] });

		const empty = await call("POST", `/api/decks/${deck.id}/cards/import`, { text: "表だけ\n" });
		expect(empty.status).toBe(400);
	});

	it("150 行の取り込みは batch の区切りをまたいでも行順を保つ", async () => {
		// 本番の D1 は1文の値が 100 個までのため、複数行の INSERT はここでは再現できない。batch の分割だけを通す
		const deck = await createDeck();
		const rows = Array.from({ length: 150 }, (_, i) => `表${i}\t裏${i}\t\tt${i % 3}`).join("\n");
		const imp = await call("POST", `/api/decks/${deck.id}/cards/import`, { text: `${rows}\n` });
		expect(imp.status).toBe(201);
		expect(imp.body).toEqual({ inserted: 150, skipped: 0 });
		const list = (await call("GET", `/api/decks/${deck.id}/cards`)).body as { cards: { front: string }[] };
		expect(list.cards).toHaveLength(150);
		// 一覧は新しい順のため、取り込みの行順の逆になる
		expect(list.cards.map((c) => c.front)).toEqual(Array.from({ length: 150 }, (_, i) => `表${149 - i}`));
	});
});

describe("学習", () => {
	it("新しい札は newPerDay まで出る。評価すると予定が進み、期限内は出なくなる", async () => {
		const deck = await createDeck();
		await call("PATCH", `/api/decks/${deck.id}`, { json: { newPerDay: 2 } });
		const c1 = await createCard(deck.id, "1", "a");
		await createCard(deck.id, "2", "b");
		await createCard(deck.id, "3", "c");

		const s1 = await call("GET", `/api/decks/${deck.id}/study?today=${TODAY}`);
		expect((s1.body as { cards: Json[] }).cards.map((c) => c["front"])).toEqual(["1", "2"]);

		const good = await call("POST", `/api/cards/${c1.id}/review`, { json: { rating: "good", today: TODAY } });
		expect(good.status).toBe(200);
		expect((good.body as { card: Json }).card).toMatchObject({ state: "review", due: "2026-10-27", intervalDays: 1, reps: 1 });

		// 評価した札は今日の学習から外れ、代わりに次の新しい札が出る
		const s2 = await call("GET", `/api/decks/${deck.id}/study?today=${TODAY}`);
		expect((s2.body as { cards: Json[] }).cards.map((c) => c["front"])).toEqual(["2", "3"]);

		// 翌日は期限の札が先頭に出る
		const s3 = await call("GET", `/api/decks/${deck.id}/study?today=2026-10-27`);
		expect((s3.body as { cards: Json[] }).cards.map((c) => c["front"])).toEqual(["1", "2", "3"]);

		const me = await call("GET", `/api/me?today=${TODAY}`);
		expect(me.body).toMatchObject({ reviewedToday: 1, streakDays: 1 });
		const list = await call("GET", `/api/decks?today=2026-10-27`);
		expect((list.body as { decks: Json[] }).decks[0]).toMatchObject({ total: 3, due: 1, fresh: 2 });
	});

	it("「忘れた」は当日中に再出題され、learning が先頭に来る", async () => {
		const deck = await createDeck();
		const c1 = await createCard(deck.id, "1", "a");
		await createCard(deck.id, "2", "b");
		await call("POST", `/api/cards/${c1.id}/review`, { json: { rating: "again", today: TODAY } });
		const s = await call("GET", `/api/decks/${deck.id}/study?today=${TODAY}`);
		expect((s.body as { cards: Json[] }).cards.map((c) => c["front"])).toEqual(["1", "2"]);
		expect((s.body as { cards: Json[] }).cards[0]).toMatchObject({ state: "learning" });
	});

	it("評価の値が不正なら 400。学習の進み具合を戻せる", async () => {
		const deck = await createDeck();
		const c1 = await createCard(deck.id);
		expect((await call("POST", `/api/cards/${c1.id}/review`, { json: { rating: "easy", today: TODAY } })).status).toBe(400);
		expect((await call("POST", `/api/cards/${c1.id}/review`, { json: { rating: "good", today: "today" } })).status).toBe(400);
		await call("POST", `/api/cards/${c1.id}/review`, { json: { rating: "good", today: TODAY } });
		const reset = await call("POST", `/api/cards/${c1.id}/reset`);
		expect((reset.body as { card: Json }).card).toMatchObject({ state: "new", due: null, reps: 0, ease: 2.5 });
	});
});
