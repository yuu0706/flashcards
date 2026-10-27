/**
 * 四択の選択肢とヒントを、手元の札だけから作る純粋な処理。
 * AI は使わない。誤答は、札に自前の選択肢があればそれを優先し、足りない分を同じ単語帳の他の札の裏から補う。
 */

import type { DeckDirection } from "./scheduler";

export const CHOICE_COUNT = 4;

/** 0 以上 1 未満の乱数を返す関数。テストでは固定の列を渡す */
export type Rand = () => number;

export function shuffle<T>(items: T[], rand: Rand = Math.random): T[] {
	const a = [...items];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

/** 札の 1 枚ぶんの出題の向き。mixed を札ごとにどちらかへ倒した結果 */
export type Side = "forward" | "reverse";

/** 単語帳の向きから、この札をどちら向きで出すかを決める。mixed は 1/2 ずつ */
export function pickSide(direction: DeckDirection, rand: Rand = Math.random): Side {
	if (direction === "mixed") return rand() < 0.5 ? "forward" : "reverse";
	return direction;
}

/** 向きに応じて、問いに見せる面と答えの面を返す */
export function sides(card: { front: string; back: string }, side: Side): { question: string; answer: string } {
	return side === "forward" ? { question: card.front, answer: card.back } : { question: card.back, answer: card.front };
}

/** 他の札から誤答を選ぶとき、正解に似た候補をこの数だけ残してから無作為に選ぶ */
const NEAR_POOL = 4;
/** 語尾の一致を見る最大の文字数 */
const SUFFIX_MAX = 4;

/** 末尾から数えて何文字が一致するか(「〜プロトコル」「〜攻撃」のような語尾の型をそろえるため) */
export function commonSuffix(a: string, b: string, max = SUFFIX_MAX): number {
	const x = [...a];
	const y = [...b];
	let n = 0;
	while (n < max && n < x.length && n < y.length && x[x.length - 1 - n] === y[y.length - 1 - n]) n++;
	return n;
}

/**
 * 正解にどれだけ似ているか(小さいほど似ている)。
 * 語尾が同じ候補を強く優先し、同じ語尾の中では長さの近い候補を優先する。
 * 正解だけが「〜プロトコル」で終わる、正解だけが長い、といった見た目の手掛かりを消すため
 */
export function similarity(answer: string, candidate: string): number {
	const suffix = commonSuffix(answer, candidate);
	const lengthGap = Math.abs([...candidate].length - [...answer].length);
	return (SUFFIX_MAX - suffix) * 100 + lengthGap;
}

/**
 * 選択肢を作る。正解を必ず含み、全部で CHOICE_COUNT 個まで。
 * own は札に書いた自前の誤答(裏を答える向きでだけ使う。表を答える向きでは他の札の表だけから作る)。
 * 他の札から補うときは、正解だけが長い(短い)と見た目で当てられるため、長さの近い候補から選ぶ。
 * 候補が正解のほかに 1 つも無ければ null(四択にできないので記述で出す)
 */
export function buildChoices(answer: string, own: string[], pool: string[], rand: Rand = Math.random): string[] | null {
	const mine = own.filter((c) => c !== answer);
	const candidates = shuffle(
		pool.filter((b) => b !== answer && !mine.includes(b)),
		rand,
	);
	// 並べ替えは安定なので、同じ点数の候補の順は shuffle の結果が残る
	const near = candidates
		.map((c, i) => ({ c, i, d: similarity(answer, c) }))
		.sort((a, b) => a.d - b.d || a.i - b.i)
		.slice(0, NEAR_POOL)
		.map((x) => x.c);
	const others = shuffle(near, rand);
	const wrong = [...mine, ...others].slice(0, CHOICE_COUNT - 1);
	if (wrong.length === 0) return null;
	return shuffle([answer, ...wrong], rand);
}

/**
 * 正解が誤答のどれよりも長い札の数。長さで当てられる札を取り込みの前に知らせる
 */
export function countLongestAnswer(cards: { back: string; choices: string[] }[]): number {
	return cards.filter((c) => c.choices.length > 0 && c.choices.every((x) => [...x].length < [...c.back].length)).length;
}

/**
 * 記述のときのヒント。補足があればそれを、無ければ答えの頭文字と長さを返す。
 * 頭文字は答えの 1 文字目(全角・半角を問わない。サロゲートペアは 1 文字として数える)
 */
export function buildHint(answer: string, note: string): string {
	if (note.trim()) return note.trim();
	const chars = [...answer.trim()];
	if (chars.length <= 1) return `答えは ${chars.length} 文字です`;
	return `答えは「${chars[0]}」で始まる ${chars.length} 文字です`;
}

/**
 * 正解したときの、たまに出る演出(2026-10-27 指示: 確率で出る方が張り合いになる)。
 * 連続正解の節目では必ず大きく出し、それ以外は正解の 3% で大きく、さらに 15% で小さく出す
 */
export const CHEER_WORDS = ["いい調子", "冴えてます", "その調子", "お見事", "完璧", "波に乗ってます"] as const;
export const CHEER_MILESTONES: ReadonlySet<number> = new Set([5, 10, 20, 30, 50, 100]);

export function rollCheer(streak: number, rand: Rand = Math.random): { text: string; big: boolean } | null {
	if (CHEER_MILESTONES.has(streak)) return { text: `${streak} 連続正解`, big: true };
	const r = rand();
	if (r >= 0.18) return null;
	const text = CHEER_WORDS[Math.floor(rand() * CHEER_WORDS.length)]!;
	return { text, big: r < 0.03 };
}
