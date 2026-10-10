import { type Size, toLat, toLon, toX, toY, type View } from "./geo";
import type { MapData } from "./map-data";
import type { Pick } from "./map-handle";

/** How close a tap has to land to a dot to mean that dot. */
const PICK_RADIUS_PX = 14;

function nearest<T extends { lon: number; lat: number }>(marks: readonly T[], view: View, size: Size, x: number, y: number): T | null {
  let found: T | null = null;
  let reach = PICK_RADIUS_PX;
  for (const candidate of marks) {
    const away = Math.hypot(toX(view, size, candidate.lon) - x, toY(view, size, candidate.lat) - y);
    if (away < reach) [reach, found] = [away, candidate];
  }
  return found;
}

/** What a tap on the canvas means: the station or past-day instrument under it, or else the spot itself. */
export function pickAt(data: MapData | null, dots: boolean, view: View, size: Size, x: number, y: number): Pick {
  const station = dots ? nearest(data?.stations ?? [], view, size, x, y) : null;
  const monitor = dots && !station ? nearest(data?.monitors ?? [], view, size, x, y) : null;
  const mark = station ?? monitor;
  return { lon: mark?.lon ?? toLon(view, size, x), lat: mark?.lat ?? toLat(view, size, y), station, monitor };
}
