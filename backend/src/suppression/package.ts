import type { AssetKind } from "../contracts.council";
import { TerminalError } from "../lib/errors";

/**
 * What Malaysia can send, as the council plans with it.
 *
 * The first part was offered on 17 September 2026 and accepted by Indonesia on
 * 18 September; the rest is assumption. By the user's decision (10 October
 * 2026) the council assumes Indonesia lets every aircraft and crew work
 * wherever it is needed, in Sumatra or Kalimantan, with no request to wait on. Every line says which,
 * and where it comes from, so the page can mark an assumed number as one.
 * Sources and reasoning: docs/council/03-assistance-package.md and
 * docs/council/research/02-campaigns-capacity.md.
 */

export type Basis = "fact" | "assumption";

/** Where an asset works: the team deployed to Indonesia, or Bomba at home. */
export type Mandate = "indonesia" | "malaysia";

export interface AssetLine {
  kind: AssetKind;
  label: string;
  /** Most units of this kind working on any one day. */
  maxUnits: number;
  /** Most days it can work in the deployment. */
  maxDays: number;
  /** Where it works. */
  mandate: Mandate;
  /** The first plan day it can work: aircraft fly in at once, crews need a day to set up, the task force must be flown in. */
  arrivesDay: number;
  basis: Basis;
  source: string;
}

export const PACKAGE = {
  /** Plan day 1 is this many UTC days after the data's day: the team was not reported deployed by 7 October 2026. */
  leadDays: 2,
  daysInTheatre: 14,
  budgetRm: { low: 11_000_000, high: 12_000_000, basis: "assumption" as Basis },
  assets: [
    {
      kind: "cl415",
      label: "CL-415MP scooper (APMM)",
      maxUnits: 1,
      maxDays: 10,
      mandate: "indonesia",
      arrivesDay: 1,
      basis: "fact",
      source: "Offered 17 Sep and accepted 18 Sep 2026; 10 operating days then about 100 hours of maintenance, as in Palembang, Oct 2015",
    },
    {
      kind: "helicopters",
      label: "Medium helicopters with buckets (NADMA, APMM, TUDM)",
      maxUnits: 3,
      maxDays: 14,
      mandate: "indonesia",
      arrivesDay: 1,
      basis: "fact",
      source: "Three helicopters in the accepted package, type not disclosed; buckets of 1,200 to 1,590 L assumed",
    },
    {
      kind: "ground_teams",
      label: "Lance teams of 6 from the 52 personnel",
      maxUnits: 2,
      maxDays: 13,
      mandate: "indonesia",
      arrivesDay: 2,
      basis: "assumption",
      source: "52 personnel accepted, mostly air crew and support; two teams of six is what they can spare",
    },
    {
      kind: "bomba_domestic",
      label: "Bomba firefighters on Malaysian fires",
      maxUnits: 100,
      maxDays: 14,
      mandate: "malaysia",
      arrivesDay: 1,
      basis: "assumption",
      source: "Bomba has about 15,000 staff already fighting local fires; how many can be spared is assumed",
    },
    {
      kind: "ground_task_force",
      label: "Bomba ground task force with pumps",
      maxUnits: 150,
      maxDays: 14,
      mandate: "indonesia",
      arrivesDay: 3,
      basis: "assumption",
      source: "Sized on the 2005 Riau deployment (100 firefighters plus 25 SMART), flown in by A400M",
    },
  ] satisfies AssetLine[],
} as const;

/** The UTC date of plan day 1 for data as of `asOf`. */
export function dayOneFor(asOf: Date): string {
  const day = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + PACKAGE.leadDays));
  return day.toISOString().slice(0, 10);
}

export function assetLine(kind: AssetKind): AssetLine {
  const line = PACKAGE.assets.find((asset) => asset.kind === kind);
  // AssetKind and PACKAGE list the same kinds; a miss is a programming error.
  if (!line) throw new TerminalError(`no package line for ${kind}`);
  return line;
}

/** People per lance team, for converting the Bomba kinds (counted in people) to teams. */
export const TEAM_SIZE = 6;

/** Whether an asset kind is counted in teams of people rather than aircraft. */
export function isGround(kind: AssetKind): boolean {
  return kind === "ground_teams" || kind === "bomba_domestic" || kind === "ground_task_force";
}
