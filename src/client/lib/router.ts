import { useEffect, useState } from "react";

/** 依存を増やさない最小のルーター。history API で遷移し、SPA フォールバックで index.html が返る前提 */
export function navigate(to: string, opts: { replace?: boolean } = {}) {
	if (opts.replace) history.replaceState(null, "", to);
	else history.pushState(null, "", to);
	window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useLocation(): { path: string; query: URLSearchParams } {
	const read = () => ({ path: location.pathname, query: new URLSearchParams(location.search) });
	const [loc, setLoc] = useState(read);
	useEffect(() => {
		const onChange = () => setLoc(read());
		window.addEventListener("popstate", onChange);
		return () => window.removeEventListener("popstate", onChange);
	}, []);
	return loc;
}

export function match(pattern: string, path: string): Record<string, string> | null {
	const p = pattern.split("/").filter(Boolean);
	const s = path.split("/").filter(Boolean);
	if (p.length !== s.length) return null;
	const params: Record<string, string> = {};
	for (let i = 0; i < p.length; i++) {
		const seg = p[i]!;
		const val = s[i]!;
		if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(val);
		else if (seg !== val) return null;
	}
	return params;
}
