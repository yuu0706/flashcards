import type { CardState, DeckDirection, DeckMode } from "../../lib/scheduler";

export type Me = { email: string; reviewedToday: number; streakDays: number };

export type Deck = { id: string; name: string; newPerDay: number; mode: DeckMode; direction: DeckDirection; createdAt: string; updatedAt: string };
export type DeckSummary = Deck & { total: number; due: number; fresh: number };

export type Card = {
	id: string;
	deckId: string;
	front: string;
	back: string;
	note: string;
	tags: string[];
	/** 四択の誤答。空なら同じ単語帳の他の札の裏から作る */
	choices: string[];
	state: CardState;
	due: string | null;
	intervalDays: number;
	ease: number;
	reps: number;
	lapses: number;
	lastReviewedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

/** 四択の誤答の候補。同じ単語帳の他の札の裏と表 */
export type StudyPool = { backs: string[]; fronts: string[] };

export type StudyCard = Pick<Card, "id" | "front" | "back" | "note" | "tags" | "choices" | "state" | "due" | "intervalDays" | "ease" | "reps" | "lapses">;
