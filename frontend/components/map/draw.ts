import type { Basemap } from "./basemap";
import { REGION, type Size, toX, toY, type View } from "./geo";
import { apiAt, type MapData } from "./map-data";
import { colourAt, css } from "./scale";
import type { MapTheme } from "./theme";

/** Everything the map paints that is not moving: the chart, the haze over it, and the marks on top. */

export interface Scene {
  view: View;
  size: Size;
  theme: MapTheme;
  basemap: Basemap | null;
}

function trace(context: CanvasRenderingContext2D, scene: Scene, line: Float32Array): void {
  context.moveTo(toX(scene.view, scene.size, line[0]), toY(scene.view, scene.size, line[1]));
  for (let index = 2; index < line.length; index += 2) context.lineTo(toX(scene.view, scene.size, line[index]), toY(scene.view, scene.size, line[index + 1]));
}

export function drawChart(context: CanvasRenderingContext2D, scene: Scene, heat: HTMLCanvasElement | null): void {
  const { view, size, theme, basemap } = scene;
  context.fillStyle = theme.sea;
  context.fillRect(0, 0, size.width, size.height);
  if (basemap) {
    context.fillStyle = theme.land;
    for (const rings of basemap.land) {
      context.beginPath();
      for (const ring of rings) {
        trace(context, scene, ring);
        context.closePath();
      }
      context.fill("evenodd");
    }
  }
  if (heat) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(heat, toX(view, size, REGION.lon0), toY(view, size, REGION.lat1), (REGION.lon1 - REGION.lon0) * view.scale, (REGION.lat1 - REGION.lat0) * view.scale);
  }
  if (!basemap) return;
  context.lineJoin = "round";
  context.lineWidth = 1;
  context.strokeStyle = theme.coast;
  for (const rings of basemap.land) {
    context.beginPath();
    for (const ring of rings) {
      trace(context, scene, ring);
      context.closePath();
    }
    context.stroke();
  }
  context.strokeStyle = theme.border;
  context.setLineDash([4, 3]);
  for (const border of basemap.borders) {
    context.beginPath();
    trace(context, scene, border);
    context.stroke();
  }
  context.setLineDash([]);
}

export interface Marks {
  data: MapData;
  at: number;
  fires: boolean;
  stations: boolean;
  selectedId: string | null;
  pin: { lon: number; lat: number } | null;
  /** A search result being looked at, drawn faint until it is chosen. */
  preview: { lon: number; lat: number } | null;
}

/** A map pin: a round head on a point, the tip on the spot itself. */
function drawPin(context: CanvasRenderingContext2D, x: number, y: number, fill: string, edge: string, alpha: number): void {
  context.save();
  context.globalAlpha = alpha;
  context.beginPath();
  context.moveTo(x, y);
  context.bezierCurveTo(x - 3, y - 7, x - 9, y - 11, x - 9, y - 18);
  context.arc(x, y - 18, 9, Math.PI, 0);
  context.bezierCurveTo(x + 9, y - 11, x + 3, y - 7, x, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 1.5;
  context.strokeStyle = edge;
  context.stroke();
  context.beginPath();
  context.arc(x, y - 18, 3.4, 0, Math.PI * 2);
  context.fillStyle = edge;
  context.fill();
  context.restore();
}

function onCanvas(size: Size, x: number, y: number, margin: number): boolean {
  return x > -margin && x < size.width + margin && y > -margin && y < size.height + margin;
}

export function drawMarks(context: CanvasRenderingContext2D, scene: Scene, marks: Marks): void {
  const { view, size, theme } = scene;
  context.clearRect(0, 0, size.width, size.height);

  if (marks.fires) {
    for (const fire of marks.data.fires) {
      const x = toX(view, size, fire.lon);
      const y = toY(view, size, fire.lat);
      if (!onCanvas(size, x, y, 6)) continue;
      context.beginPath();
      context.arc(x, y, Math.max(1.5, Math.min(5, Math.sqrt(fire.frpMw) / 9)), 0, Math.PI * 2);
      context.fillStyle = theme.fireCore;
      context.fill();
      context.strokeStyle = theme.fire;
      context.lineWidth = 1.2;
      context.stroke();
    }
  }

  if (marks.stations) {
    for (const station of marks.data.stations) {
      const x = toX(view, size, station.lon);
      const y = toY(view, size, station.lat);
      if (!onCanvas(size, x, y, 10)) continue;
      const chosen = station.id === marks.selectedId;
      context.beginPath();
      context.arc(x, y, chosen ? 7 : 4.2, 0, Math.PI * 2);
      context.fillStyle = css(colourAt(theme.stops, apiAt(marks.data, marks.at, station.lon, station.lat)));
      context.fill();
      context.strokeStyle = chosen ? theme.ink : theme.halo;
      context.lineWidth = chosen ? 2 : 1.2;
      context.stroke();
    }
  }

  if (marks.preview) drawPin(context, toX(view, size, marks.preview.lon), toY(view, size, marks.preview.lat), theme.ink, theme.halo, 0.45);
  if (marks.pin) drawPin(context, toX(view, size, marks.pin.lon), toY(view, size, marks.pin.lat), theme.ink, theme.halo, 1);
}
