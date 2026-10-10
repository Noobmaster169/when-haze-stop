import { z } from "zod";

/**
 * The haze contract, mirrored by hand from backend/src/contracts.haze.ts.
 * Change one, change the other in the same commit: every response is parsed
 * against these, so a drift fails at the boundary naming the field.
 */

export const Network = z.enum(["doe", "nea"]);
export type Network = z.infer<typeof Network>;

export const Station = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  network: Network,
  lat: z.number(),
  lon: z.number(),
  api: z.number().int().nullable(),
  observedAt: z.string().nullable(),
});
export type Station = z.infer<typeof Station>;

export const FieldGrid = z.object({ lon0: z.number(), lat0: z.number(), nx: z.number().int(), ny: z.number().int(), step: z.number() });
export type FieldGrid = z.infer<typeof FieldGrid>;

export const Frame = z.object({ validAt: z.string(), observed: z.boolean(), field: z.string() });
export type Frame = z.infer<typeof Frame>;

export const WindFrame = z.object({ validAt: z.string(), uv: z.string() });
export type WindFrame = z.infer<typeof WindFrame>;

export const FireCell = z.object({ lat: z.number(), lon: z.number(), frpMw: z.number() });
export type FireCell = z.infer<typeof FireCell>;

export const RunSummary = z.object({
  id: z.number().int(),
  asOf: z.string(),
  madeAt: z.string(),
  rankCorrelation: z.number().nullable(),
  pairs: z.number().int(),
});
export type RunSummary = z.infer<typeof RunSummary>;

export const VisibilityReport = z.object({ at: z.string(), m: z.number().int().nullable(), wx: z.string().nullable() });
export type VisibilityReport = z.infer<typeof VisibilityReport>;

export const Airport = z.object({ icao: z.string(), name: z.string(), lat: z.number(), lon: z.number(), reports: z.array(VisibilityReport) });
export type Airport = z.infer<typeof Airport>;

export const HazeMap = z.object({
  run: RunSummary.nullable(),
  grid: FieldGrid,
  windGrid: FieldGrid,
  stations: z.array(Station),
  frames: z.array(Frame),
  wind: z.array(WindFrame),
  fires: z.array(FireCell),
  airports: z.array(Airport),
});
export type HazeMap = z.infer<typeof HazeMap>;

export const StoredDay = z.object({
  day: z.string(),
  cells: z.number().int(),
  frpMw: z.number(),
  windHours: z.number().int(),
  airports: z.number().int(),
  hazeAirports: z.number().int(),
  monitors: z.number().int(),
  pm25: z.number().nullable(),
});
export type StoredDay = z.infer<typeof StoredDay>;

export const HazeDays = z.object({ days: z.array(StoredDay), hazeFrom: z.string().nullable() });
export type HazeDays = z.infer<typeof HazeDays>;

export const AirSource = z.enum(["doe", "nea", "openaq"]);
export type AirSource = z.infer<typeof AirSource>;

export const AirMonitor = z.object({
  id: z.string(),
  name: z.string(),
  source: AirSource,
  provider: z.string(),
  reference: z.boolean(),
  averaging: z.enum(["1h", "24h"]),
  lat: z.number(),
  lon: z.number(),
  pm25: z.array(z.number().nullable()).length(24),
});
export type AirMonitor = z.infer<typeof AirMonitor>;

export const HazeDay = z.object({
  day: z.string(),
  grid: FieldGrid,
  windGrid: FieldGrid,
  frames: z.array(Frame),
  wind: z.array(WindFrame),
  fires: z.array(FireCell),
  airports: z.array(Airport),
  monitors: z.array(AirMonitor),
});
export type HazeDay = z.infer<typeof HazeDay>;

export const DayOutlook = z.object({
  day: z.string(),
  observedPeak: z.number().int().nullable(),
  forecastPeak: z.number().int().nullable(),
  low: z.number().int().nullable(),
  high: z.number().int().nullable(),
  chance: z.record(z.string(), z.number()),
});
export type DayOutlook = z.infer<typeof DayOutlook>;

export const StationOutlook = z.object({
  station: Station,
  readings: z.array(z.object({ at: z.string(), api: z.number().int() })),
  forecast: z.array(z.object({ at: z.string(), api: z.number() })),
  days: z.array(DayOutlook),
  pm25: z.object({ at: z.string(), value: z.number() }).nullable(),
});
export type StationOutlook = z.infer<typeof StationOutlook>;

export const LeadScore = z.object({
  leadHours: z.number().int(),
  cases: z.number().int(),
  model: z.number().nullable(),
  persistence: z.number().nullable(),
});
export type LeadScore = z.infer<typeof LeadScore>;

export const Accuracy = z.object({ since: z.string().nullable(), leads: z.array(LeadScore) });
export type Accuracy = z.infer<typeof Accuracy>;

export const PlaceKind = z.enum(["station", "state", "district", "town", "place"]);
export type PlaceKind = z.infer<typeof PlaceKind>;

export const Place = z.object({
  name: z.string(),
  kind: PlaceKind,
  region: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
  nearest: z.object({ id: z.string(), name: z.string(), network: Network, km: z.number() }).nullable(),
});
export type Place = z.infer<typeof Place>;

export const PlaceList = z.object({ places: z.array(Place) });
export type PlaceList = z.infer<typeof PlaceList>;

export const Guideline = z.object({
  threshold: z.number().int(),
  sustainedDays: z.number().int().nullable(),
  audience: z.string(),
  action: z.string(),
  issuer: z.string(),
  source: z.string(),
});
export type Guideline = z.infer<typeof Guideline>;

export const GuidelineList = z.object({ guidelines: z.array(Guideline) });
export type GuidelineList = z.infer<typeof GuidelineList>;
