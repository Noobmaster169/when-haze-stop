/**
 * The assistance package as the start panel shows it, mirrored by hand from
 * backend/src/suppression/package.ts (the api does not serve it yet). Each line
 * says whether it was offered and accepted or is an assumption the council
 * plans with, so an assumed number is never shown as a fact.
 */

export type Basis = "accepted" | "assumption";

export interface PackageLine {
  label: string;
  basis: Basis;
  note: string;
}

export const PACKAGE_LINES: PackageLine[] = [
  { label: "1 CL-415MP scooper", basis: "accepted", note: "Offered 17 Sep and accepted 18 Sep 2026, for Kalimantan" },
  { label: "3 helicopters", basis: "accepted", note: "In the accepted package; type not disclosed" },
  { label: "52 personnel", basis: "accepted", note: "Mostly air crew and support; two lance teams of six is assumed" },
  { label: "Up to 100 Bomba at home", basis: "assumption", note: "How many of about 15,000 Bomba staff can be moved is assumed" },
  { label: "14 days", basis: "assumption", note: "Days in theatre, on the 2015 Palembang cycle" },
];

/** Where the council's reasoning is written down, for the links that say what a number rests on. */
const DOCS = "https://github.com/Noobmaster169/when-haze-stop/blob/haze-product/docs/council";

export const DOC_LINKS = {
  package: `${DOCS}/03-assistance-package.md`,
  protocol: `${DOCS}/05-protocol.md`,
  roles: `${DOCS}/04-council-roles.md`,
  engine: `${DOCS}/06-engine-seam.md`,
  questions: `${DOCS}/10-open-questions.md`,
} as const;

export interface TargetChoice {
  id: string;
  name: string;
  enabled: boolean;
}

/** Only Kuala Lumpur and surroundings can be asked about yet; the others are listed so the scope is plain. */
export const TARGETS: TargetChoice[] = [
  { id: "klang-valley", name: "Kuala Lumpur and surroundings", enabled: true },
  { id: "johor-bahru", name: "Johor Bahru", enabled: false },
  { id: "kuching", name: "Kuching", enabled: false },
  { id: "penang", name: "Penang", enabled: false },
];
