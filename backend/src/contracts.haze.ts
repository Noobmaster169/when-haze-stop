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
  /** The map's window, a week live and a day when looking back, oldest first. */
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

/**
 * One UTC day and what is stored for it of each of the four kinds of data a
 * forecast is trained and checked on: fires, wind, airport visibility and
 * measured PM2.5. A kind with nothing that day is zero, not missing.
 */
export const StoredDay = z.object({
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: z.string(),
  /** Burning 0.1 degree cells that day. */
  cells: z.number().int(),
  frpMw: z.number(),
  /** Hours of the day with wind stored, 0 to 24. */
  windHours: z.number().int(),
  /** Airports that reported that day. */
  airports: z.number().int(),
  /** Of those, the ones whose observer called it haze or smoke at least once. */
  hazeAirports: z.number().int(),
  /** Instruments that measured PM2.5: DOE stations, Singapore regions and OpenAQ sensors. */
  monitors: z.number().int(),
  /** The median of those instruments' means over the day, ug/m3. Null with no instrument. */
  pm25: z.number().nullable(),
});
export type StoredDay = z.infer<typeof StoredDay>;

export const HazeDays = z.object({
  /** Every day from the first with anything stored to today, oldest first. */
  days: z.array(StoredDay),
  /** The first hour the haze field exists for, or null before the first run. Earlier days have no field: DOE serves no readings from before the app first ran. */
  hazeFrom: z.string().nullable(),
});
export type HazeDays = z.infer<typeof HazeDays>;

/** Whose instrument measured it: a DOE station, a Singapore region, or a sensor OpenAQ gathers. */
export const AirSource = z.enum(["doe", "nea", "openaq"]);
export type AirSource = z.infer<typeof AirSource>;

/** One instrument's PM2.5 over a past day. */
export const AirMonitor = z.object({
  /** The source and the instrument's id there: `doe:CA01R`, `nea:east`, `openaq:11760952`. */
  id: z.string(),
  name: z.string(),
  source: AirSource,
  /** Who runs it: "Department of Environment Malaysia", "AirGradient". */
  provider: z.string(),
  /** A regulatory-grade monitor. False for a low-cost sensor, which follows the same rises and falls but can read high. */
  reference: z.boolean(),
  /** What each value is a mean over. DOE publishes only the 24 hour mean behind its index; the others measure the hour. */
  averaging: z.enum(["1h", "24h"]),
  lat: z.number(),
  lon: z.number(),
  /** PM2.5 in ug/m3 for each of the day's 24 hours, the first being the hour that ends at 01:00 UTC. Null where nothing was measured. */
  pm25: z.array(z.number().nullable()).length(24),
});
export type AirMonitor = z.infer<typeof AirMonitor>;

/** One past UTC day as the map draws it. `frames` is empty for a day before the first readings. */
export const HazeDay = z.object({
  day: z.string(),
  grid: FieldGrid,
  windGrid: FieldGrid,
  frames: z.array(Frame),
  wind: z.array(WindFrame),
  fires: z.array(FireCell),
  /** The airports that reported, with the day's reports and the three hours before, so the first hour has one to show. */
  airports: z.array(Airport),
  /** Every instrument that measured PM2.5 that day. */
  monitors: z.array(AirMonitor),
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

/** What a search result is: one of our stations, a gazetteer state, district or town, or something only the geocoder knew. */
export const PlaceKind = z.enum(["station", "state", "district", "town", "place"]);
export type PlaceKind = z.infer<typeof PlaceKind>;

export const Place = z.object({
  name: z.string(),
  kind: PlaceKind,
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

/** One city's air hour by hour, blended from the stations around it, with how far one could see. */
export const CityHour = z.object({
  at: z.string(),
  observed: z.boolean(),
  api: z.number().int(),
  pm25: z.number(),
  /** An estimate from optics, the most one could see: observed haze visibility has run shorter. */
  visibilityKm: z.number(),
  aerosolDepth: z.number(),
});
export type CityHour = z.infer<typeof CityHour>;

export const CityAir = z.object({
  city: z.object({ key: z.string(), name: z.string(), lat: z.number(), lon: z.number() }),
  stations: z.array(z.object({ id: z.string(), name: z.string(), km: z.number(), share: z.number() })),
  /** The newest reading's hour; null before any. */
  asOf: z.string().nullable(),
  /** The assumptions behind visibilityKm, for the page to state. */
  humidity: z.number(),
  massExtinction: z.number(),
  hours: z.array(CityHour),
});
export type CityAir = z.infer<typeof CityAir>;
