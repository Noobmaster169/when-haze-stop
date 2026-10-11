"use client";

import { useSyncExternalStore } from "react";

import { NOTHING_SEEN, parseSeen, type Seen, withSeen } from "./seen-state";

/**
 * The alerts this browser has read, kept in local storage and shared in
 * memory, so closing a toast, the island's dot and the page agree at once.
 */

const FLOOR_KEY = "haze.alerts.seen";
const IDS_KEY = "haze.alerts.seen-ids";

let current: Seen | null = null;
const listeners = new Set<() => void>();

function read(): Seen {
  if (current) return current;
  try {
    current = parseSeen(window.localStorage.getItem(FLOOR_KEY), window.localStorage.getItem(IDS_KEY));
  } catch {
    // A private window keeps nothing; reads last for the visit.
    current = NOTHING_SEEN;
  }
  return current;
}

export function markSeen(ids: readonly number[]): void {
  if (ids.length === 0) return;
  const next = withSeen(read(), ids);
  current = next;
  try {
    window.localStorage.setItem(FLOOR_KEY, String(next.floor));
    window.localStorage.setItem(IDS_KEY, JSON.stringify(next.ids));
  } catch {
    // As above.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Nothing read on the server and during hydration, then what this browser kept. */
export function useSeen(): Seen {
  return useSyncExternalStore(subscribe, read, () => NOTHING_SEEN);
}
