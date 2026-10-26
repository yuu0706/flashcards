import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * 自分用の道具の編集欄は自動で保存する(保存のボタンを置かない)。
 * 入力が止まって 800ms 後と、flush()(欄から離れたとき)に保存する
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, opts: { delay?: number; enabled: boolean }) {
	const [status, setStatus] = useState<SaveStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const latest = useRef(value);
	const lastSaved = useRef(value);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveRef = useRef(save);
	saveRef.current = save;

	const run = useCallback(async () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		const v = latest.current;
		if (JSON.stringify(v) === JSON.stringify(lastSaved.current)) return;
		setStatus("saving");
		try {
			await saveRef.current(v);
			lastSaved.current = v;
			setError(null);
			setStatus("saved");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setStatus("error");
		}
	}, []);

	useEffect(() => {
		latest.current = value;
		if (!opts.enabled) return;
		if (JSON.stringify(value) === JSON.stringify(lastSaved.current)) return;
		setStatus("dirty");
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => void run(), opts.delay ?? 800);
		return () => {
			if (timer.current) clearTimeout(timer.current);
		};
	}, [value, opts.enabled, opts.delay, run]);

	return { status, error, flush: run };
}

export function saveStatusText(s: SaveStatus): string {
	switch (s) {
		case "dirty":
			return "未保存";
		case "saving":
			return "保存しています…";
		case "saved":
			return "保存しました";
		case "error":
			return "保存できませんでした";
		default:
			return "";
	}
}
