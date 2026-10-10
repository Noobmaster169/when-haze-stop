import { z } from "zod";

/**
 * The haze map: stations, the field over the region, fires, wind, and how good
 * the forecast has been.
 *
 * Re-exported from contracts.ts and mirrored by hand as zod schemas in
 * frontend/lib/api/haze-schemas.ts. Change one, change the other in the same
 * commit.
 */

/** Whose station it is: DOE Malaysia reads the API, NEA Singapore the PSI. Both are 24 hour indices on the same bands. */
export const Network = z.enum(["doe", "nea"]);
export type Network = z.infer<typeof Network>;

export const Station = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  network: Network,
  lat: z.number(),
  lon: z.number(),
  /** The newest reading, or null for a station that has reported nothing yet. */
  api: z.number().int().nullable(),
  observedAt: z.string().nullable(),
});
export type Station = z.infer<typeof Station>;

/** The geometry every frame is drawn on: row-major from the south-west corner. */
export const FieldGrid = z.object({
  lon0: z.number(),
  lat0: z.number(),
  nx: z.number().int(),
  ny: z.number().int(),
  step: z.number(),
});
export type FieldGrid = z.infer<typeof FieldGrid>;

export const Frame = z.object({
  validAt: z.string(),
  /** True at or before the run's `asOf`, where the field is pulled to the readings. */
  observed: z.boolean(),
  /** One byte a cell, base64: API / 2. */
  field: z.string(),
});
export type Frame = z.infer<typeof Frame>;

export const WindFrame = z.object({
  validAt: z.string(),
  /** Signed bytes, base64: metres a second times eight, u then v for each grid point. */
  uv: z.string(),
});
export type WindFrame = z.infer<typeof WindFrame>;

export const FireCell = z.object({ lat: z.number(), lon: z.number(), frpMw: z.number() });
export type FireCell = z.infer<typeof FireCell>;

export const RunSummary = z.object({
  id: z.number().int(),
  /** The newest reading the run was allowed to see. */
  asOf: z.string(),
  madeAt: z.string(),
  /** Spearman rank correlation of modelled smoke against readings before `asOf`. */
  rankCorrelation: z.number().nullable(),
  pairs: z.number().int(),
});
export type RunSummary = z.infer<typeof RunSummary>;

/** One airport weather report, thinned to the newest in each hour. */
export const VisibilityReport = z.object({
  at: z.string(),
  /** Prevailing visibility in metres; 10000 is ten kilometres or more. Null when the report gave none. */
  m: z.number().int().nullable(),
  /** The present weather as reported ("HZ" haze, "FU" smoke), or null. */
  wx: z.string().nullable(),
});
export type VisibilityReport = z.infer<typeof VisibilityReport>;

export const Airport = z.object({
  icao: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  /** The last week, oldest first. */
  reports: z.array(VisibilityReport),
});
export type Airport = z.infer<typeof Airport>;

export const HazeMap = z.object({
  /** Null until the model has run once. The page says so instead of drawing an empty sea. */
  run: RunSummary.nullable(),
  grid: FieldGrid,
  windGrid: FieldGrid,
  stations: z.array(Station),
  frames: z.array(Frame),
  wind: z.array(WindFrame),
  fires: z.array(FireCell),
  /** The visibility layer: every airport with its reports over the map's past week. */
  airports: z.array(Airport),
});
export type HazeMap = z.infer<typeof HazeMap>;

/** One stored UTC day of fires, for choosing a day to look back at. */
export const FireDay = z.object({
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: z.string(),
  /** Burning 0.1 degree cells that day. */
  cells: z.number().int(),
  frpMw: z.number(),
});
export type FireDay = z.infer<typeof FireDay>;

export const HazeDays = z.object({
  days: z.array(FireDay),
  /** The first hour the haze field exists for, or null before the first run. Earlier days have fires and wind only: DOE serves no readings from before the app first ran. */
  hazeFrom: z.string().nullable(),
});
export type HazeDays = z.infer<typeof HazeDays>;

/** One past UTC day as the map draws it. `frames` is empty for a day before the first readings. */
export const HazeDay = z.object({
  day: z.string(),
  grid: FieldGrid,
  windGrid: FieldGrid,
  frames: z.array(Frame),
  wind: z.array(WindFrame),
  fires: z.array(FireCell),
});
export type HazeDay = z.infer<typeof HazeDay>;

/** One day of a station's outlook against the official lines. */
export const DayOutlook = z.object({
  /** The local (UTC+8) calendar day. */
  day: z.string(),
  observedPeak: z.number().int().nullable(),
  forecastPeak: z.number().int().nullable(),
  low: z.number().int().nullable(),
  high: z.number().int().nullable(),
  /** Chance the day's peak passes each official line, 0 to 1, keyed by the line. */
  chance: z.record(z.string(), z.number()),
});
export type DayOutlook = z.infer<typeof DayOutlook>;

export const StationOutlook = z.object({
  station: Station,
  readings: z.array(z.object({ at: z.string(), api: z.number().int() })),
  forecast: z.array(z.object({ at: z.string(), api: z.number() })),
  days: z.array(DayOutlook),
  /** NEA's measured one-hour PM2.5 for a Singapore region, which DOE has no equivalent of. Null elsewhere. */
  pm25: z.object({ at: z.string(), value: z.number() }).nullable(),
});
export type StationOutlook = z.infer<typeof StationOutlook>;

export const LeadScore = z.object({
  leadHours: z.number().int(),
  cases: z.number().int(),
  /** Mean absolute error of this model, in API points. */
  model: z.number().nullable(),
  /** The same for "no change": the reading at `asOf`, carried forward. */
  persistence: z.number().nullable(),
});
export type LeadScore = z.infer<typeof LeadScore>;

export const Accuracy = z.object({ since: z.string().nullable(), leads: z.array(LeadScore) });
export type Accuracy = z.infer<typeof Accuracy>;

export const Place = z.object({
  name: z.string(),
  region: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
  /** The closest DOE station, which is where its readings and alerts come from. */
  nearest: z.object({ id: z.string(), name: z.string(), network: Network, km: z.number() }).nullable(),
});
export type Place = z.infer<typeof Place>;

export const PlaceList = z.object({ places: z.array(Place) });
export type PlaceList = z.infer<typeof PlaceList>;

/** An official line and what crossing it means, with where the rule is written down. */
export const Guideline = z.object({
  threshold: z.number().int(),
  /** `sustained` lines need the reading to stay above for this many days. */
  sustainedDays: z.number().int().nullable(),
  audience: z.string(),
  action: z.string(),
  issuer: z.string(),
  source: z.string(),
});
export type Guideline = z.infer<typeof Guideline>;

export const GuidelineList = z.object({ guidelines: z.array(Guideline) });
export type GuidelineList = z.infer<typeof GuidelineList>;
