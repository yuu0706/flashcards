import { useCallback, useState, type FormEvent } from "react";

import { api, useApi } from "../lib/api";
import { navigate } from "../lib/router";
import { today } from "../lib/today";
import type { DeckSummary } from "../lib/types";
import { Badge, EmptyState, ErrorState, Icon, InlineError, Link, PageHeader, SkeletonRows, Toast } from "../components/ui";

export function Home() {
	const t = today();
	const decks = useApi<{ decks: DeckSummary[] }>(`/api/decks?today=${t}`);
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [toast, setToast] = useState<string | null>(null);
	const clearToast = useCallback(() => setToast(null), []);

	async function submit(e: FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			await api("/api/decks", { method: "POST", json: { name } });
			setName("");
			setAdding(false);
			setToast("単語帳を登録しました");
			decks.reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	}

	const rows = decks.data?.decks ?? [];

	return (
		<>
			<PageHeader
				title="単語帳の一覧"
				actions={
					<button className="btn btn--primary" type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
						<Icon name="plus" />
						単語帳を追加
					</button>
				}
			/>
			<div className="page-body">
				{adding ? (
					<form className="form" onSubmit={submit}>
						<div className="field">
							<label htmlFor="deck-name">単語帳の名前（必須）</label>
							<input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="例）応用情報 ネットワーク" autoFocus />
							<InlineError message={error} />
						</div>
						<div className="row">
							<button className="btn btn--primary" type="submit" disabled={submitting || !name.trim()}>
								登録する
							</button>
							<button className="btn btn--secondary" type="button" onClick={() => setAdding(false)}>
								キャンセル
							</button>
						</div>
					</form>
				) : null}

				{decks.error ? (
					<ErrorState message={decks.error} onRetry={decks.reload} />
				) : (
					<div className="table-wrap">
						<table className="table">
							<thead>
								<tr>
									<th>名前</th>
									<th className="num col-optional">今日</th>
									<th className="num col-optional">未学習</th>
									<th className="num col-optional">合計</th>
									<th>
										<span className="visually-hidden">操作</span>
									</th>
								</tr>
							</thead>
							{decks.loading && !decks.data ? (
								<SkeletonRows cols={5} />
							) : rows.length === 0 ? (
								<tbody>
									<tr>
										<td colSpan={5}>
											<EmptyState
												title="まだ単語帳がありません"
												action={
													<button className="btn btn--secondary" type="button" onClick={() => setAdding(true)}>
														単語帳を追加
													</button>
												}
											/>
										</td>
									</tr>
								</tbody>
							) : (
								<tbody>
									{rows.map((d) => (
										<tr key={d.id} data-clickable="" onClick={() => navigate(`/decks/${d.id}`)}>
											<td>
												<span className="deck-cell">
													<Link to={`/decks/${d.id}`} className="cell-text">
														{d.name}
													</Link>
													{/* 狭い画面では数の列を畳むため、今日の分を名前の横に出す */}
													<span className="col-narrow-only">
														<Badge tone={d.due + d.fresh > 0 ? "accent" : "neutral"}>今日 {d.due + d.fresh}</Badge>
													</span>
												</span>
											</td>
											<td className="num col-optional">{d.due}</td>
											<td className="num col-optional">{d.fresh}</td>
											<td className="num col-optional">{d.total}</td>
											<td className="row-actions" onClick={(e) => e.stopPropagation()}>
												<Link to={`/decks/${d.id}/study`} className={`btn btn--sm ${d.due + d.fresh > 0 ? "btn--primary" : "btn--secondary"}`}>
													<Icon name="book-open" />
													学習する
												</Link>
											</td>
										</tr>
									))}
								</tbody>
							)}
						</table>
					</div>
				)}
			</div>
			<Toast message={toast} onDone={clearToast} />
		</>
	);
}
