import type { Complex } from "./complexes";

/**
 * Where the target's coming smoke comes from: the source-receptor matrix the
 * engine seam builds once per council run (docs/council/06-engine-seam.md).
 *
 * The engine's transport is linear in emissions, so the smoke a set of
 * complexes causes is the sum of what each causes, and taking a share of a
 * complex's emissions away on a day takes the same share of that day's
 * contribution away. Every plan is scored from this alone.
 */

export interface WindMember {
  id: string;
  /** How the member's wind was made, for the page: "forecast to 14 Oct, then 30 Sep to 9 Oct replayed". */
  label: string;
}

/** Mean wind at smoke height and total rain over the horizon at a few places, in one wind member. */
export interface WindSummary {
  member: string;
  places: { name: string; lat: number; lon: number; u: number; v: number; rainMm: number }[];
}

export interface Attribution {
  /** The hour of data the council reasons over. Series index i is the hour `asOf` + i + 1. */
  asOf: string;
  /** The UTC date of plan day 1. */
  dayOne: string;
  hours: number;
  /** Plan days covered. Contributions are indexed 0 to `days`, 0 being emissions before day 1, which no plan can touch. */
  days: number;
  members: WindMember[];
  /** Per member, the target's 24-hour PM2.5 with no plan, ug/m3, hourly. */
  baseline: Float32Array[];
  /** Per member, the part of `baseline` caused by emissions on day 1 or later: what putting out every fire could remove. */
  ceiling: Float32Array[];
  /** Complex id, then member, then plan day: the complex's contribution to the target, ug/m3, hourly. */
  contributions: Map<string, Float32Array[][]>;
  complexes: Complex[];
  winds: WindSummary[];
}

export function mean(series: Float32Array): number {
  if (series.length === 0) return 0;
  let sum = 0;
  for (const value of series) sum += value;
  return sum / series.length;
}

/** A complex's share of the ceiling in one member, 0 to 1. */
export function shareOfCeiling(attribution: Attribution, complexId: string, member: number): number {
  const byDay = attribution.contributions.get(complexId)?.[member];
  const ceiling = mean(attribution.ceiling[member]);
  if (!byDay || ceiling <= 0) return 0;
  let total = 0;
  for (let day = 1; day < byDay.length; day++) total += mean(byDay[day]);
  return total / ceiling;
}

const AREA_NAMES: Record<Complex["place"]["area"], string> = {
  sumatra: "Sumatra",
  kalimantan: "Kalimantan",
  peninsula: "Peninsular Malaysia",
  malaysian_borneo: "Sarawak and Sabah",
  other: "Elsewhere",
};

/**
 * Where the target's coming smoke comes from, by area: each area's part of the
 * most that could be removed, averaged over the wind members. Fires too small
 * or too far to have their own contribution are counted together as the rest.
 */
export function sharesByArea(attribution: Attribution): { area: string; share: number }[] {
  const byArea = new Map<string, number>();
  const complexes = new Map(attribution.complexes.map((complex) => [complex.id, complex]));
  for (const id of attribution.contributions.keys()) {
    const area = AREA_NAMES[complexes.get(id)?.place.area ?? "other"];
    const share = attribution.members.reduce((sum, _, member) => sum + shareOfCeiling(attribution, id, member), 0) / Math.max(1, attribution.members.length);
    byArea.set(area, (byArea.get(area) ?? 0) + share);
  }
  const named = [...byArea].map(([area, share]) => ({ area, share })).sort((a, b) => b.share - a.share);
  const rest = 1 - named.reduce((sum, item) => sum + item.share, 0);
  return rest > 0.005 ? [...named, { area: "Smaller or farther fires", share: rest }] : named;
}
