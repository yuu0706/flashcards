import { useMemo, useState } from "react";

import { parseTsv } from "../../lib/tsv";
import { api, useApi } from "../lib/api";
import { navigate } from "../lib/router";
import type { Deck } from "../lib/types";
import { ErrorState, InlineError, Link, PageHeader } from "../components/ui";

export function ImportPage({ id }: { id: string }) {
	const deck = useApi<{ deck: Deck }>(`/api/decks/${id}`);
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const preview = useMemo(() => parseTsv(text), [text]);

	async function submit() {
		setBusy(true);
		setError(null);
		try {
			const r = await api<{ inserted: number; skipped: number }>(`/api/decks/${id}/cards/import`, {
				method: "POST",
				headers: { "Content-Type": "text/plain; charset=utf-8" },
				body: text,
			});
			navigate(`/decks/${id}?imported=${r.inserted}`);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<PageHeader
				crumb={
					<>
						<Link to="/">単語帳</Link> / <Link to={`/decks/${id}`}>{deck.data?.deck.name ?? "…"}</Link>
					</>
				}
				title="TSV から取り込む"
				actions={
					<button className="btn btn--primary" type="button" disabled={busy || preview.cards.length === 0} onClick={() => void submit()}>
						{preview.cards.length > 0 ? `${preview.cards.length} 件を取り込む` : "取り込む"}
					</button>
				}
			/>
			{deck.error ? (
				<ErrorState message={deck.error} onRetry={deck.reload} />
			) : (
				<div className="page-body">
					<form className="form" onSubmit={(e) => e.preventDefault()}>
						<div className="field">
							<label htmlFor="tsv">スプレッドシートからコピーした行</label>
							<p className="field__help">
								列の順は「表、裏、補足、タグ、選択肢」です。補足とタグと選択肢は省けます。<Link to="/help/tsv">TSV の形式と見本</Link>を確認してください。
							</p>
							<textarea
								id="tsv"
								className="textarea--tall"
								value={text}
								onChange={(e) => setText(e.target.value)}
								placeholder={"TCP\t伝送制御プロトコル\t第4層\tネットワーク"}
								spellCheck={false}
							/>
							{preview.skipped > 0 ? <p className="field__error">{preview.skipped} 行は表か裏が無いため取り込みません。</p> : null}
							<InlineError message={error} />
						</div>
					</form>
				</div>
			)}
		</>
	);
}
