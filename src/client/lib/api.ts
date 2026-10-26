import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

/** /api を叩く。エラーは { error } を ApiError に変換する。401 は Access のログイン画面へ戻す */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
	const { json, ...rest } = init ?? {};
	const res = await fetch(path, {
		...rest,
		headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
		body: json !== undefined ? JSON.stringify(json) : rest.body,
		credentials: "same-origin",
	});
	if (res.status === 401) {
		// 古い Cookie をエッジが受け入れて Worker が拒否し続けると再読み込みが無限に続くため、
		// チームドメイン側のログアウト URL で Cookie を破棄する。短時間に繰り返すときはエラー表示に倒す
		let logoutUrl: string | null = null;
		try {
			logoutUrl = ((await res.json()) as { logoutUrl?: string }).logoutUrl ?? null;
		} catch {
			/* JSON でない */
		}
		const key = "flashcards:relogin-at";
		const last = Number(sessionStorage.getItem(key) ?? 0);
		if (logoutUrl && Date.now() - last > 60_000) {
			sessionStorage.setItem(key, String(Date.now()));
			location.assign(logoutUrl);
		}
		throw new ApiError(401, "ログインの有効期限が切れました。ページを再読み込みしてログインし直してください");
	}
	if (!res.ok) {
		let message = `処理できませんでした（コード: ${res.status}）`;
		try {
			const body = (await res.json()) as { error?: string };
			if (body.error) message = body.error;
		} catch {
			/* JSON でない */
		}
		throw new ApiError(res.status, message);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export type Loaded<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

type Result<T> = { key: string; data: T | null; error: string | null };

/** GET して状態を持つ。path が変わる(または reload)と再取得する。前のデータは次の取得が終わるまで残す */
export function useApi<T>(path: string | null): Loaded<T> {
	const [tick, setTick] = useState(0);
	const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: null });
	const reload = useCallback(() => setTick((t) => t + 1), []);
	const key = path === null ? "" : `${path}#${tick}`;

	useEffect(() => {
		if (path === null) return;
		let cancelled = false;
		api<T>(path)
			.then((d) => {
				if (!cancelled) setResult({ key, data: d, error: null });
			})
			.catch((e: unknown) => {
				if (!cancelled) setResult((prev) => ({ key, data: prev.data, error: e instanceof Error ? e.message : String(e) }));
			});
		return () => {
			cancelled = true;
		};
	}, [path, key]);

	const settled = result.key === key;
	return { data: result.data, error: settled ? result.error : null, loading: path !== null && !settled, reload };
}
