import { fitScale, toX, toY } from "./geo";
import type { Scene } from "./draw";

/**
 * Town names, biggest first, each drawn only where it does not sit on one
 * already drawn. More appear as the map is zoomed in.
 */
export function drawLabels(context: CanvasRenderingContext2D, scene: Scene, fontFamily: string): void {
  const { view, size, theme, basemap } = scene;
  if (!basemap) return;
  const zoom = view.scale / fitScale(size);
  const smallest = zoom < 1.5 ? 3 : zoom < 2.6 ? 6 : 8;
  const taken: [number, number, number, number][] = [];
  context.textBaseline = "middle";
  context.textAlign = "center";
  context.lineJoin = "round";

  for (const place of basemap.places) {
    // Malaysian towns show a step earlier: they are what the readings are for.
    const limit = place.country === "MYS" ? smallest + 2 : smallest;
    if (place.rank > limit) continue;
    const x = toX(view, size, place.lon);
    const y = toY(view, size, place.lat);
    if (x < 12 || x > size.width - 12 || y < 24 || y > size.height - 12) continue;
    const major = place.rank <= 3;
    context.font = `${major ? 600 : 500} ${major ? 13 : 11.5}px ${fontFamily}`;
    const width = context.measureText(place.name).width;
    const box: [number, number, number, number] = [x - width / 2 - 4, y - 20, x + width / 2 + 4, y - 2];
    if (taken.some((other) => box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1])) continue;
    taken.push(box);
    context.strokeStyle = theme.halo;
    context.lineWidth = 3;
    context.strokeText(place.name, x, y - 11);
    context.fillStyle = theme.label;
    context.fillText(place.name, x, y - 11);
  }
}
