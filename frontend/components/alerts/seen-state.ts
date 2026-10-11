/**
 * Which alerts this browser has read: the ids closed one by one, over a floor
 * below which everything counts as read. The floor is the mark the single
 * line under the island used to keep, so what was closed there stays closed.
 * Pure, so the store in seen.ts and the tests share it.
 */

export interface Seen {
  floor: number;
  ids: readonly number[];
}

/** Enough for months of alerts; older reads fold into the floor. */
const KEEP = 200;

export const NOTHING_SEEN: Seen = { floor: 0, ids: [] };

export function hasSeen(seen: Seen, id: number): boolean {
  return id <= seen.floor || seen.ids.includes(id);
}

export function withSeen(seen: Seen, add: readonly number[]): Seen {
  const ids = [...new Set([...seen.ids, ...add.filter((id) => !hasSeen(seen, id))])].sort((a, b) => b - a);
  if (ids.length <= KEEP) return { floor: seen.floor, ids };
  return { floor: Math.max(seen.floor, ids[KEEP]), ids: ids.slice(0, KEEP) };
}

/** What storage held, read defensively: another tab or an old version may have written it. */
export function parseSeen(floor: string | null, ids: string | null): Seen {
  const parsedFloor = Number(floor) || 0;
  let list: unknown = [];
  try {
    list = ids ? JSON.parse(ids) : [];
  } catch {
    // A list that does not parse is read as empty; the floor still holds.
    list = [];
  }
  const valid = Array.isArray(list) ? list.filter((id): id is number => Number.isInteger(id)) : [];
  return { floor: parsedFloor, ids: valid };
}
