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

/**
 * 選択肢を作る。正解を必ず含み、全部で CHOICE_COUNT 個まで。
 * own は札に書いた自前の誤答(裏を答える向きでだけ使う。表を答える向きでは他の札の表だけから作る)。
 * 候補が正解のほかに 1 つも無ければ null(四択にできないので記述で出す)
 */
export function buildChoices(answer: string, own: string[], pool: string[], rand: Rand = Math.random): string[] | null {
	const mine = own.filter((c) => c !== answer);
	const others = shuffle(
		pool.filter((b) => b !== answer && !mine.includes(b)),
		rand,
	);
	const wrong = [...mine, ...others].slice(0, CHOICE_COUNT - 1);
	if (wrong.length === 0) return null;
	return shuffle([answer, ...wrong], rand);
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
