/** 連続で学習した日数。手元の日付の一覧(YYYY-MM-DD)から数える純粋関数 */

import { addDays } from "./scheduler";

/**
 * today から遡って途切れずに学習した日数を返す。
 * 今日まだ学習していなくても、昨日まで続いていれば昨日までの日数を返す(今日の分を促す)。
 * 昨日も無ければ 0
 */
export function streakDays(reviewedDays: Iterable<string>, today: string): number {
	const days = new Set(reviewedDays);
	let cursor = days.has(today) ? today : addDays(today, -1);
	let n = 0;
	while (days.has(cursor)) {
		n++;
		cursor = addDays(cursor, -1);
	}
	return n;
}
