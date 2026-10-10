import { clampView, type Size, type View } from "./geo";

/**
 * Glides the view to a place the way a map search does: eased in and out,
 * zooming on a log scale so the pace feels even. Instant under reduced
 * motion. A drag or a zoom mid-flight takes over, because the view is then
 * no longer the one the flight last set. Returns a cancel.
 */

const FLIGHT_MS = 700;

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function fly(get: () => View, set: (view: View) => void, size: Size, to: View, onStep: () => void): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    set(to);
    onStep();
    return () => undefined;
  }
  const from = get();
  const started = performance.now();
  let last = from;
  let request = 0;
  const step = (now: number): void => {
    if (get() !== last) return;
    const t = Math.min(1, (now - started) / FLIGHT_MS);
    const k = ease(t);
    last = clampView({ cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, scale: from.scale * (to.scale / from.scale) ** k }, size);
    set(last);
    onStep();
    if (t < 1) request = requestAnimationFrame(step);
  };
  request = requestAnimationFrame(step);
  return () => cancelAnimationFrame(request);
}
