import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, useApi } from "../lib/api";
import { useAutosave, saveStatusText } from "../lib/autosave";
import { navigate, useLocation } from "../lib/router";
import { today } from "../lib/today";
import type { Card, Deck } from "../lib/types";
import { setUi } from "../lib/ui-state";
import { ConfirmDialog, EmptyState, ErrorState, Icon, InlineError, Link, PageHeader, SkeletonRows, StateBadge, Toast } from "../components/ui";

type Draft = { front: string; back: string; note: string; tags: string };

function toDraft(c: Card): Draft {
	return { front: c.front, back: c.back, note: c.note, tags: c.tags.join(", ") };
}

function fromDraft(d: Draft) {
	return { front: d.front, back: d.back, note: d.note, tags: d.tags.split(/[,、]/).map((s) => s.trim()).filter(Boolean) };
}

export function DeckPage({ id }: { id: string }) {
	const t = today();
	const deck = useApi<{ deck: Deck }>(`/api/decks/${id}`);
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
		return () => clearTimeout(timer);
	}, [q]);
	const list = useApi<{ cards: Card[] }>(`/api/decks/${id}/cards${debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ""}`);

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	const clearToast = useCallback(() => setToast(null), []);

	// 取り込みの画面から戻ってきたときの通知。URL に残さない
	const { query } = useLocation();
	const imported = query.get("imported");
	useEffect(() => {
		if (imported === null) return;
		setToast(`${imported} 件の札を取り込みました`);
		navigate(`/decks/${id}`, { replace: true });
	}, [imported, id]);

	// 狭い画面で詳細だけを出すかどうかは <html data-panel> の1か所で決める
	const panelOpen = creating || selectedId !== null;
	useEffect(() => {
		setUi("panel", panelOpen ? "open" : "closed");
		return () => setUi("panel", "closed");
	}, [panelOpen]);

	// details のメニューは外側を押しても閉じないため、文書全体のクリックで閉じる
	const menuRef = useRef<HTMLDetailsElement>(null);
	useEffect(() => {
		function onClick(e: MouseEvent) {
			const el = menuRef.current;
			if (el?.open && !el.contains(e.target as Node)) el.open = false;
		}
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, []);

	const cards = list.data?.cards ?? [];
	const selected = useMemo(() => cards.find((c) => c.id === selectedId) ?? null, [cards, selectedId]);

	function select(cardId: string) {
		setCreating(false);
		// 開いている行をもう一度押したら閉じる(選択は保たず、一覧へ戻す)
		setSelectedId((cur) => (cur === cardId ? null : cardId));
	}

	function close() {
		setSelectedId(null);
		setCreating(false);
	}

	const deckName = deck.data?.deck.name ?? "…";

	return (
		<>
			<PageHeader
				crumb={<Link to="/">単語帳</Link>}
				title={deckName}
				actions={
					<>
						<details className="menu" ref={menuRef}>
							<summary className="btn btn--secondary btn--icon" aria-label="その他の操作">
								<Icon name="more" />
							</summary>
							<div className="menu__list" role="menu" onClick={() => menuRef.current && (menuRef.current.open = false)}>
								<Link to={`/decks/${id}/import`} className="menu__item">
									<Icon name="upload" />
									TSV から取り込む
								</Link>
								<a href={`/api/decks/${id}/cards/export`} className="menu__item" download>
									<Icon name="download" />
									TSV に書き出す
								</a>
								<Link to={`/decks/${id}/settings`} className="menu__item">
									<Icon name="settings" />
									単語帳の設定
								</Link>
							</div>
						</details>
						<button
							className="btn btn--primary"
							type="button"
							onClick={() => {
								setSelectedId(null);
								setCreating(true);
							}}
						>
							<Icon name="plus" />
							札を追加
						</button>
					</>
				}
			/>
			{deck.error ? (
				<ErrorState message={deck.error} onRetry={deck.reload} />
			) : (
				<div className="split">
					<section className="split__list" aria-label="札の一覧">
						<div className="page-body">
							<div className="search">
								<label htmlFor="card-search" className="visually-hidden">
									札を検索
								</label>
								<input id="card-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="表・裏・補足・タグで絞り込む" />
								<Link to={`/decks/${id}/study`} className="btn btn--secondary">
									<Icon name="book-open" />
									学習する
								</Link>
							</div>
						</div>
						{list.error ? (
							<ErrorState message={list.error} onRetry={list.reload} />
						) : (
							<div className="table-wrap">
								<table className="table">
									<thead>
										<tr>
											<th>表</th>
											<th>裏</th>
											<th>状態</th>
											<th className="col-optional">次回</th>
										</tr>
									</thead>
									{list.loading && !list.data ? (
										<SkeletonRows cols={4} />
									) : cards.length === 0 ? (
										<tbody>
											<tr>
												<td colSpan={4}>
													{debouncedQ ? (
														<EmptyState title="絞り込みに当てはまる札がありません" />
													) : (
														<EmptyState
															title="まだ札がありません"
															action={
																<Link to={`/decks/${id}/import`} className="btn btn--secondary">
																	TSV から取り込む
																</Link>
															}
														/>
													)}
												</td>
											</tr>
										</tbody>
									) : (
										<tbody>
											{cards.map((c) => (
												<tr key={c.id} data-clickable="" aria-selected={c.id === selectedId} onClick={() => select(c.id)}>
													<td className="cell-text">{c.front}</td>
													<td className="cell-text">{c.back}</td>
													<td className="nowrap">
														<StateBadge state={c.state} due={c.due} today={t} />
													</td>
													<td className="nowrap col-optional">{c.due ?? "—"}</td>
												</tr>
											))}
										</tbody>
									)}
								</table>
							</div>
						)}
					</section>
					<section className="split__detail" aria-label="札の詳細">
						{creating ? (
							<NewCard
								deckId={id}
								onCreated={() => {
									setToast("札を登録しました");
									list.reload();
								}}
								onClose={close}
							/>
						) : selected ? (
							<CardEditor
								key={selected.id}
								card={selected}
								today={t}
								onChanged={list.reload}
								onDeleted={() => {
									setToast("札を削除しました");
									close();
									list.reload();
								}}
								onClose={close}
							/>
						) : (
							<EmptyState title="一覧から札を選ぶと、ここで編集できます" />
						)}
					</section>
				</div>
			)}
			<Toast message={toast} onDone={clearToast} />
		</>
	);
}

