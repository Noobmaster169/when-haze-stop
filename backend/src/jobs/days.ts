/** UTC calendar days as `YYYY-MM-DD`, which is how the fire archive and the weather archive are asked. */

const DAY_MS = 86_400_000;

export function dayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return dayOf(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}

/** Whole days from one day to another: 0 for the same day, negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** `from` to `to`, both included, cut into runs of at most `size` days. */
export function spansOf(from: string, to: string, size: number): { from: string; days: number }[] {
  const spans: { from: string; days: number }[] = [];
  for (let start = from; start <= to; start = addDays(start, size)) {
    spans.push({ from: start, days: Math.min(size, daysBetween(start, to) + 1) });
  }
  return spans;
}
