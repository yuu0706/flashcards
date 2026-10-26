import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildChoices, buildHint, rollCheer } from "../../lib/quiz";
import { schedule, type DeckMode, type Rating } from "../../lib/scheduler";
import { api, useApi } from "../lib/api";
import { today } from "../lib/today";
import type { Deck, StudyCard } from "../lib/types";
import { Badge, ErrorState, Icon, InlineError, Link, PageHeader } from "../components/ui";

type Session = {
	queue: StudyCard[];
	/** 評価した回数(「忘れた」で戻ってきた札も数える) */
	done: number;
	/** 最初の列の長さ。進み具合の分母 */
	total: number;
	revealed: boolean;
	hint: boolean;
	picked: string | null;
	/** その場の成績 */
	correct: number;
	streak: number;
	bestStreak: number;
};

const RATING_LABEL: Record<Rating, string> = { again: "忘れた", hard: "あやふや", good: "覚えた" };

type Cheer = { key: number; text: string; big: boolean };
const CHOICE_LABEL = ["ア", "イ", "ウ", "エ"] as const;

/** 評価のボタンに添える「次はいつ出るか」。計算はサーバーと同じ純粋関数 */
function nextLabel(card: StudyCard, rating: Rating, t: string): string {
	const next = schedule(card, rating, t);
	if (next.state === "learning") return "今日もう一度";
	return next.intervalDays === 1 ? "明日" : `${next.intervalDays} 日後`;
}

/** 連続正解の節目。弾む大きさを変える */
function streakTone(streak: number): "neutral" | "accent" | "success" {
	if (streak >= 10) return "success";
	if (streak >= 3) return "accent";
	return "neutral";
}

/** 端末の振動(Android の Chrome など。iOS では無視される) */
function buzz(pattern: number | number[]) {
	try {
		navigator.vibrate?.(pattern);
	} catch {
		/* 対応していない端末 */
	}
}

