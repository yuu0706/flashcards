/**
 * 四択の選択肢とヒントを、手元の札だけから作る純粋な処理。
 * AI は使わない。誤答は、札に自前の選択肢があればそれを優先し、足りない分を同じ単語帳の他の札の裏から補う。
 */

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

/**
 * 選択肢を作る。正解を必ず含み、全部で CHOICE_COUNT 個まで。
 * 候補が正解のほかに 1 つも無ければ null(四択にできないので記述で出す)
 */
export function buildChoices(card: { back: string; choices: string[] }, pool: string[], rand: Rand = Math.random): string[] | null {
	const correct = card.back;
	const own = card.choices.filter((c) => c !== correct);
	const others = shuffle(
		pool.filter((b) => b !== correct && !own.includes(b)),
		rand,
	);
	const wrong = [...own, ...others].slice(0, CHOICE_COUNT - 1);
	if (wrong.length === 0) return null;
	return shuffle([correct, ...wrong], rand);
}

/**
 * 記述のときのヒント。補足があればそれを、無ければ答えの頭文字と長さを返す。
 * 頭文字は答えの 1 文字目(全角・半角を問わない。サロゲートペアは 1 文字として数える)
 */
export function buildHint(card: { back: string; note: string }): string {
	if (card.note.trim()) return card.note.trim();
	const chars = [...card.back.trim()];
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
