import { useApi } from "./lib/api";
import { match, useLocation } from "./lib/router";
import { today } from "./lib/today";
import type { Me } from "./lib/types";
import { Icon, Link } from "./components/ui";
import { DeckPage } from "./pages/Deck";
import { DeckSettings } from "./pages/DeckSettings";
import { HelpPage } from "./pages/Help";
import { Home } from "./pages/Home";
import { ImportPage } from "./pages/Import";
import { Study } from "./pages/Study";
import { EmptyState, ErrorState } from "./components/ui";

function Routes({ path }: { path: string }) {
	let p: Record<string, string> | null;
	if (path === "/") return <Home />;
	if (path === "/help/tsv") return <HelpPage />;
	if ((p = match("/decks/:id", path))) return <DeckPage id={p["id"]!} />;
	if ((p = match("/decks/:id/study", path))) return <Study id={p["id"]!} />;
	if ((p = match("/decks/:id/import", path))) return <ImportPage id={p["id"]!} />;
	if ((p = match("/decks/:id/settings", path))) return <DeckSettings id={p["id"]!} />;
	return (
		<EmptyState
			title="ページが見つかりません"
			action={
				<Link className="btn btn--secondary" to="/">
					単語帳の一覧に戻る
				</Link>
			}
		/>
	);
}

export default function App() {
	const { path } = useLocation();
	const me = useApi<Me>(`/api/me?today=${today()}&t=${path}`);

	return (
		<>
			<div className="topbar">
				<Link className="topbar__brand" to="/">
					単語帳
				</Link>
				<span className="topbar__spacer" />
				{me.data ? (
					<span className="topbar__meta">
						{me.data.streakDays > 0 ? (
							<span className="streak" title={`${me.data.streakDays} 日連続で学習しています`}>
								<Icon name="flame" />
								{me.data.streakDays} 日連続
							</span>
						) : null}
						今日 {me.data.reviewedToday} 回 ・ {me.data.email}
					</span>
				) : null}
			</div>
			{me.error ? <ErrorState message={me.error} onRetry={me.reload} /> : <Routes key={path} path={path} />}
		</>
	);
}
