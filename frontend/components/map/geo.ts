/**
 * The map's view and the arithmetic of moving it. Pure.
 *
 * A plain degrees-to-pixels projection: this close to the equator a degree of
 * longitude and one of latitude are within a percent of the same length.
 */

export interface View {
  /** The longitude and latitude at the centre of the canvas. */
  cx: number;
  cy: number;
  /** Pixels a degree. */
  scale: number;
}

export interface Size {
  width: number;
  height: number;
}

/** What the model covers, which is also what the heat layer is drawn over. */
export const REGION = { lon0: 96, lat0: -6, lon1: 118, lat1: 8 } as const;

const PAN_MARGIN = 3;
const MAX_ZOOM = 9;
const MIN_ZOOM = 0.8;

export function toX(view: View, size: Size, lon: number): number {
  return size.width / 2 + (lon - view.cx) * view.scale;
}

export function toY(view: View, size: Size, lat: number): number {
  return size.height / 2 - (lat - view.cy) * view.scale;
}

export function toLon(view: View, size: Size, x: number): number {
  return view.cx + (x - size.width / 2) / view.scale;
}

export function toLat(view: View, size: Size, y: number): number {
  return view.cy - (y - size.height / 2) / view.scale;
}

/** The scale at which the whole region just covers the canvas. */
export function fitScale(size: Size): number {
  return Math.max(size.width / (REGION.lon1 - REGION.lon0), size.height / (REGION.lat1 - REGION.lat0));
}

/** The first view: the peninsula and the strait, which is where the readings are. */
export function homeView(size: Size): View {
  const scale = fitScale(size) * (size.width < 700 ? 1.6 : 1.25);
  return clampView({ cx: 103.2, cy: 2.6, scale }, size);
}

export function clampView(view: View, size: Size): View {
  const fit = fitScale(size);
  return {
    scale: Math.max(fit * MIN_ZOOM, Math.min(fit * MAX_ZOOM, view.scale)),
    cx: Math.max(REGION.lon0 - PAN_MARGIN, Math.min(REGION.lon1 + PAN_MARGIN, view.cx)),
    cy: Math.max(REGION.lat0 - PAN_MARGIN, Math.min(REGION.lat1 + PAN_MARGIN, view.cy)),
  };
}

/** Zooms by a factor, keeping the point under the cursor where it is. */
export function zoomAt(view: View, size: Size, x: number, y: number, factor: number): View {
  const lon = toLon(view, size, x);
  const lat = toLat(view, size, y);
  const zoomed = clampView({ ...view, scale: view.scale * factor }, size);
  return clampView({ scale: zoomed.scale, cx: lon - (x - size.width / 2) / zoomed.scale, cy: lat + (y - size.height / 2) / zoomed.scale }, size);
}

export function panBy(view: View, size: Size, dx: number, dy: number): View {
  return clampView({ ...view, cx: view.cx - dx / view.scale, cy: view.cy + dy / view.scale }, size);
}

/** A view centred on a place, close enough to tell its stations apart. */
export function viewOn(size: Size, lon: number, lat: number, current: View): View {
  return clampView({ cx: lon, cy: lat, scale: Math.max(current.scale, fitScale(size) * 3) }, size);
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (aLat - bLat) * 111.2;
  const dLon = (aLon - bLon) * 111.2 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}
