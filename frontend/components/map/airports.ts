import type { Scene } from "./draw";
import { toX, toY } from "./geo";
import { type UnpackedAirport, visibilityAt } from "./map-data";

/**
 * The visibility layer: a square at each airport, darker the shorter an
 * observer there could see at the timeline's moment, with the distance
 * written under it once it is under ten kilometres. A ring says the observer
 * called it haze or smoke.
 */

const FAR_M = 10_000;
const HALF = 4;

/** How much of the label ink a visibility earns: nothing at ten kilometres, all of it at nothing. */
function shade(metres: number): number {
  return Math.min(1, Math.max(0.12, 1 - metres / FAR_M));
}

function hazeOrSmoke(wx: string | null): "haze" | "smoke" | null {
  if (!wx) return null;
  if (wx.includes("FU")) return "smoke";
  if (wx.includes("HZ")) return "haze";
  return null;
}

function distance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1).replace(/\.0$/, "")} km` : `${metres} m`;
}

export function drawAirports(context: CanvasRenderingContext2D, scene: Scene, airports: UnpackedAirport[], at: number, fontFamily: string): void {
  const { view, size, theme } = scene;
  // To the right of the square, clear of the town names, which sit above their dots.
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = `500 10px ${fontFamily}`;
  for (const airport of airports) {
    const report = visibilityAt(airport, at);
    if (!report) continue;
    const x = toX(view, size, airport.lon);
    const y = toY(view, size, airport.lat);
    if (x < -20 || x > size.width + 20 || y < -20 || y > size.height + 20) continue;
    const metres = report.m ?? FAR_M;
    const seen = hazeOrSmoke(report.wx);

    context.globalAlpha = shade(metres);
    context.fillStyle = theme.label;
    context.fillRect(x - HALF, y - HALF, HALF * 2, HALF * 2);
    context.globalAlpha = 1;
    context.lineWidth = seen ? 1.5 : 1;
    context.strokeStyle = seen === "smoke" ? theme.fire : theme.label;
    context.strokeRect(x - HALF - (seen ? 1.5 : 0), y - HALF - (seen ? 1.5 : 0), HALF * 2 + (seen ? 3 : 0), HALF * 2 + (seen ? 3 : 0));

    if (metres >= FAR_M) continue;
    const text = seen ? `${distance(metres)} ${seen}` : distance(metres);
    context.strokeStyle = theme.halo;
    context.lineWidth = 3;
    context.strokeText(text, x + HALF + 4, y);
    context.fillStyle = theme.label;
    context.fillText(text, x + HALF + 4, y);
  }
}