export function Study({ id }: { id: string }) {
	const t = today();
	const loaded = useApi<{ deck: Deck; cards: StudyCard[]; pool: string[] }>(`/api/decks/${id}/study?today=${t}`);
	const [session, setSession] = useState<Session | null>(null);
	const [mode, setMode] = useState<DeckMode | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [cheer, setCheer] = useState<Cheer | null>(null);
	// 連続正解のバッジを弾ませる。数が増えたときだけ key を変えて描き直す
	const streakKey = useRef(0);

	// 演出は 1.2 秒で消す。続けて出たら新しい方に置き換わる
	useEffect(() => {
		if (!cheer) return;
		const timer = setTimeout(() => setCheer(null), 1200);
		return () => clearTimeout(timer);
	}, [cheer]);

	// 読み込んだ札で学習を始める。再読み込みしても進み具合は保つ
	useEffect(() => {
		if (loaded.data && session === null) {
			const cards = loaded.data.cards;
			setSession({ queue: cards, done: 0, total: cards.length, revealed: false, hint: false, picked: null, correct: 0, streak: 0, bestStreak: 0 });
			setMode(loaded.data.deck.mode);
		}
	}, [loaded.data, session]);

	const current = session?.queue[0] ?? null;

	// 四択の選択肢。札が変わるたびに作り直す(同じ札が戻ってきたときも並びを変える)
	const choices = useMemo(() => {
		if (!current || mode !== "choice" || !loaded.data) return null;
		return buildChoices(current, loaded.data.pool);
	}, [current, mode, loaded.data]);
	const hint = useMemo(() => (current ? buildHint(current) : ""), [current]);

	const reveal = useCallback(() => setSession((s) => (s ? { ...s, revealed: true } : s)), []);
	const showHint = useCallback(() => setSession((s) => (s ? { ...s, hint: true } : s)), []);
	const pick = useCallback(
		(choice: string) => {
			setSession((s) => {
				if (!s || s.revealed) return s;
				const ok = choice === s.queue[0]?.back;
				buzz(ok ? 30 : [60, 40, 60]);
				return { ...s, revealed: true, picked: choice };
			});
		},
		[],
	);

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
					const hit = rating !== "again";
					const streak = hit ? s.streak + 1 : 0;
					if (hit) {
						streakKey.current++;
						const rolled = rollCheer(streak);
						if (rolled) {
							setCheer({ ...rolled, key: s.done });
							buzz(rolled.big ? [30, 40, 30, 40, 60] : 30);
						}
					}
					return {
						...s,
						queue,
						done: s.done + 1,
						revealed: false,
						hint: false,
						picked: null,
						correct: s.correct + (hit ? 1 : 0),
						streak,
						bestStreak: Math.max(s.bestStreak, streak),
					};
				});
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setBusy(false);
			}
		},
		[current, busy, t],
	);

	// 出題の形式の切り替えは単語帳に保存する(スマホと PC で同じ形式になる)
	async function switchMode(next: DeckMode) {
		if (next === mode) return;
		setMode(next);
		setSession((s) => (s ? { ...s, revealed: false, hint: false, picked: null } : s));
		try {
			await api(`/api/decks/${id}`, { method: "PATCH", json: { mode: next } });
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}

	const correct = session?.picked !== null && session?.picked === current?.back;

	// キーボード: 記述は Space で答え、H でヒント、1/2/3 で評価。四択は 1〜4 で選び、正解なら 2/3、不正解なら Enter で次へ
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (!session) return;
			if (!session.revealed) {
				if (choices) {
					const n = Number(e.key);
					if (n >= 1 && n <= choices.length) pick(choices[n - 1]!);
				} else if (e.key === " " || e.key === "Enter") {
					e.preventDefault();
					reveal();
				} else if (e.key === "h" || e.key === "H") {
					showHint();
				}
				return;
			}
			if (choices && session.picked !== null) {
				if (!correct && e.key === "Enter") void rate("again");
				if (correct && (e.key === "2" || e.key === "3")) void rate(e.key === "2" ? "hard" : "good");
				return;
			}
			if (["1", "2", "3"].includes(e.key)) void rate((["again", "hard", "good"] as const)[Number(e.key) - 1]!);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [session, choices, correct, pick, reveal, showHint, rate]);

	const deckName = loaded.data?.deck.name ?? "…";
	const remaining = session?.queue.length ?? 0;
	// 進み具合は「評価した札 / 最初の札の数」。「忘れた」で戻った札は分母に足さず、残りが減らない分は棒が止まる
	const progress = session && session.total > 0 ? Math.min(1, (session.total - remaining) / session.total) : 0;

	return (
		<>
			<PageHeader
				crumb={<Link to={`/decks/${id}`}>{deckName}</Link>}
				title="学習"
				badges={
					session ? (
						<Badge tone={remaining > 0 ? "accent" : "success"}>残り {remaining}</Badge>
					) : null
				}
				actions={
					<>
						{mode ? (
							<div className="segmented" role="radiogroup" aria-label="出題の形式">
								<button type="button" role="radio" aria-checked={mode === "recall"} onClick={() => void switchMode("recall")}>
									記述
								</button>
								<button type="button" role="radio" aria-checked={mode === "choice"} onClick={() => void switchMode("choice")}>
									四択
								</button>
							</div>
						) : null}
						<Link to={`/decks/${id}`} className="btn btn--secondary btn--icon" ariaLabel="学習をやめて札の一覧に戻る">
							<Icon name="x" />
						</Link>
					</>
				}
			/>
			{session ? (
				<div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="今日の進み具合">
					<span className="progress__bar" style={{ width: `${progress * 100}%` }} />
				</div>
			) : null}
			{cheer ? (
				<div key={cheer.key} className="cheer" data-big={cheer.big || undefined} role="status" aria-live="polite">
					{cheer.big ? <Confetti count={16} /> : null}
					<span className="cheer__text">{cheer.text}</span>
				</div>
			) : null}
			{loaded.error ? (
				<ErrorState message={loaded.error} onRetry={loaded.reload} />
			) : !session ? (
				<div className="study__card">
					<span className="skeleton" />
				</div>
			) : !current ? (
				<Finished session={session} />
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
								{session.streak >= 2 ? (
									<span key={streakKey.current} className="streak-badge" data-tone={streakTone(session.streak)} role="status">
										<Icon name="flame" />
										{session.streak} 連続
									</span>
								) : null}
							</div>
							<p className="study__front">{current.front}</p>
							{choices ? (
								<ol className="choices" aria-label="選択肢">
									{choices.map((choice, i) => {
										const result = !session.revealed ? undefined : choice === current.back ? "correct" : choice === session.picked ? "wrong" : "other";
										return (
											<li key={choice}>
												<button type="button" className="choice" data-result={result} disabled={session.revealed} onClick={() => pick(choice)}>
													<span className="choice__key" aria-hidden="true">
														{CHOICE_LABEL[i]}
													</span>
													<span className="choice__text">{choice}</span>
													{result === "correct" ? <Icon name="check" /> : result === "wrong" ? <Icon name="x" /> : null}
												</button>
											</li>
										);
									})}
								</ol>
							) : null}
							{session.hint && !session.revealed ? (
								<p className="study__hint" role="status">
									<span className="study__hint-label">ヒント</span>
									{hint}
								</p>
							) : null}
							{session.revealed ? (
								<div className="study__answer">
									{choices ? (
										<p className={`study__result ${correct ? "study__result--correct" : "study__result--wrong"}`} role="status">
											{correct ? "正解" : "不正解"}
										</p>
									) : null}
									{/* 四択では正解の選択肢が緑の面で見えているため、裏を重ねて出さない */}
									{choices ? null : <p className="study__back">{current.back}</p>}
									{current.note ? <p className="study__note">{current.note}</p> : null}
								</div>
							) : null}
							<InlineError message={error} />
						</div>
					</div>
					{!session.revealed ? (
						choices ? (
							<div className="action-bar" role="region" aria-label="操作">
								<span className="action-bar__status">正しいものを 1 つ選んでください</span>
							</div>
						) : (
							<div className="action-bar" role="region" aria-label="操作">
								<span className="action-bar__status">答えを思い浮かべてから開いてください</span>
								<button className="btn btn--secondary" type="button" onClick={showHint} disabled={session.hint}>
									ヒント
								</button>
								<button className="btn btn--primary" type="button" onClick={reveal}>
									答えを見る
								</button>
							</div>
						)
					) : choices && session.picked !== null ? (
						correct ? (
							<div className="action-bar action-bar--grid action-bar--grid-2" role="region" aria-label="評価">
								<RateButton className="btn--secondary" label={`まぐれ（${RATING_LABEL.hard}）`} next={nextLabel(current, "hard", t)} busy={busy} onClick={() => void rate("hard")} />
								<RateButton className="btn--primary" label={RATING_LABEL.good} next={nextLabel(current, "good", t)} busy={busy} onClick={() => void rate("good")} />
							</div>
						) : (
							<div className="action-bar" role="region" aria-label="評価">
								<span className="action-bar__status">今日のうちにもう一度出します</span>
								<button className="btn btn--primary" type="button" disabled={busy} onClick={() => void rate("again")}>
									次へ
								</button>
							</div>
						)
					) : (
						<div className="action-bar action-bar--grid" role="region" aria-label="評価">
							<RateButton className="btn--danger" label={RATING_LABEL.again} next={nextLabel(current, "again", t)} busy={busy} onClick={() => void rate("again")} />
							<RateButton className="btn--secondary" label={RATING_LABEL.hard} next={nextLabel(current, "hard", t)} busy={busy} onClick={() => void rate("hard")} />
							<RateButton className="btn--primary" label={RATING_LABEL.good} next={nextLabel(current, "good", t)} busy={busy} onClick={() => void rate("good")} />
						</div>
					)}
				</>
			)}
		</>
	);
}

