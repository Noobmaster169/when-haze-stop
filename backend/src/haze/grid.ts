/**
 * The region the model covers and the two grids laid over it.
 *
 * Sumatra, the peninsula and Borneo: wide enough to hold the fires that reach
 * Malaysia and the sea the smoke crosses. Both grids are row-major from the
 * south-west corner, so index 0 is the bottom-left cell on a map.
 */

// East to 120 so all of Sabah is inside: Semporna and Tawau reach about 119.3.
export const DOMAIN = { lon0: 96, lat0: -6, lon1: 120, lat1: 8 } as const;

/** Wind and rain arrive on this one, a point on every whole degree. One degree is as fine as the free forecast is worth sampling. */
export const WEATHER = { nx: DOMAIN.lon1 - DOMAIN.lon0 + 1, ny: DOMAIN.lat1 - DOMAIN.lat0 + 1, step: 1 } as const;
export const WEATHER_POINTS = WEATHER.nx * WEATHER.ny;

/** Smoke is counted on this one. A quarter degree is about 28 km. */
export const FIELD = { nx: (DOMAIN.lon1 - DOMAIN.lon0) * 4, ny: (DOMAIN.lat1 - DOMAIN.lat0) * 4, step: 0.25 } as const;
export const FIELD_CELLS = FIELD.nx * FIELD.ny;

/** Names the region and field step together, so a stored run says which grid its frames are on. */
export const GRID_KEY = `${DOMAIN.lon0}:${DOMAIN.lon1}:${DOMAIN.lat0}:${DOMAIN.lat1}:${FIELD.step}`;

const KM_PER_DEGREE = 111.2;

export function inDomain(lat: number, lon: number): boolean {
  return lon >= DOMAIN.lon0 && lon < DOMAIN.lon1 && lat >= DOMAIN.lat0 && lat < DOMAIN.lat1;
}

/** Flat-earth distance, which is within a percent this close to the equator. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (aLat - bLat) * KM_PER_DEGREE;
  const dLon = (aLon - bLon) * KM_PER_DEGREE * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

export function cellCentre(index: number): { lat: number; lon: number } {
  const row = Math.floor(index / FIELD.nx);
  const column = index - row * FIELD.nx;
  return { lat: DOMAIN.lat0 + (row + 0.5) * FIELD.step, lon: DOMAIN.lon0 + (column + 0.5) * FIELD.step };
}

/** The field cells whose centre is within `km` of a point. Empty for a point outside the region. */
export function cellsWithin(lat: number, lon: number, km: number): number[] {
  const reach = Math.ceil(km / (FIELD.step * KM_PER_DEGREE)) + 1;
  const column = Math.floor((lon - DOMAIN.lon0) / FIELD.step);
  const row = Math.floor((lat - DOMAIN.lat0) / FIELD.step);
  const cells: number[] = [];
  for (let j = Math.max(0, row - reach); j <= Math.min(FIELD.ny - 1, row + reach); j++) {
    for (let i = Math.max(0, column - reach); i <= Math.min(FIELD.nx - 1, column + reach); i++) {
      const index = j * FIELD.nx + i;
      const centre = cellCentre(index);
      if (distanceKm(lat, lon, centre.lat, centre.lon) <= km) cells.push(index);
    }
  }
  return cells;
}

/** Hours between two instants, rounded: every series in the model is hourly. */
export function hoursBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 3_600_000);
}

export function addHours(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * 3_600_000);
}
