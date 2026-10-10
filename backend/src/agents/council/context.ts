import type { Plan, ScoreSummary, Violation } from "../../contracts";
import { distanceKm } from "../../haze/grid";
import { type Attribution, shareOfCeiling } from "../../suppression/attribution";
import { coastKm } from "../../suppression/coast";
import type { Complex } from "../../suppression/complexes";
import { type PlanScore, scorePlan } from "../../suppression/score";
import type { TargetArea } from "../../suppression/targets";
import { normalise, validate } from "../../suppression/validate";

/**
 * The one world every seat reasons over: the frozen attribution, the facts
 * worked out from it once, and the board of plans with their engine scores.
 * Every tool reads this and nothing else, so all seats see the same numbers
 * and a replay can be checked against them.
 */

/** Airfields a deployed aircraft or crew would work from (coordinates from the airports' published positions). */
export const STAGING = [
  { name: "Pontianak", lat: -0.15, lon: 109.4, area: "kalimantan" },
  { name: "Ketapang", lat: -1.82, lon: 109.96, area: "kalimantan" },
  { name: "Pangkalan Bun", lat: -2.7, lon: 111.67, area: "kalimantan" },
  { name: "Palangka Raya", lat: -2.23, lon: 113.94, area: "kalimantan" },
  { name: "Jambi", lat: -1.64, lon: 103.64, area: "sumatra" },
  { name: "Palembang", lat: -2.9, lon: 104.7, area: "sumatra" },
  { name: "Pekanbaru", lat: 0.46, lon: 101.45, area: "sumatra" },
] as const;

export interface Logistics {
  kmToTarget: number;
  staging: { name: string; km: number };
  coastKm: number;
}

export interface BoardPlan {
  id: string;
  by: string;
  premise: string | null;
  plan: Plan;
  violations: Violation[];
  score: PlanScore;
  baseline: boolean;
}

export interface CouncilContext {
  attribution: Attribution;
  target: TargetArea;
  complex(id: string): Complex | undefined;
  /** Share of the ceiling per wind member, for a complex with a contribution; null otherwise. */
  shares(id: string): number[] | null;
  logistics(id: string): Logistics | undefined;
  /** Validates, scores and pins a plan to the board under a new id. */
  table(entry: { by: string; premise: string | null; plan: Plan; baseline?: boolean }): BoardPlan;
  /** Scores a plan without tabling it: a variant, a what-if. */
  tryPlan(plan: Plan): { plan: Plan; violations: Violation[]; score: PlanScore };
  plans(): BoardPlan[];
  plan(id: string): BoardPlan | undefined;
}

export function summarise(score: PlanScore): ScoreSummary {
  const central = score.measures.filter((item) => item.scenario === "central");
  const average = (pick: (item: (typeof central)[number]) => number) => central.reduce((sum, item) => sum + pick(item), 0) / Math.max(1, central.length);
  const arrivals = central.map((item) => item.arrivalHours).filter((hours): hours is number => hours !== null);
  return {
    expected: score.expected,
    worstWind: score.worstWind,
    pessimistic: score.pessimistic,
    optimistic: score.optimistic,
    meanRemoved: average((item) => item.meanRemoved),
    peakRemoved: average((item) => item.peakRemoved),
    hoursOver100Avoided: average((item) => item.hoursOver100Avoided),
    arrivalHours: arrivals.length ? Math.min(...arrivals) : null,
  };
}

export function councilContext(attribution: Attribution, target: TargetArea): CouncilContext {
  const byId = new Map(attribution.complexes.map((complex) => [complex.id, complex]));
  const logistics = new Map<string, Logistics>();
  for (const complex of attribution.complexes) {
    if (!attribution.contributions.has(complex.id)) continue;
    const bases = STAGING.filter((base) => base.area === complex.place.area);
    const nearest = bases
      .map((base) => ({ name: base.name, km: distanceKm(complex.lat, complex.lon, base.lat, base.lon) }))
      .sort((a, b) => a.km - b.km)[0];
    logistics.set(complex.id, {
      kmToTarget: distanceKm(target.centre.lat, target.centre.lon, complex.lat, complex.lon),
      // A Malaysian fire is reached by road from the nearest Bomba station, not from an airfield.
      staging: nearest ?? { name: "Bomba, by road", km: 0 },
      coastKm: coastKm(complex.lat, complex.lon),
    });
  }
  const board: BoardPlan[] = [];
  const tryPlan = (plan: Plan) => {
    const normalised = normalise(plan, attribution.complexes);
    return { plan: normalised, violations: validate(normalised, attribution.complexes), score: scorePlan(normalised, attribution) };
  };
  return {
    attribution,
    target,
    complex: (id) => byId.get(id),
    shares: (id) => (attribution.contributions.has(id) ? attribution.members.map((_, member) => shareOfCeiling(attribution, id, member)) : null),
    logistics: (id) => logistics.get(id),
    table({ by, premise, plan, baseline = false }) {
      const entry: BoardPlan = { id: `P${board.length + 1}`, by, premise, baseline, ...tryPlan(plan) };
      board.push(entry);
      return entry;
    },
    tryPlan,
    plans: () => [...board],
    plan: (id) => board.find((entry) => entry.id === id),
  };
}
