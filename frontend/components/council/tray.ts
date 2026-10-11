import type { MessageAct, ScoreSummary } from "@/lib/api/council-schemas";

import type { Timeline } from "./timeline";

/**
 * The side rail's state at a beat: the plans tabled so far with the numbers
 * and ratings they have gathered, and the messages said so far. Pure.
 */

export interface Rating {
  agent: string;
  score: number;
  note: string;
}

export interface PlanCard {
  planId: string;
  by: string;
  title: string;
  headline: string;
  premise: string | null;
  /** Made by code, not by the council: a plan to beat. */
  baseline: boolean;
  /** The validator refused it; it stays on the board but does not go forward. */
  refused: boolean;
  score: ScoreSummary | null;
  ratings: Rating[];
  chosen: boolean;
}

export interface Tray {
  plans: PlanCard[];
  chosen: string | null;
  /** The plan the engine is scoring in the beat now playing. */
  scoring: string | null;
}

export interface Said {
  beat: number;
  id: string;
  from: string;
  to: string[];
  act: MessageAct;
  headline: string;
  detail: string;
  planId: string | null;
  unverified: string[];
}

export function trayAt(timeline: Timeline, index: number): Tray {
  const cards = new Map<string, PlanCard>();
  let chosen: string | null = null;
  for (let position = 0; position <= index && position < timeline.beats.length; position++) {
    const event = timeline.beats[position].event;
    if (event.kind === "candidate") {
      const { planId, by, title, headline, premise, baseline, violations } = event.payload;
      cards.set(planId, { planId, by, title, headline, premise, baseline, refused: violations.length > 0, score: null, ratings: [], chosen: false });
    } else if (event.kind === "simulation") {
      const card = cards.get(event.payload.planId);
      if (card) card.score = event.payload.score;
    } else if (event.kind === "vote") {
      for (const rating of event.payload.ratings) {
        const card = cards.get(rating.planId);
        if (!card) continue;
        card.ratings = [...card.ratings.filter((item) => item.agent !== event.payload.agent), { agent: event.payload.agent, score: rating.score, note: rating.note }];
      }
    } else if (event.kind === "verdict") {
      chosen = event.payload.planId;
    }
  }
  const all = [...cards.values()].map((card) => ({ ...card, chosen: card.planId === chosen }));
  const current = index >= 0 ? timeline.beats[index]?.event : undefined;
  return {
    // The chosen plan leads once there is one; otherwise plans stay in the order they were tabled.
    plans: [...all.filter((card) => card.chosen), ...all.filter((card) => !card.baseline && !card.chosen), ...all.filter((card) => card.baseline && !card.chosen)],
    chosen,
    scoring: current?.kind === "simulation" ? current.payload.planId : null,
  };
}

export function saidUpTo(timeline: Timeline, index: number): Said[] {
  const said: Said[] = [];
  for (let position = 0; position <= index && position < timeline.beats.length; position++) {
    const event = timeline.beats[position].event;
    if (event.kind !== "message") continue;
    said.push({ beat: position, ...event.payload });
  }
  return said;
}

/** The mean rating a plan has had, 0 to 10, or null before any. */
export function meanRating(card: PlanCard): number | null {
  if (card.ratings.length === 0) return null;
  return card.ratings.reduce((sum, rating) => sum + rating.score, 0) / card.ratings.length;
}
