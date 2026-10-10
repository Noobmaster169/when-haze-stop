import type { Assignment, AssetKind, Plan } from "../contracts.council";
import { distanceKm } from "../haze/grid";
import type { Attribution } from "./attribution";
import type { Complex } from "./complexes";
import { assetLine, PACKAGE } from "./package";
import { scorePlan } from "./score";
import { normalise, validate } from "./validate";

/**
 * The plans the council must beat, made without any model: the naive rules
 * ("biggest fire first", "nearest fire first") and a greedy search that adds
 * one piece of the package at a time wherever the engine says it helps most.
 * If the council's verdict does not beat the greedy plan, the page says so.
 */

type Draft = Pick<Plan, "title" | "assignments">;

/** The whole accepted package on one complex, for as long as each part can work. */
function wholePackageOn(complex: Complex): Assignment[] {
  const line = (asset: AssetKind, units: number, fromDay: number): Assignment => ({
    complexId: complex.id,
    asset,
    units,
    fromDay,
    toDay: Math.min(PACKAGE.daysInTheatre, fromDay + assetLine(asset).maxDays - 1),
    needsConsent: null,
  });
  return [line("cl415", 1, 1), line("helicopters", 3, 1), line("ground_teams", 2, 2)];
}

const inKalimantan = (complexes: Complex[]) => complexes.filter((complex) => complex.place.area === "kalimantan");

export function biggestFirst(complexes: Complex[]): Draft | null {
  const target = [...inKalimantan(complexes)].sort((a, b) => b.firePowerMw - a.firePowerMw)[0];
  return target ? { title: `Biggest fire first: everything on ${target.id}`, assignments: wholePackageOn(target) } : null;
}

export function nearestFirst(complexes: Complex[], target: { lat: number; lon: number }): Draft | null {
  const km = (complex: Complex) => distanceKm(target.lat, target.lon, complex.lat, complex.lon);
  const nearest = [...inKalimantan(complexes)].sort((a, b) => km(a) - km(b))[0];
  return nearest ? { title: `Nearest fire first: everything on ${nearest.id}`, assignments: wholePackageOn(nearest) } : null;
}

/** The package cut into the pieces the greedy search places one at a time. */
function pieces(withRequests: boolean): { asset: AssetKind; units: number; fromDay: number }[] {
  const list: { asset: AssetKind; units: number; fromDay: number }[] = [
    ...Array.from({ length: 4 }, () => ({ asset: "bomba_domestic" as const, units: 25, fromDay: 1 })),
    { asset: "cl415", units: 1, fromDay: 1 },
    ...Array.from({ length: 3 }, () => ({ asset: "helicopters" as const, units: 1, fromDay: 1 })),
    ...Array.from({ length: 2 }, () => ({ asset: "ground_teams" as const, units: 1, fromDay: 2 })),
  ];
  if (withRequests) list.push(...Array.from({ length: 6 }, () => ({ asset: "ground_task_force" as const, units: 25, fromDay: 7 })));
  return list;
}

/**
 * Each piece goes where it adds most to the expected share of the ceiling, on
 * the valid complexes, given the pieces already placed. Without requests it
 * keeps to what Indonesia has accepted; with them it may use Sumatra and a
 * ground task force, as a request would.
 */
export function greedy(attribution: Attribution, withRequests: boolean): Draft {
  const complexes = attribution.complexes.filter((complex) => attribution.contributions.has(complex.id));
  const allowed = (complex: Complex) => withRequests || complex.place.area !== "sumatra";
  let plan: Plan = { title: "", assignments: [], requests: [], share: null, rationale: "", assumptions: [], confidence: 0, dependsOn: "" };
  let best = 0;
  for (const piece of pieces(withRequests)) {
    let chosen: { plan: Plan; score: number } | null = null;
    for (const complex of complexes.filter(allowed)) {
      const toDay = Math.min(PACKAGE.daysInTheatre, piece.fromDay + assetLine(piece.asset).maxDays - 1);
      const merged = mergeInto(plan.assignments, { complexId: complex.id, asset: piece.asset, units: piece.units, fromDay: piece.fromDay, toDay, needsConsent: null });
      const candidate = normalise({ ...plan, assignments: merged }, complexes);
      if (validate(candidate, complexes).length > 0) continue;
      const score = scorePlan(candidate, attribution).expected;
      if (score > (chosen?.score ?? best)) chosen = { plan: candidate, score };
    }
    if (!chosen) continue;
    plan = chosen.plan;
    best = chosen.score;
  }
  return { title: withRequests ? "Greedy search, if Indonesia agrees" : "Greedy search, within what Indonesia accepted", assignments: plan.assignments };
}

/** Adds a piece to the plan, folding it into a line for the same complex, asset and days where there is one. */
function mergeInto(assignments: Assignment[], piece: Assignment): Assignment[] {
  const same = assignments.findIndex(
    (line) => line.complexId === piece.complexId && line.asset === piece.asset && line.fromDay === piece.fromDay && line.toDay === piece.toDay,
  );
  if (same < 0) return [...assignments, piece];
  return assignments.map((line, index) => (index === same ? { ...line, units: line.units + piece.units } : line));
}
