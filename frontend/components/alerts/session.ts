"use client";

import { useSyncExternalStore } from "react";

/**
 * Who this browser is, for following stations. There is no login: the id is
 * made here the first time it is needed and kept in local storage.
 */

const KEY = "haze.session";
const VALID = /^[A-Za-z0-9-]{8,80}$/;

let held: string | null = null;

/** The browser's id, made on first use. Kept in memory where storage is refused, so a private window still works until it closes. */
export function sessionId(): string {
  if (held) return held;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && VALID.test(stored)) return (held = stored);
  } catch {
    // A private window keeps nothing; the id below lasts for the visit.
  }
  held = crypto.randomUUID();
  try {
    window.localStorage.setItem(KEY, held);
  } catch {
    // As above.
  }
  return held;
}

function subscribe(): () => void {
  return () => undefined;
}

/** Null on the server and during hydration, then the id. */
export function useSessionId(): string | null {
  return useSyncExternalStore(subscribe, sessionId, () => null);
}