function DraftFields({ draft, setDraft, onBlur, idPrefix }: { draft: Draft; setDraft: (d: Draft) => void; onBlur?: () => void; idPrefix: string }) {
	return (
		<>
			<div className="field">
				<label htmlFor={`${idPrefix}-front`}>表（必須）</label>
				<textarea id={`${idPrefix}-front`} value={draft.front} onChange={(e) => setDraft({ ...draft, front: e.target.value })} onBlur={onBlur} maxLength={2000} />
			</div>
			<div className="field">
				<label htmlFor={`${idPrefix}-back`}>裏（必須）</label>
				<textarea id={`${idPrefix}-back`} value={draft.back} onChange={(e) => setDraft({ ...draft, back: e.target.value })} onBlur={onBlur} maxLength={4000} />
			</div>
			<div className="field">
				<label htmlFor={`${idPrefix}-note`}>補足</label>
				<textarea id={`${idPrefix}-note`} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} onBlur={onBlur} maxLength={4000} />
			</div>
			<div className="field">
				<label htmlFor={`${idPrefix}-tags`}>タグ</label>
				<p className="field__help">読点かカンマで区切ります。</p>
				<input id={`${idPrefix}-tags`} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} onBlur={onBlur} placeholder="例）ネットワーク, 第4層" />
			</div>
		</>
	);
}

