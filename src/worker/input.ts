/** 入力検証。失敗は ValidationError で投げ、index.ts の onError が 400 に変換する */
export class ValidationError extends Error {}

export function str(v: unknown, name: string, opts: { max: number; required?: boolean }): string {
	if (v === undefined || v === null) {
		if (opts.required) throw new ValidationError(`${name}を入力してください`);
		return "";
	}
	if (typeof v !== "string") throw new ValidationError(`${name}は文字列で指定してください`);
	const s = v.trim();
	if (opts.required && !s) throw new ValidationError(`${name}を入力してください`);
	if (s.length > opts.max) throw new ValidationError(`${name}は${opts.max}文字以内で入力してください`);
	return s;
}

export function int(v: unknown, name: string, opts: { min: number; max: number; fallback?: number }): number {
	if (v === undefined || v === null) {
		if (opts.fallback !== undefined) return opts.fallback;
		throw new ValidationError(`${name}を指定してください`);
	}
	const n = typeof v === "number" ? v : Number(v);
	if (!Number.isInteger(n) || n < opts.min || n > opts.max) {
		throw new ValidationError(`${name}は${opts.min}から${opts.max}までの整数で指定してください`);
	}
	return n;
}

export function strArray(v: unknown, name: string, opts: { maxItems: number; maxLen: number }): string[] {
	if (v === undefined || v === null) return [];
	if (!Array.isArray(v)) throw new ValidationError(`${name}は配列で指定してください`);
	const out: string[] = [];
	for (const item of v) {
		if (typeof item !== "string") throw new ValidationError(`${name}は文字列の配列で指定してください`);
		const s = item.trim();
		if (!s) continue;
		if (s.length > opts.maxLen) throw new ValidationError(`${name}の各項目は${opts.maxLen}文字以内にしてください`);
		if (!out.includes(s)) out.push(s);
	}
	if (out.length > opts.maxItems) throw new ValidationError(`${name}は${opts.maxItems}件以内にしてください`);
	return out;
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		throw new ValidationError("リクエストの本文を読み取れませんでした");
	}
	if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("リクエストの本文の形式が正しくありません");
	return body as Record<string, unknown>;
}
