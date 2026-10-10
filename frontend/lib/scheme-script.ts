/**
 * The light or dark choice's storage key and the head script that applies it
 * before the first paint. Plain constants, so the server's root layout can
 * read them; lib/colour-scheme.ts holds the client half.
 */

export const SCHEME_KEY = "haze.theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Runs inline in <head>, before anything paints. Kept in step with apply() in colour-scheme.ts. */
export const SCHEME_SCRIPT = `try{var c=localStorage.getItem("${SCHEME_KEY}");var d=c==="dark"||(c!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme=matchMedia("${DARK_QUERY}").matches?"dark":"light"}`;
