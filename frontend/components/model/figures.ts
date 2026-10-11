import type { HistogramBin, Kind, Station } from "@/lib/model-performance-schema";

/**
 * The few numbers the Model page derives rather than copies: a "within"
 * share read off the error histogram, and the station groups the small
 * multiples draw. Pure, so each is tested against the published file.
 */

export const KIND_LABEL: Record<Kind, string> = { doe: "DOE station", nea: "Singapore region", openaq: "Sensor" };

/** Share of station-days whose absolute error sits below `limit`, counted from bins that start below it; `limit` must fall on a bin edge. */
export function withinShare(bins: readonly HistogramBin[], limit: number, key: "model" | "noChange"): number {
  const total = bins.reduce((sum, bin) => sum + bin[key], 0);
  const inside = bins.filter((bin) => bin.low < limit).reduce((sum, bin) => sum + bin[key], 0);
  return total === 0 ? 0 : inside / total;
}

export interface StationGroup {
  title: string;
  stations: Station[];
}

export interface PanelSet {
  /** One y scale for every panel in the set, 0 to the set's highest value rounded up to 50, so panels compare at a glance. */
  top: number;
  groups: StationGroup[];
}

const STEP = 50;

function topOf(stations: readonly Station[]): number {
  const highest = Math.max(...stations.flatMap((station) => station.rows.flatMap((row) => [row.real, row.high, row.noChange, row.model])));
  return Math.max(STEP, Math.ceil(highest / STEP) * STEP);
}

/** DOE stations split by state, in the order the file lists them (DOE's own, north to south), so neighbours sit together. */
function byState(stations: readonly Station[]): StationGroup[] {
  const groups = new Map<string, Station[]>();
  for (const station of stations) {
    const state = station.state ?? "No state";
    groups.set(state, [...(groups.get(state) ?? []), station]);
  }
  return [...groups].map(([title, members]) => ({ title, stations: members }));
}

/** The three sets the page draws: Singapore regions, DOE stations by state, and sensors. A set with no stations is left out. */
export function panelSets(stations: readonly Station[]): { singapore: PanelSet | null; doe: PanelSet | null; sensors: PanelSet | null } {
  const pick = (kind: Kind): Station[] => stations.filter((station) => station.kind === kind);
  const set = (members: Station[], groups: StationGroup[]): PanelSet | null => (members.length === 0 ? null : { top: topOf(members), groups });
  const nea = pick("nea");
  const doe = pick("doe");
  const sensors = pick("openaq");
  return {
    singapore: set(nea, [{ title: "Singapore", stations: nea }]),
    doe: set(doe, byState(doe)),
    sensors: set(sensors, [{ title: "Sensors", stations: sensors }]),
  };
}
