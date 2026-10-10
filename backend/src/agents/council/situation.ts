import { mean } from "../../suppression/attribution";
import { DAILY_RM, DEPLOYMENT_RM, ringgit, TASK_FORCE_AIRLIFT_RM } from "../../suppression/costs";
import { PACKAGE } from "../../suppression/package";
import type { CouncilContext } from "./context";
import { complexLine, meanOf } from "./tools/format";

/**
 * The fact sheet every seat reads first (stage 0): the same words for all, so
 * any difference between their plans comes from their mandates and premises.
 * The rules are the research's defaults (docs/council/02-decision-model.md
 * section 6); a seat must argue against one with evidence, not ignore it.
 */

export const RULES = [
  "R1 Rank by influence on the target, never by fire power or distance.",
  "R2 Fire power measures flame; smouldering peat makes 3 to 6 times more particulate per kg burned for less heat. Never rank peat fires by fire power.",
  "R3 Send only what can finish the job or hold the advancing edge; half-suppressed peat relights.",
  "R4 Attack a cluster from its edge and as a whole, never its middle; unsuppressed fire within about 10 km relights it.",
  "R5 Aircraft knock down surface flame near water; they do not extinguish peat. The whole air package would saturate only 4 to 6 ha of deep peat.",
  "R6 Ground lance teams are the only tool that ends peat fires: 0.25 to 3 ha a team-day (central 1). About 1 ha of active front per detection (0.3 to 3).",
  "R7 Domestic fires are fast, need no consent, and 200 to 300 km away a small one can matter as much as a large one abroad.",
  "R8 Value suppression only until the rains; rain ended the haze in 1997, 2015 and 2019.",
  "R9 Influence holds only for its wind; prefer plans that hold up across the wind members.",
  "R10 A plan needing new Indonesian consent is a request with a lag, not an assignment.",
  "R11 The money is limited. A plan must fit the budget, so spend each ringgit where it removes the most smoke: aircraft cost far more a day than people, and do little to peat.",
];

const TOP = 18;

export function factSheet(ctx: CouncilContext): string {
  const { attribution, target } = ctx;
  const members = attribution.members.map((member, m) => `${member.id}: ${member.label}; ceiling ${mean(attribution.ceiling[m]).toFixed(2)} ug/m3`);
  const ranked = [...attribution.contributions.keys()]
    .map((id) => ({ id, share: meanOf(ctx.shares(id) ?? [0]) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, TOP)
    .map(({ id }) => complexLine(ctx.complex(id)!, ctx));
  const assets = PACKAGE.assets.map((line) => `- ${line.kind}: ${line.label}; up to ${line.maxUnits}${line.kind.includes("bomba") || line.kind === "ground_task_force" ? " people" : ""}, ${line.maxDays} days; works in ${line.mandate}${line.consentToLeave ? `, elsewhere only after a request (earliest day ${line.earliestWithConsent})` : ""}; ${line.basis}.`);
  return [
    `Target: ${target.name}. Data as of ${attribution.asOf}. Plan day 1 is ${attribution.dayOne}; the horizon is ${attribution.days} days.`,
    "The ceiling is the mean fire-smoke PM2.5 over the horizon at the target from smoke not yet emitted: the most that putting out every fire from day 1 could remove. A share is the part of that ceiling one complex causes.",
    "Wind members (the engine's forecast, then a past window of wind replayed; the future is uncertain):",
    ...members,
    `The ${TOP} complexes with most influence, of ${attribution.complexes.length} burning (ask get_complexes for more):`,
    ...ranked,
    "The package (units: aircraft, teams, or people for the Bomba lines):",
    ...assets,
    `Domestic Bomba works only on Malaysian soil. Everything else is deployed to Indonesia, accepted for Kalimantan only.`,
    `The money: the government has set aside ${ringgit(ctx.budgetRm)} for this operation, and no plan may cost more. Costs (assumptions from published rates): CL-415 ${ringgit(DAILY_RM.cl415)} a working day; each helicopter ${ringgit(DAILY_RM.helicopters)} a day; the lance teams come with the deployed crews; Bomba at home ${ringgit(DAILY_RM.bomba_domestic)} a person a day; the ground task force ${ringgit(DAILY_RM.ground_task_force)} a person a day plus ${ringgit(TASK_FORCE_AIRLIFT_RM)} to fly it in; sending anything abroad at all costs ${ringgit(DEPLOYMENT_RM)} (crews and airlift). simulate_plan and check_feasibility give a plan's cost.`,
    "What the research says (cite as R1 to R11):",
    ...RULES,
  ].join("\n");
}
