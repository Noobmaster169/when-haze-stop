/**
 * The week of the past the timeline shows while looking back. The day the map
 * draws is the one the timeline's moment falls in, so dragging through the week
 * walks through its days. Pure.
 */

const DAY_MS = 86_400_000;
const DAYS = 7;
const DAYS_BEFORE = 3;

export interface TimeWindow {
  from: number;
  to: number;
}

/** A week with a moment's day in the middle, kept between the first stored day and the newest reading. */
export function windowAround(at: number, first: number, newest: number): TimeWindow {
  const start = Math.floor(at / DAY_MS) * DAY_MS - DAYS_BEFORE * DAY_MS;
  const to = Math.min(start + DAYS * DAY_MS, newest);
  const from = Math.max(first, to - DAYS * DAY_MS);
  return { from, to: Math.max(to, from + DAY_MS) };
}

/** Whether a moment sits on an end of a span, where the timeline has no further to go without a new window. */
export function atEdge(at: number, span: TimeWindow): boolean {
  return at <= span.from || at >= span.to;
}