function NewCard({ deckId, onCreated, onClose }: { deckId: string; onCreated: () => void; onClose: () => void }) {
	const [draft, setDraft] = useState<Draft>({ front: "", back: "", note: "", tags: "" });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit() {
		setBusy(true);
		setError(null);
		try {
			await api(`/api/decks/${deckId}/cards`, { method: "POST", json: fromDraft(draft) });
			// 続けて登録しやすいよう、表と裏だけ空にしてタグは残す
			setDraft((d) => ({ ...d, front: "", back: "", note: "" }));
			onCreated();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="section">
			<div className="section__head">
				<h2>新しい札</h2>
				<div className="row">
					<button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>
						閉じる
					</button>
					<button className="btn btn--primary btn--sm" type="button" disabled={busy || !draft.front.trim() || !draft.back.trim()} onClick={() => void submit()}>
						登録する
					</button>
				</div>
			</div>
			<form
				className="form"
				onSubmit={(e) => {
					e.preventDefault();
					void submit();
				}}
			>
				<DraftFields draft={draft} setDraft={setDraft} idPrefix="new" />
				<InlineError message={error} />
			</form>
		</div>
	);
}

function CardEditor({
	card,
	today: t,
	onChanged,
	onDeleted,
	onClose,
}: {
	card: Card;
	today: string;
	onChanged: () => void;
	onDeleted: () => void;
	onClose: () => void;
}) {
	const [draft, setDraft] = useState<Draft>(() => toDraft(card));
	const [confirm, setConfirm] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const valid = draft.front.trim() !== "" && draft.back.trim() !== "";

	const save = useCallback(
		async (d: Draft) => {
			await api(`/api/cards/${card.id}`, { method: "PATCH", json: fromDraft(d) });
			onChanged();
		},
		[card.id, onChanged],
	);
	const auto = useAutosave(draft, save, { enabled: valid });

	async function remove() {
		setConfirm(false);
		try {
			await api(`/api/cards/${card.id}`, { method: "DELETE" });
			onDeleted();
		} catch (e) {
			setActionError(e instanceof Error ? e.message : String(e));
		}
	}

	async function reset() {
		try {
			await api(`/api/cards/${card.id}/reset`, { method: "POST" });
			onChanged();
		} catch (e) {
			setActionError(e instanceof Error ? e.message : String(e));
		}
	}

	return (
		<div className="section">
			<div className="section__head">
				<h2>
					札の編集 <span className="muted small">{saveStatusText(auto.status)}</span>
				</h2>
				<button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>
					<Icon name="arrow-left" />
					一覧へ
				</button>
			</div>
			<form className="form" onSubmit={(e) => e.preventDefault()}>
				<DraftFields draft={draft} setDraft={setDraft} onBlur={() => void auto.flush()} idPrefix={`c-${card.id}`} />
				{!valid ? <p className="field__error">表と裏を入力すると保存されます。</p> : null}
				<InlineError message={auto.error} />
			</form>
			<dl className="props">
				<dt>状態</dt>
				<dd>
					<StateBadge state={card.state} due={card.due} today={t} />
				</dd>
				<dt>次回</dt>
				<dd>{card.due ?? "—"}</dd>
				<dt>間隔</dt>
				<dd>{card.intervalDays} 日</dd>
				<dt>正答の連続</dt>
				<dd>{card.reps} 回</dd>
				<dt>忘れた回数</dt>
				<dd>{card.lapses} 回</dd>
			</dl>
			<div className="section section--danger">
				<h2>取り消せない操作</h2>
				<div className="row">
					<button className="btn btn--secondary" type="button" onClick={() => void reset()} disabled={card.state === "new"}>
						学習の進み具合を戻す
					</button>
					<button className="btn btn--danger" type="button" onClick={() => setConfirm(true)}>
						この札を削除する
					</button>
				</div>
				<InlineError message={actionError} />
			</div>
			<ConfirmDialog
				open={confirm}
				title="この札を削除しますか"
				body={`「${card.front.slice(0, 40)}」を削除します。削除すると元に戻せません。`}
				confirmLabel="削除する"
				onConfirm={() => void remove()}
				onCancel={() => setConfirm(false)}
			/>
		</div>
	);
}
