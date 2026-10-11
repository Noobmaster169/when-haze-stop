import { z } from "zod";

/**
 * The baked city: OpenStreetMap's buildings, parks, water and roads around a
 * point, packed by scripts/bake-city.mjs into public/city/<key>.json.
 *
 * Coordinates are integer decimetres on a flat plane, x east and y north of
 * the origin. Rings are open and flat: [x0, y0, x1, y1, ...].
 */

const Ring = z.array(z.number().int());

const Building = z.object({
  /** Top and base, metres above the ground. */
  h: z.number(),
  m: z.number().optional(),
  /** Set when OSM gave neither a height nor levels, and the height is a guess by kind of building. */
  e: z.literal(1).optional(),
  o: Ring,
  i: z.array(Ring).optional(),
});
export type Building = z.infer<typeof Building>;

const Area = z.object({ o: Ring, i: z.array(Ring).optional() });
export type Area = z.infer<typeof Area>;

const Line = z.object({ w: z.number(), p: Ring });
export type Line = z.infer<typeof Line>;

export const CityData = z.object({
  attribution: z.string(),
  license: z.string(),
  licenseUrl: z.string(),
  osmBase: z.string(),
  origin: z.tuple([z.number(), z.number()]),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  buildings: z.array(Building),
  towers: z.array(z.object({ x: z.number(), y: z.number(), h: z.number() })),
  parks: z.array(Area),
  water: z.array(Area),
  roads: z.array(Line),
  rivers: z.array(Line),
});
export type CityData = z.infer<typeof CityData>;

export async function fetchCityData(key: string): Promise<CityData> {
  const response = await fetch(`/city/${encodeURIComponent(key)}.json`);
  if (!response.ok) throw new Error(`The city model for ${key} could not be loaded (${response.status}).`);
  return CityData.parse(await response.json());
}
