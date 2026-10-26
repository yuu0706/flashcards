/**
 * 札の一括取り込み・書き出しに使う TSV。
 * 列は 表 / 裏 / 補足 / タグ(カンマ区切り)。先頭行が見出しなら読み飛ばす。
 * スプレッドシートから貼り付けた文字列をそのまま受け取る前提で、引用符は解釈しない。
 */

export type CardInput = { front: string; back: string; note: string; tags: string[] };

export const TSV_HEADER = ["表", "裏", "補足", "タグ"] as const;

export function parseTags(raw: string): string[] {
	const seen = new Set<string>();
	for (const t of raw.split(/[,、]/)) {
		const s = t.trim();
		if (s) seen.add(s);
	}
	return [...seen];
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
		const front = cols[0] ?? "";
		const back = cols[1] ?? "";
		if (!front || !back) {
			skipped++;
			return;
		}
		cards.push({ front, back, note: cols[2] ?? "", tags: parseTags(cols[3] ?? "") });
	});
	return { cards, skipped };
}

function cell(s: string): string {
	// タブと改行は列の区切りと衝突するので空白に置き換える
	return s.replace(/[\t\r\n]+/g, " ");
}

export function toTsv(cards: CardInput[]): string {
	const rows = [TSV_HEADER.join("\t")];
	for (const c of cards) rows.push([cell(c.front), cell(c.back), cell(c.note), c.tags.join(",")].join("\t"));
	return rows.join("\n") + "\n";
}