/** 評価のボタン。下の段に「次はいつ出るか」を小さく添える */
function RateButton({ className, label, next, busy, onClick }: { className: string; label: string; next: string; busy: boolean; onClick: () => void }) {
	return (
		<button className={`btn ${className} btn--rate`} type="button" disabled={busy} onClick={onClick}>
			<span>{label}</span>
			<span className="btn--rate__next">{next}</span>
		</button>
	);
}

/** 学習が終わったときの成績。評価が 1 回でもあれば祝う */
function Finished({ session }: { session: Session }) {
	const rate = session.done > 0 ? Math.round((session.correct / session.done) * 100) : 0;
	const perfect = session.done > 0 && session.correct === session.done;
	useEffect(() => {
		if (session.done > 0) buzz([40, 60, 40]);
	}, [session.done]);
	if (session.done === 0) {
		return (
			<div className="state" data-state="empty">
				<Icon name="inbox" size="md" />
				<p className="state__title">今日の学習する札はありません</p>
				<Link to="/" className="btn btn--secondary">
					単語帳の一覧に戻る
				</Link>
			</div>
		);
	}
	return (
		<div className="finished" role="status">
			<Confetti />
			<div className="finished__icon" aria-hidden="true">
				<Icon name="trophy" size="md" />
			</div>
			<h2 className="finished__title">{perfect ? "全問正解。今日の学習は終わりです" : "今日の学習は終わりです"}</h2>
			<dl className="finished__stats">
				<div>
					<dt>評価した回数</dt>
					<dd>{session.done}</dd>
				</div>
				<div>
					<dt>正解率</dt>
					<dd>{rate}%</dd>
				</div>
				<div>
					<dt>最長の連続正解</dt>
					<dd>{session.bestStreak}</dd>
				</div>
			</dl>
			<Link to="/" className="btn btn--primary">
				単語帳の一覧に戻る
			</Link>
		</div>
	);
}

/** 紙吹雪。CSS だけで落とし、動きを減らす設定では出さない(CSS 側で消す) */
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 53) % 700, hue: i % 4 }));
function Confetti({ count = CONFETTI.length }: { count?: number }) {
	return (
		<div className="confetti" aria-hidden="true">
			{CONFETTI.slice(0, count).map((c, i) => (
				<span key={i} className="confetti__piece" data-hue={c.hue} style={{ left: `${c.left}%`, animationDelay: `${c.delay}ms` }} />
			))}
		</div>
	);
}
