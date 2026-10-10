import type { Kind, Station } from "@/lib/model-performance-schema";

/**
 * The scorecard's order: by kind then name until a column is chosen, then by
 * that column. A share that does not apply (no crossings at that instrument)
 * sorts last in either direction, so the blanks never lead the table.
 */

export type SortKey = "name" | "days" | "within20" | "hit150" | "falseAlarm150" | "directionRight" | "mae";
export type Direction = "up" | "down";

const KIND_ORDER: Record<Kind, number> = { doe: 0, nea: 1, openaq: 2 };

function byKindThenName(a: Station, b: Station): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, "en");
}

export function sortStations(stations: readonly Station[], key: SortKey | null, direction: Direction): Station[] {
  const sorted = [...stations].sort(byKindThenName);
  if (key === null) return sorted;
  const sign = direction === "up" ? 1 : -1;
  const value = (station: Station): number | string | null => (key === "name" ? station.name : station.score[key]);
  return sorted.sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    if (typeof left === "string" || typeof right === "string") return sign * String(left).localeCompare(String(right), "en");
    return sign * (left - right);
  });
}
