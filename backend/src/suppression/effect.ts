import type { Assignment } from "../contracts.council";
import type { Complex } from "./complexes";
import { assetLine, isGround, TEAM_SIZE } from "./package";
import type { Scenario } from "./scenarios";

/**
 * What a plan does to one complex's emissions, day by day.
 *
 * The rules are the suppression literature's (docs/council/02-decision-model.md
 * section 4): nothing changes before the crews arrive; ground crews put out
 * area at a rate, faster on surface fire than on peat; aircraft put out surface
 * fire but on peat only knock down the flame while they are overhead; peat
 * that was put out partly relights once the crews leave; and unsuppressed fire
 * next door keeps a share burning however hard the complex is worked.
 */

/** The first day an assignment can work: its own start, or later where the asset is still on its way. */
export function arrivalDay(assignment: Assignment): number {
  return Math.max(assignment.fromDay, assetLine(assignment.asset).arrivesDay);
}

function teams(assignment: Assignment): number {
  return assignment.asset === "ground_teams" ? assignment.units : assignment.units / TEAM_SIZE;
}

/** Hectares one assignment puts out (`out`) and knocks down for the day (`down`) on one working day. */
function dayWork(assignment: Assignment, complex: Complex, scenario: Scenario): { out: number; down: number } {
  if (isGround(assignment.asset)) {
    const rate = scenario.teamHaPerDay * (complex.peat ? 1 : scenario.surfaceSpeedup);
    return { out: teams(assignment) * rate, down: 0 };
  }
  const perUnit = assignment.asset === "cl415" ? scenario.scooperHaPerDay : scenario.helicopterHaPerDay;
  const hectares = perUnit * assignment.units;
  return complex.peat ? { out: 0, down: hectares } : { out: hectares, down: 0 };
}

/**
 * The share of the complex still burning on each plan day, index 0 for day 1.
 * One means untouched. `pressured` says unsuppressed fire lies next door.
 */
export function keepByDay(complex: Complex, assignments: Assignment[], scenario: Scenario, days: number, pressured: boolean): number[] {
  const area = Math.max(0.5, complex.detections * scenario.haPerDetection);
  const working = assignments.map((assignment) => ({ assignment, from: arrivalDay(assignment), to: Math.min(assignment.toDay, days) }));
  const lastWorked = Math.max(0, ...working.filter((work) => work.from <= work.to).map((work) => work.to));
  const keep: number[] = [];
  let out = 0;

  for (let day = 1; day <= days; day++) {
    let down = 0;
    for (const work of working) {
      if (day < work.from || day > work.to) continue;
      const done = dayWork(work.assignment, complex, scenario);
      out += done.out;
      down += done.down;
    }
    out = Math.min(area, out);
    const extinguished = out / area;
    let burning = 1 - extinguished;
    if (complex.peat && lastWorked > 0 && day > lastWorked) burning += extinguished * scenario.relapse;
    if (pressured) burning += extinguished * scenario.neighbourRelapse;
    if (down > 0) burning *= 1 - scenario.flamingShare * Math.min(1, down / area);
    keep.push(Math.min(1, Math.max(0, burning)));
  }
  return keep;
}
