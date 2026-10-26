import { useCallback, useEffect, useState } from "react";

import type { Rating } from "../../lib/scheduler";
import { api, useApi } from "../lib/api";
import { today } from "../lib/today";
import type { Deck, StudyCard } from "../lib/types";
import { Badge, EmptyState, ErrorState, Icon, InlineError, Link, PageHeader } from "../components/ui";

type Session = { queue: StudyCard[]; done: number; revealed: boolean };

const RATING_LABEL: Record<Rating, string> = { again: "忘れた", hard: "あやふや", good: "覚えた" };

export function Study({ id }: { id: string }) {
	const t = today();
	const loaded = useApi<{ deck: Deck; cards: StudyCard[] }>(`/api/decks/${id}/study?today=${t}`);
	const [session, setSession] = useState<Session | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 読み込んだ札で学習を始める。再読み込みしても進み具合は保つ
	useEffect(() => {
		if (loaded.data && session === null) setSession({ queue: loaded.data.cards, done: 0, revealed: false });
	}, [loaded.data, session]);

	const current = session?.queue[0] ?? null;

	const reveal = useCallback(() => setSession((s) => (s ? { ...s, revealed: true } : s)), []);

	const rate = useCallback(
		async (rating: Rating) => {
			if (!current || busy) return;
			setBusy(true);
			setError(null);
			try {
				const res = await api<{ card: StudyCard }>(`/api/cards/${current.id}/review`, { method: "POST", json: { rating, today: t } });
				setSession((s) => {
					if (!s) return s;
					const rest = s.queue.slice(1);
					// 「忘れた」は今日のうちにもう一度出す(列の末尾へ)
					const queue = rating === "again" ? [...rest, { ...current, ...res.card }] : rest;
					return { queue, done: s.done + 1, revealed: false };
				});
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setBusy(false);
			}
		},
		[current, busy, t],
	);

	// キーボード: Space で答え、1/2/3 で評価
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (!session?.revealed && (e.key === " " || e.key === "Enter")) {
				e.preventDefault();
				reveal();
			} else if (session?.revealed && ["1", "2", "3"].includes(e.key)) {
				void rate((["again", "hard", "good"] as const)[Number(e.key) - 1]!);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [session?.revealed, reveal, rate]);

	const deckName = loaded.data?.deck.name ?? "…";
	const remaining = session?.queue.length ?? 0;

	return (
		<>
			<PageHeader
				crumb={<Link to={`/decks/${id}`}>{deckName}</Link>}
				title="学習"
				badges={session ? <Badge tone={remaining > 0 ? "accent" : "success"}>残り {remaining}</Badge> : null}
				actions={
					<Link to={`/decks/${id}`} className="btn btn--secondary btn--icon" ariaLabel="学習をやめて札の一覧に戻る">
						<Icon name="x" />
					</Link>
				}
			/>
			{loaded.error ? (
				<ErrorState message={loaded.error} onRetry={loaded.reload} />
			) : !session ? (
				<div className="study__card">
					<span className="skeleton" />
				</div>
			) : !current ? (
				<EmptyState
					icon="check"
					title={session.done > 0 ? `今日の学習は終わりました（${session.done} 回）` : "今日の学習する札はありません"}
					action={
						<Link to="/" className="btn btn--secondary">
							単語帳の一覧に戻る
						</Link>
					}
				/>
			) : (
				<>
					<div className="study">
						<div className="study__card" key={current.id + String(session.done)}>
							<div className="study__meta">
								<Badge tone={current.state === "new" ? "neutral" : current.state === "learning" ? "danger" : "success"}>
									{current.state === "new" ? "未学習" : current.state === "learning" ? "覚え直し" : `${current.intervalDays} 日ぶり`}
								</Badge>
								{current.tags.map((tag) => (
									<Badge key={tag} tone="neutral">
										{tag}
									</Badge>
								))}
							</div>
							<p className="study__front">{current.front}</p>
							{session.revealed ? (
								<>
									<p className="study__back">{current.back}</p>
									{current.note ? <p className="study__note">{current.note}</p> : null}
								</>
							) : null}
							<InlineError message={error} />
						</div>
					</div>
					{session.revealed ? (
						<div className="action-bar action-bar--grid" role="region" aria-label="評価">
							<button className="btn btn--danger" type="button" disabled={busy} onClick={() => void rate("again")}>
								{RATING_LABEL.again}
							</button>
							<button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void rate("hard")}>
								{RATING_LABEL.hard}
							</button>
							<button className="btn btn--primary" type="button" disabled={busy} onClick={() => void rate("good")}>
								{RATING_LABEL.good}
							</button>
						</div>
					) : (
						<div className="action-bar" role="region" aria-label="操作">
							<span className="action-bar__status">答えを思い浮かべてから開いてください</span>
							<button className="btn btn--primary" type="button" onClick={reveal}>
								答えを見る
							</button>
						</div>
					)}
				</>
			)}
		</>
	);
}
