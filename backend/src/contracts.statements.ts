import { z } from "zod";

/**
 * What the government has said about the haze, as the alerts page and the
 * assistant read it.
 *
 * Re-exported from contracts.ts and mirrored by hand in
 * frontend/lib/api/statement-schemas.ts.
 */

/** The states as the DOE station list names them, so an order can be matched to a station by name. */
export const STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "WP Kuala Lumpur",
  "WP Labuan",
  "WP Putrajaya",
] as const;
export const MalaysianState = z.enum(STATES);

export const StatementIssuer = z.enum(["moe", "doe", "nadma", "moh", "state", "ruler", "federal", "other"]);
export type StatementIssuer = z.infer<typeof StatementIssuer>;

/** `rule`: above a line, do something. `order`: named areas, from a date. `lift`: an earlier order ends. */
export const StatementKind = z.enum(["rule", "order", "lift", "advice"]);
export type StatementKind = z.infer<typeof StatementKind>;

export const StatementAction = z.enum(["schools-close", "outdoor-stop", "emergency", "work-from-home", "reopen", "other"]);
export type StatementAction = z.infer<typeof StatementAction>;

export const StatementStatus = z.enum(["upcoming", "in-force", "replaced", "ended"]);
export type StatementStatus = z.infer<typeof StatementStatus>;

export const Statement = z.object({
  /** The first item that reported it, which stays the same as more reports arrive. */
  id: z.number().int(),
  issuer: StatementIssuer,
  /** As the statement names it: "Ministry of Education", "Johor Regent". */
  issuerName: z.string(),
  kind: StatementKind,
  action: StatementAction,
  /** One English sentence. */
  summary: z.string(),
  /** The sentence it rests on, verbatim, usually Malay. */
  quote: z.string(),
  states: z.array(z.string()),
  districts: z.array(z.string()),
  nationwide: z.boolean(),
  threshold: z.number().int().nullable(),
  sustainedDays: z.number().int().nullable(),
  /** Malaysian calendar days, `YYYY-MM-DD`. */
  effectiveFrom: z.string().nullable(),
  effectiveUntil: z.string().nullable(),
  publishedAt: z.string(),
  /** The best link: the ministry or DOE original when one was fetched, else the first report. */
  url: z.string(),
  outlet: z.string(),
  /** How many fetched items said the same thing. */
  reports: z.number().int(),
  status: StatementStatus,
});
export type Statement = z.infer<typeof Statement>;

export const StatementPage = z.object({
  statements: z.array(Statement),
  page: z.number().int(),
  pages: z.number().int(),
  total: z.number().int(),
});
export type StatementPage = z.infer<typeof StatementPage>;
