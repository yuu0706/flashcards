/**
 * 間隔反復の計算(SM-2 を3段階の評価に簡略化したもの)。
 * 純粋関数にして、DB や日時の取得に依存させない(test/scheduler.test.ts で固定する)。
 */

export const RATINGS = ["again", "hard", "good"] as const;
export type Rating = (typeof RATINGS)[number];

export const CARD_STATES = ["new", "learning", "review"] as const;
export type CardState = (typeof CARD_STATES)[number];

/** 出題の形式。recall は答えを思い出して自己評価、choice は四択 */
export const DECK_MODES = ["recall", "choice"] as const;
export type DeckMode = (typeof DECK_MODES)[number];

export type Schedule = {
	state: CardState;
	/** 次に出す日(YYYY-MM-DD)。new の間は null */
	due: string | null;
	intervalDays: number;
	ease: number;
	reps: number;
	lapses: number;
};

export const INITIAL_SCHEDULE: Schedule = { state: "new", due: null, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 };

const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 365;

/** YYYY-MM-DD に日数を足す。タイムゾーンの影響を受けないよう UTC で計算する */
export function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	const t = Date.UTC(y!, m! - 1, d! + days);
	return new Date(t).toISOString().slice(0, 10);
}

export function isDateString(s: unknown): s is string {
	return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/**
 * 評価を受けて次の予定を返す。
 *   again: 覚え直し。当日中にもう一度出す(learning)。ease を下げる
 *   hard:  あやふや。間隔を少しだけ伸ばす。ease を少し下げる
 *   good:  覚えた。1日 → 6日 → 前回 × ease と伸ばす(SM-2 の既定)
 */
export function schedule(prev: Schedule, rating: Rating, today: string): Schedule {
	if (rating === "again") {
		return {
			state: "learning",
			due: today,
			intervalDays: 0,
			ease: Math.max(MIN_EASE, prev.ease - 0.2),
			reps: 0,
			lapses: prev.state === "review" ? prev.lapses + 1 : prev.lapses,
		};
	}

	let intervalDays: number;
	let ease = prev.ease;
	if (rating === "hard") {
		ease = Math.max(MIN_EASE, prev.ease - 0.15);
		intervalDays = prev.reps === 0 ? 1 : Math.max(prev.intervalDays + 1, Math.round(prev.intervalDays * 1.2));
	} else if (prev.reps === 0) {
		intervalDays = 1;
	} else if (prev.reps === 1) {
		intervalDays = 6;
	} else {
		intervalDays = Math.round(prev.intervalDays * prev.ease);
	}
	intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(1, intervalDays));

	return {
		state: "review",
		due: addDays(today, intervalDays),
		intervalDays,
		ease: Math.round(ease * 100) / 100,
		reps: prev.reps + 1,
		lapses: prev.lapses,
	};
}
