import { panelInset } from "./floating-panel";
import { clampView, type Size, toX, toY, type View, viewOn } from "./geo";

/**
 * Glides the view to a place the way a map search does: eased in and out,
 * zooming on a log scale so the pace feels even, and landing the place in
 * the middle of what the floating panel leaves uncovered. Instant under
 * reduced motion. A drag or a zoom mid-flight takes over, because the view is
 * then no longer the one the flight last set. Each returns a cancel.
 */

/** The map's live view, which the gestures and a flight both move. */
export interface ViewState {
  view: View;
  size: Size;
}

const FLIGHT_MS = 700;
const REVEAL_MARGIN_PX = 24;
const nothing = (): void => undefined;

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** A view moved so its centre point sits in the middle of what the panel leaves uncovered. */
function besidePanel(view: View, size: Size): View {
  const inset = panelInset(size);
  return clampView({ ...view, cx: view.cx - inset.left / 2 / view.scale, cy: view.cy - inset.bottom / 2 / view.scale }, size);
}

function glide(state: ViewState, to: View, onStep: () => void): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.view = to;
    onStep();
    return nothing;
  }
  const from = state.view;
  const started = performance.now();
  let last = from;
  let request = 0;
  const step = (now: number): void => {
    if (state.view !== last) return;
    const t = Math.min(1, (now - started) / FLIGHT_MS);
    const k = ease(t);
    last = clampView({ cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, scale: from.scale * (to.scale / from.scale) ** k }, state.size);
    state.view = last;
    onStep();
    if (t < 1) request = requestAnimationFrame(step);
  };
  request = requestAnimationFrame(step);
  return () => cancelAnimationFrame(request);
}

/** To a place, close enough to tell its stations apart. */
export function flyTo(state: ViewState, lon: number, lat: number, onStep: () => void): () => void {
  return glide(state, besidePanel(viewOn(state.size, lon, lat, state.view), state.size), onStep);
}

/** Only as far as it takes to bring a point out from under the panel; null where it is already clear. */
export function reveal(state: ViewState, lon: number, lat: number, onStep: () => void): (() => void) | null {
  const inset = panelInset(state.size);
  const x = toX(state.view, state.size, lon);
  const y = toY(state.view, state.size, lat);
  if (x > inset.left + REVEAL_MARGIN_PX && y < state.size.height - inset.bottom - REVEAL_MARGIN_PX) return null;
  return glide(state, besidePanel({ ...state.view, cx: lon, cy: lat }, state.size), onStep);
}
