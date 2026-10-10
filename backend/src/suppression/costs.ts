import type { AssetKind, Plan } from "../contracts.council";

/**
 * What a plan costs Malaysia, in ringgit, so the council works inside the
 * money the government has set aside rather than with unlimited aircraft.
 *
 * Every rate is an assumption built from the figures in
 * docs/council/research/02-campaigns-capacity.md, section 6: the CL-415 at
 * about EUR 15,000 a flight hour and about 6 hours a working day; a medium
 * helicopter at about USD 6,000 a flight hour, 4 hours a day; personnel abroad
 * at RM 800 to 1,200 a person-day; two A400M rotations at about RM 0.9 million.
 * Bomba at home is far cheaper: its RM 1.092 billion budget for 2025 over about
 * 15,000 staff is about RM 200 a staff-day, plus field costs.
 */

export interface CostLine {
  label: string;
  rm: number;
}

export interface PlanCost {
  total: number;
  lines: CostLine[];
}

/** Ringgit per unit per working day: per aircraft, per lance team, per person for the two Bomba kinds. */
export const DAILY_RM: Record<AssetKind, number> = {
  cl415: 450_000,
  helicopters: 100_000,
  // The lance teams are formed from the 52 already deployed, whose cost is in the deployment line.
  ground_teams: 0,
  bomba_domestic: 250,
  ground_task_force: 900,
};

/** Sending the package abroad at all: the 52 personnel for about 16 days and two A400M rotations. */
export const DEPLOYMENT_RM = 1_700_000;
/** Flying the ground task force and its 30 t of pumps in and out. */
export const TASK_FORCE_AIRLIFT_RM = 900_000;

const LABELS: Record<AssetKind, string> = {
  cl415: "CL-415 water bomber",
  helicopters: "Helicopters",
  ground_teams: "Lance teams from the deployed crews",
  bomba_domestic: "Bomba firefighters at home",
  ground_task_force: "Bomba ground task force abroad",
};

/** The budgets a run can be given, in ringgit. The government's real figure is not public; this is the run's assumption. */
export const BUDGET_CHOICES = [4_000_000, 8_000_000, 12_000_000] as const;
export const DEFAULT_BUDGET_RM = 8_000_000;

export function planCost(plan: Pick<Plan, "assignments">): PlanCost {
  const byKind = new Map<AssetKind, number>();
  for (const line of plan.assignments) {
    const days = Math.max(0, line.toDay - line.fromDay + 1);
    byKind.set(line.asset, (byKind.get(line.asset) ?? 0) + days * line.units * DAILY_RM[line.asset]);
  }
  const lines: CostLine[] = [...byKind].filter(([, rm]) => rm > 0).map(([kind, rm]) => ({ label: LABELS[kind], rm }));
  const abroad = plan.assignments.some((line) => line.asset !== "bomba_domestic");
  if (abroad) lines.push({ label: "Sending the team abroad (crews and airlift)", rm: DEPLOYMENT_RM });
  if (plan.assignments.some((line) => line.asset === "ground_task_force")) lines.push({ label: "Airlifting the ground task force", rm: TASK_FORCE_AIRLIFT_RM });
  return { total: lines.reduce((sum, line) => sum + line.rm, 0), lines };
}

/** "RM 4.2 million", "RM 350,000": how money is said on the page and to the seats. */
export function ringgit(rm: number): string {
  if (rm >= 1_000_000) return `RM ${(rm / 1_000_000).toFixed(1)} million`;
  return `RM ${Math.round(rm).toLocaleString("en-MY")}`;
}

