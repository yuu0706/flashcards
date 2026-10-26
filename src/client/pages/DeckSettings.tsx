import { useCallback, useState } from "react";

import { api, useApi } from "../lib/api";
import { useAutosave, saveStatusText } from "../lib/autosave";
import { navigate } from "../lib/router";
import type { DeckMode } from "../../lib/scheduler";
import type { Deck } from "../lib/types";
import { ConfirmDialog, ErrorState, InlineError, Link, PageHeader } from "../components/ui";

type Draft = { name: string; newPerDay: string; mode: DeckMode };

export function DeckSettings({ id }: { id: string }) {
	const deck = useApi<{ deck: Deck }>(`/api/decks/${id}`);
	return deck.error ? (
		<ErrorState message={deck.error} onRetry={deck.reload} />
	) : deck.data ? (
		<Form deck={deck.data.deck} />
	) : (
		<PageHeader crumb={<Link to="/">単語帳</Link>} title="設定" />
	);
}

function Form({ deck }: { deck: Deck }) {
	const [draft, setDraft] = useState<Draft>({ name: deck.name, newPerDay: String(deck.newPerDay), mode: deck.mode });
	const [confirm, setConfirm] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const n = Number(draft.newPerDay);
	const valid = draft.name.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 1000;

	const save = useCallback(async (d: Draft) => {
		await api(`/api/decks/${deck.id}`, { method: "PATCH", json: { name: d.name, newPerDay: Number(d.newPerDay), mode: d.mode } });
	}, [deck.id]);
	const auto = useAutosave(draft, save, { enabled: valid });

	async function remove() {
		setConfirm(false);
		try {
			await api(`/api/decks/${deck.id}`, { method: "DELETE" });
			navigate("/");
		} catch (e) {
			setActionError(e instanceof Error ? e.message : String(e));
		}
	}

	return (
		<>
			<PageHeader
				crumb={
					<>
						<Link to="/">単語帳</Link> / <Link to={`/decks/${deck.id}`}>{deck.name}</Link>
					</>
				}
				title="設定"
				badges={<span className="muted small">{saveStatusText(auto.status)}</span>}
			/>
			<div className="page-body">
				<form className="form" onSubmit={(e) => e.preventDefault()}>
					<div className="field">
						<label htmlFor="name">単語帳の名前（必須）</label>
						<input id="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => void auto.flush()} maxLength={100} />
					</div>
					<div className="field">
						<label htmlFor="new-per-day">1日に新しく出す札の数</label>
						<p className="field__help">0 から 1000 まで。復習が溜まりすぎるときは減らしてください。</p>
						<input
							id="new-per-day"
							type="number"
							inputMode="numeric"
							min={0}
							max={1000}
							value={draft.newPerDay}
							onChange={(e) => setDraft({ ...draft, newPerDay: e.target.value })}
							onBlur={() => void auto.flush()}
							aria-invalid={!valid}
						/>
					</div>
					<div className="field">
						<label htmlFor="mode">出題の形式</label>
						<p className="field__help">四択の誤答は、札に書いた選択肢か、同じ単語帳の他の札の裏から作ります。学習の画面でも切り替えられます。</p>
						<select id="mode" value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DeckMode })} onBlur={() => void auto.flush()}>
							<option value="recall">記述（答えを思い出して自己評価）</option>
							<option value="choice">四択</option>
						</select>
					</div>
					<InlineError message={auto.error} />
				</form>
				<div className="section section--danger">
					<h2>取り消せない操作</h2>
					<p className="field__help">単語帳を削除すると、中の札と学習の記録もすべて消えます。</p>
					<div className="row">
						<button className="btn btn--danger" type="button" onClick={() => setConfirm(true)}>
							この単語帳を削除する
						</button>
					</div>
					<InlineError message={actionError} />
				</div>
			</div>
			<ConfirmDialog
				open={confirm}
				title="この単語帳を削除しますか"
				body={`「${deck.name}」と中の札をすべて削除します。削除すると元に戻せません。`}
				confirmLabel="削除する"
				onConfirm={() => void remove()}
				onCancel={() => setConfirm(false)}
			/>
		</>
	);
}
