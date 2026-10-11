/**
 * Which landmass a point is on, roughly: enough to say where the fires are.
 *
 * The Strait of Malacca is taken as a straight line from the north-west to
 * Singapore, which puts every coast town checked on its own side.
 */

export const REGIONS = ["Sumatra and the Riau islands", "Peninsular Malaysia and southern Thailand", "Borneo"] as const;
export type Region = (typeof REGIONS)[number];

const BORNEO_FROM_LON = 108.5;
const STRAIT_ENDS_LON = 103.5;
/** South of this, east of the strait's end, is the Riau islands and not Johor. */
const RIAU_BELOW_LAT = 1.2;

export function regionOf(lat: number, lon: number): Region {
  if (lon >= BORNEO_FROM_LON) return "Borneo";
  const strait = lon <= STRAIT_ENDS_LON ? 5.5 - 0.75 * (lon - 97.5) : RIAU_BELOW_LAT;
  return lat < strait ? "Sumatra and the Riau islands" : "Peninsular Malaysia and southern Thailand";
}

const POINTS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;

/** The compass point a bearing in degrees lies on. */
export function compass(degrees: number): string {
  return POINTS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

/** The bearing from one point to another, in degrees clockwise from north. */
export function bearing(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const east = (toLon - fromLon) * Math.cos((fromLat * Math.PI) / 180);
  return (Math.atan2(east, toLat - fromLat) * 180) / Math.PI;
}

/** Where a wind blows from, given its eastward and northward parts. */
export function windFrom(u: number, v: number): number {
  return (Math.atan2(-u, -v) * 180) / Math.PI;
}
