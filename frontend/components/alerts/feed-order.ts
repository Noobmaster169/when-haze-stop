import type { AlertEvent } from "@/lib/api/alert-schemas";

import { hasSeen, type Seen } from "./seen-state";

/** How the feed is shown: which alerts slide in, and how the page lists them. */

/** More than three at once is a list, which the page is for. */
export const TOAST_MAX = 3;

/** `observed` is kept only for old rows; nothing shows it. */
function shown(event: AlertEvent): boolean {
  return event.kind !== "observed";
}

/** Unread alerts still in force, newest first: the three that slide in, and how many more wait on the page. */
export function toastsFrom(events: readonly AlertEvent[], seen: Seen): { toasts: AlertEvent[]; more: number } {
  const fresh = events.filter((event) => shown(event) && event.open && !hasSeen(seen, event.id)).sort((a, b) => b.id - a.id);
  return { toasts: fresh.slice(0, TOAST_MAX), more: Math.max(0, fresh.length - TOAST_MAX) };
}

/** Active alerts first, then ended ones, newest first within each. */
export function feedOrder(events: readonly AlertEvent[]): AlertEvent[] {
  return events.filter(shown).sort((a, b) => Number(b.open) - Number(a.open) || b.id - a.id);
}
