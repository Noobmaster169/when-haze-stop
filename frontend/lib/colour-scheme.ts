"use client";

import { useSyncExternalStore } from "react";

import { DARK_QUERY, SCHEME_KEY as KEY } from "./scheme-script";

/**
 * Light or dark. A person's choice is kept in local storage; without one the
 * system's setting is followed, live. The resolved scheme is written to
 * <html data-theme>, which is all the CSS reads. The head script in
 * scheme-script.ts does the same before the first paint, so a page never
 * flashes the wrong ground.
 */

export type SchemeChoice = "system" | "light" | "dark";
export type Scheme = "light" | "dark";

export function readChoice(): SchemeChoice {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Storage blocked, as in some private windows: the system decides.
    return "system";
  }
}

function apply(choice: SchemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function choose(choice: SchemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {
    // Not kept in a private window; it holds for this visit.
  }
  apply(choice);
}

/** Follows the system while no choice is stored. Returns the unsubscribe. */
export function followSystem(): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const change = (): void => {
    if (readChoice() === "system") apply("system");
  };
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** The scheme on screen now, for code that reads colours into a canvas. Null during the server render. */
export function useScheme(): Scheme | null {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => null,
  );
}
