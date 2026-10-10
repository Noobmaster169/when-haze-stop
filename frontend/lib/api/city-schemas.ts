import { z } from "zod";

/**
 * The city contract, mirrored by hand from the CityAir part of
 * backend/src/contracts.haze.ts. Change one, change the other in the same
 * commit: every response is parsed against these, so a drift fails at the
 * boundary naming the field.
 */

export const CityHour = z.object({
  at: z.string(),
  observed: z.boolean(),
  api: z.number().int(),
  pm25: z.number(),
  visibilityKm: z.number(),
  aerosolDepth: z.number(),
});
export type CityHour = z.infer<typeof CityHour>;

export const CityAir = z.object({
  city: z.object({ key: z.string(), name: z.string(), lat: z.number(), lon: z.number() }),
  stations: z.array(z.object({ id: z.string(), name: z.string(), km: z.number(), share: z.number() })),
  asOf: z.string().nullable(),
  humidity: z.number(),
  massExtinction: z.number(),
  hours: z.array(CityHour),
});
export type CityAir = z.infer<typeof CityAir>;
