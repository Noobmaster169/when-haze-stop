import type { Assignment, Plan, PlanMeasures, ScenarioName } from "../contracts.council";
import { apiToPm25 } from "../haze/api-index";
import { type Attribution, mean } from "./attribution";
import { neighbours } from "./complexes";
import { keepByDay } from "./effect";
import { SCENARIOS } from "./scenarios";

/**
 * What a plan does to the target, read off the attribution: arithmetic only,
 * so the council can score every plan, variant and stress case in
 * milliseconds. The verdict's full engine run is the check on it.
 */

const OVER_100 = apiToPm25(100);
const OVER_200 = apiToPm25(200);
/** The benefit has arrived once it reaches this share of its peak. */
const ARRIVED = 0.1;

/** The share of each touched complex still burning on each plan day (index 0 is day 1), in one scenario. */
export function keepTable(plan: Pick<Plan, "assignments">, attribution: Attribution, scenario: ScenarioName): Map<string, number[]> {
  const byComplex = new Map<string, Assignment[]>();
  for (const assignment of plan.assignments) {
    if (!attribution.contributions.has(assignment.complexId)) continue;
    byComplex.set(assignment.complexId, [...(byComplex.get(assignment.complexId) ?? []), assignment]);
  }
  const near = neighbours(attribution.complexes.filter((complex) => attribution.contributions.has(complex.id)));
  const complexes = new Map(attribution.complexes.map((complex) => [complex.id, complex]));
  const table = new Map<string, number[]>();
  for (const [id, assignments] of byComplex) {
    const complex = complexes.get(id);
    if (!complex) continue;
    const pressured = (near.get(id) ?? []).some((other) => !byComplex.has(other));
    table.set(id, keepByDay(complex, assignments, SCENARIOS[scenario], attribution.days, pressured));
  }
  return table;
}

/** The hourly PM2.5 the plan removes at the target, in one scenario and one wind member. */
export function removedSeries(plan: Pick<Plan, "assignments">, attribution: Attribution, scenario: ScenarioName, member: number): Float32Array {
  const removed = new Float32Array(attribution.hours);
  for (const [id, keep] of keepTable(plan, attribution, scenario)) {
    const byDay = attribution.contributions.get(id)![member];
    for (let day = 1; day <= attribution.days && day < byDay.length; day++) {
      const cut = 1 - keep[day - 1];
      if (cut <= 0) continue;
      const series = byDay[day];
      for (let hour = 0; hour < removed.length; hour++) removed[hour] += cut * series[hour];
    }
  }
  return removed;
}

function hoursOver(series: Float32Array, line: number, minus?: Float32Array): number {
  let count = 0;
  for (let hour = 0; hour < series.length; hour++) if (series[hour] - (minus?.[hour] ?? 0) > line) count++;
  return count;
}

export function measure(plan: Pick<Plan, "assignments">, attribution: Attribution, scenario: ScenarioName, member: number): PlanMeasures {
  const removed = removedSeries(plan, attribution, scenario, member);
  const baseline = attribution.baseline[member];
  const ceiling = mean(attribution.ceiling[member]);
  const meanRemoved = mean(removed);
  let peakRemoved = 0;
  for (const value of removed) peakRemoved = Math.max(peakRemoved, value);
  const arrival = peakRemoved > 0 ? removed.findIndex((value) => value >= ARRIVED * peakRemoved) : -1;
  return {
    scenario,
    windMember: attribution.members[member].id,
    meanRemoved,
    peakRemoved,
    shareOfCeiling: ceiling > 0 ? meanRemoved / ceiling : 0,
    hoursOver100Avoided: hoursOver(baseline, OVER_100) - hoursOver(baseline, OVER_100, removed),
    hoursOver200Avoided: hoursOver(baseline, OVER_200) - hoursOver(baseline, OVER_200, removed),
    arrivalHours: arrival >= 0 ? arrival + 1 : null,
  };
}

export interface PlanScore {
  /** Every scenario in every wind member. */
  measures: PlanMeasures[];
  /** Mean over members of the central share of the ceiling: the plan's expected benefit. */
  expected: number;
  /** The worst member's central share: what the plan is worth if the wind goes against it. */
  worstWind: number;
  /** Mean over members of the pessimistic share. */
  pessimistic: number;
  optimistic: number;
}

export function scorePlan(plan: Pick<Plan, "assignments">, attribution: Attribution): PlanScore {
  const measures = (["optimistic", "central", "pessimistic"] as const).flatMap((scenario) =>
    attribution.members.map((_, member) => measure(plan, attribution, scenario, member)),
  );
  const shares = (scenario: ScenarioName) => measures.filter((item) => item.scenario === scenario).map((item) => item.shareOfCeiling);
  const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  return {
    measures,
    expected: average(shares("central")),
    worstWind: Math.min(...shares("central")),
    pessimistic: average(shares("pessimistic")),
    optimistic: average(shares("optimistic")),
  };
}
