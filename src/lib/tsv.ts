/**
 * 札の一括取り込み・書き出しに使う TSV。
 * 列は 表 / 裏 / 補足 / タグ(カンマ区切り) / 選択肢(四択の誤答。| 区切り)。先頭行が見出しなら読み飛ばす。
 * スプレッドシートから貼り付けた文字列をそのまま受け取る前提で、引用符は解釈しない。
 * セルの中の改行は「\n」の2文字で表す(文章問題の問題文や、選択肢を並べた裏に使う)。
 */

export type CardInput = { front: string; back: string; note: string; tags: string[]; choices: string[] };

export const TSV_HEADER = ["表", "裏", "補足", "タグ", "選択肢"] as const;

export function parseTags(raw: string): string[] {
	return splitList(raw, /[,、]/);
}

/** 四択の誤答。| か ｜ で区切る */
export function parseChoices(raw: string): string[] {
	return splitList(raw, /[|｜]/);
}

function splitList(raw: string, sep: RegExp): string[] {
	const seen = new Set<string>();
	for (const t of raw.split(sep)) {
		const s = t.trim();
		if (s) seen.add(s);
	}
	return [...seen];
}

/** セルの「\n」を改行に戻す */
function unescapeCell(s: string): string {
	return s.replace(/\\n/g, "\n").trim();
}

export type ParseResult = { cards: CardInput[]; skipped: number };

export function parseTsv(text: string): ParseResult {
	const cards: CardInput[] = [];
	let skipped = 0;
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	lines.forEach((line, i) => {
		if (!line.trim()) return;
		const cols = line.split("\t").map((c) => c.trim());
		if (i === 0 && cols[0] === TSV_HEADER[0] && cols[1] === TSV_HEADER[1]) return;
		const front = unescapeCell(cols[0] ?? "");
		const back = unescapeCell(cols[1] ?? "");
		if (!front || !back) {
			skipped++;
			return;
		}
		cards.push({ front, back, note: unescapeCell(cols[2] ?? ""), tags: parseTags(cols[3] ?? ""), choices: parseChoices(cols[4] ?? "") });
	});
	return { cards, skipped };
}

function cell(s: string): string {
	// タブは列の区切りと衝突するので空白に、改行は「\n」の2文字にする(読み戻せる)
	return s.replace(/\t+/g, " ").replace(/\r?\n/g, "\\n");
}

export function toTsv(cards: CardInput[]): string {
	const rows = [TSV_HEADER.join("\t")];
	for (const c of cards) rows.push([cell(c.front), cell(c.back), cell(c.note), c.tags.join(","), c.choices.map(cell).join("|")].join("\t"));
	return rows.join("\n") + "\n";
}
