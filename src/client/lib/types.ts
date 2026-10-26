import type { CardState } from "../../lib/scheduler";

export type Me = { email: string; reviewedToday: number };

export type Deck = { id: string; name: string; newPerDay: number; createdAt: string; updatedAt: string };
export type DeckSummary = Deck & { total: number; due: number; fresh: number };

export type Card = {
	id: string;
	deckId: string;
	front: string;
	back: string;
	note: string;
	tags: string[];
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

export type StudyCard = Pick<Card, "id" | "front" | "back" | "note" | "tags" | "state" | "due" | "intervalDays" | "ease" | "reps" | "lapses">;
