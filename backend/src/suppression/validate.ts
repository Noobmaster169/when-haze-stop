import type { Plan, Violation } from "../contracts.council";
import type { Complex } from "./complexes";
import { planCost, ringgit } from "./costs";
import { assetLine, PACKAGE } from "./package";

/**
 * Whether a plan can be carried out with what Malaysia has and the money set
 * aside. Indonesia is assumed to let every aircraft and crew work wherever it is
 * needed, so the only rules about place are that Bomba's home teams stay home
 * and the deployed team works in Indonesia.
 */

/** A CL-415 scoops from open water; a target further than this from the sea is out of its reach. */
export const SCOOP_REACH_KM = 25;

/** With every request assumed granted, no line waits on Indonesia; whatever a model wrote there is cleared. */
export function normalise(plan: Plan): Plan {
  return { ...plan, assignments: plan.assignments.map((assignment) => ({ ...assignment, needsConsent: null })) };
}

/** Distance from each complex to open water, km; a complex missing from it is not checked for reach. */
export type CoastDistance = Map<string, number>;

export interface Limits {
  coastKm?: CoastDistance;
  /** The money the government has set aside for the operation, ringgit; unchecked where absent. */
  budgetRm?: number;
}

export function validate(plan: Plan, complexes: Complex[], limits: Limits = {}): Violation[] {
  const coastKm = limits.coastKm ?? new Map<string, number>();
  const byId = new Map(complexes.map((complex) => [complex.id, complex]));
  const violations: Violation[] = [];
  const flag = (assignment: number | null, rule: Violation["rule"], message: string) => violations.push({ assignment, rule, message });

  plan.assignments.forEach((assignment, index) => {
    const complex = byId.get(assignment.complexId);
    const line = assetLine(assignment.asset);
    if (!complex) return flag(index, "unknown_complex", `${assignment.complexId} is not one of the complexes on the fact sheet`);
    if (assignment.fromDay > assignment.toDay) flag(index, "days", `${assignment.complexId}: starts on day ${assignment.fromDay} after it ends on day ${assignment.toDay}`);
    if (assignment.toDay > PACKAGE.daysInTheatre) flag(index, "days", `${assignment.complexId}: runs to day ${assignment.toDay}, past the ${PACKAGE.daysInTheatre} days in theatre`);
    if (assignment.units > line.maxUnits) flag(index, "capacity", `${line.label}: ${assignment.units} asked for, ${line.maxUnits} available`);

    const malaysian = complex.place.country === "Malaysia";
    if (line.mandate === "malaysia" && !malaysian) flag(index, "asset_place", `${line.label} work only on Malaysian soil; ${complex.id} is in ${complex.place.province}, ${complex.place.country}`);
    if (line.mandate === "indonesia" && complex.place.country !== "Indonesia") {
      flag(index, "asset_place", `${line.label} are deployed to Indonesia; ${complex.id} is in ${complex.place.country}, which is Bomba's at home`);
    }
    const reach = coastKm.get(complex.id);
    if (assignment.asset === "cl415" && reach !== undefined && reach > SCOOP_REACH_KM) {
      flag(index, "reach", `the CL-415 must scoop within about ${SCOOP_REACH_KM} km; ${complex.id} is ${Math.round(reach)} km from open water`);
    }
  });

  // No asset can be in two places at once: per day, the units of each kind must fit the package.
  for (const line of PACKAGE.assets) {
    const mine = plan.assignments.filter((assignment) => assignment.asset === line.kind);
    let daysWorked = 0;
    for (let day = 1; day <= PACKAGE.daysInTheatre; day++) {
      const units = mine.filter((assignment) => day >= assignment.fromDay && day <= assignment.toDay).reduce((sum, assignment) => sum + assignment.units, 0);
      if (units > 0) daysWorked++;
      if (units > line.maxUnits) flag(null, "capacity", `${line.label}: ${units} working on day ${day}, ${line.maxUnits} available`);
    }
    if (daysWorked > line.maxDays) flag(null, "capacity", `${line.label}: ${daysWorked} days worked, at most ${line.maxDays}`);
  }
  const cost = planCost(plan).total;
  if (limits.budgetRm !== undefined && cost > limits.budgetRm) flag(null, "budget", `the plan costs ${ringgit(cost)}, over the budget of ${ringgit(limits.budgetRm)}`);
  // One capacity message per kind and day is enough to act on; repeats would bury the rest.
  return violations.filter((item, index, all) => all.findIndex((other) => other.message === item.message) === index);
}
