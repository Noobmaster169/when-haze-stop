import type { AirMonitor } from "@/lib/api/haze-schemas";

import type { Scene } from "./draw";
import { toX, toY } from "./geo";
import { pm25At } from "./map-data";
import { colourAt, css, pm25ToApi } from "./scale";

/**
 * The instruments of a past day: a dot at each, in the colour of the index
 * its PM2.5 would give at the timeline's moment. A government station or
 * reference monitor is a full dot; a low-cost sensor a smaller one, because it
 * follows the same rises and falls but can read high. An instrument silent in
 * that hour is an empty ring, so it is seen to be there.
 */

const REFERENCE_PX = 4.2;
const SENSOR_PX = 3;

export function drawMonitors(context: CanvasRenderingContext2D, scene: Scene, monitors: AirMonitor[], dayStart: number, at: number, selectedId: string | null): void {
  const { view, size, theme } = scene;
  for (const monitor of monitors) {
    const x = toX(view, size, monitor.lon);
    const y = toY(view, size, monitor.lat);
    if (x < -10 || x > size.width + 10 || y < -10 || y > size.height + 10) continue;
    const chosen = monitor.id === selectedId;
    const value = pm25At(monitor, dayStart, at);
    context.beginPath();
    context.arc(x, y, chosen ? 7 : monitor.reference ? REFERENCE_PX : SENSOR_PX, 0, Math.PI * 2);
    if (value !== null) {
      context.fillStyle = css(colourAt(theme.stops, pm25ToApi(value)));
      context.fill();
    }
    context.globalAlpha = value === null && !chosen ? 0.45 : 1;
    context.strokeStyle = theme.label;
    context.lineWidth = chosen ? 2.6 : monitor.reference ? 1.4 : 1;
    context.stroke();
    context.globalAlpha = 1;
  }
}

/** What kind of instrument it is, in the words a panel heads it with. */
export function monitorKind(monitor: AirMonitor): string {
  if (monitor.source === "doe") return "DOE station";
  if (monitor.source === "nea") return "NEA region";
  return monitor.reference ? `${monitor.provider} reference monitor` : `${monitor.provider} low-cost sensor`;
}
