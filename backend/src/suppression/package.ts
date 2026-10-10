import type { AssetKind, Consent } from "../contracts.council";
import { TerminalError } from "../lib/errors";

/**
 * What Malaysia can send, as the council plans with it.
 *
 * The first part was offered on 17 September 2026 and accepted by Indonesia on
 * 18 September for Kalimantan; the rest is assumption. Every line says which,
 * and where it comes from, so the page can mark an assumed number as one.
 * Sources and reasoning: docs/council/03-assistance-package.md and
 * docs/council/research/02-campaigns-capacity.md.
 */

export type Basis = "fact" | "assumption";

/** Where an asset may work without asking Indonesia for anything new. */
export type Mandate = "kalimantan" | "malaysia";

export interface AssetLine {
  kind: AssetKind;
  label: string;
  /** Most units of this kind working on any one day. */
  maxUnits: number;
  /** Most days it can work in the deployment. */
  maxDays: number;
  /** Where it may work as things stand. */
  mandate: Mandate;
  /** What it needs to work outside its mandate; null where it can never leave it. */
  consentToLeave: Consent | null;
  /** The first plan day it can work if its consent is asked for on day 1 and granted. */
  earliestWithConsent: number;
  basis: Basis;
  source: string;
}

export const PACKAGE = {
  /** Plan day 1. The team was not reported deployed by 7 October, so plans start two days after the data. */
  dayOne: "2026-10-12",
  daysInTheatre: 14,
  budgetRm: { low: 11_000_000, high: 12_000_000, basis: "assumption" as Basis },
  assets: [
    {
      kind: "cl415",
      label: "CL-415MP scooper (APMM)",
      maxUnits: 1,
      maxDays: 10,
      mandate: "kalimantan",
      consentToLeave: "sumatra",
      earliestWithConsent: 4,
      basis: "fact",
      source: "Offered 17 Sep and accepted 18 Sep 2026 for Kalimantan; 10 operating days then about 100 hours of maintenance, as in Palembang, Oct 2015",
    },
    {
      kind: "helicopters",
      label: "Medium helicopters with buckets (NADMA, APMM, TUDM)",
      maxUnits: 3,
      maxDays: 14,
      mandate: "kalimantan",
      consentToLeave: "sumatra",
      earliestWithConsent: 4,
      basis: "fact",
      source: "Three helicopters in the accepted package, type not disclosed; buckets of 1,200 to 1,590 L assumed",
    },
    {
      kind: "ground_teams",
      label: "Lance teams of 6 from the 52 personnel",
      maxUnits: 2,
      maxDays: 13,
      mandate: "kalimantan",
      consentToLeave: "sumatra",
      earliestWithConsent: 5,
      basis: "assumption",
      source: "52 personnel accepted, mostly air crew and support; two teams of six is what they can spare",
    },
    {
      kind: "bomba_domestic",
      label: "Bomba firefighters on Malaysian fires",
      maxUnits: 100,
      maxDays: 14,
      mandate: "malaysia",
      consentToLeave: null,
      earliestWithConsent: 1,
      basis: "assumption",
      source: "Bomba has about 15,000 staff already fighting local fires; how many can be spared is assumed",
    },
    {
      kind: "ground_task_force",
      label: "Bomba ground task force with pumps",
      maxUnits: 150,
      maxDays: 14,
      mandate: "kalimantan",
      consentToLeave: "sumatra",
      earliestWithConsent: 7,
      basis: "assumption",
      source: "Sized on the 2005 Riau deployment (100 firefighters plus 25 SMART); since 2015 Indonesia has accepted only aircraft, so it is itself a request",
    },
  ] satisfies AssetLine[],
} as const;

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
