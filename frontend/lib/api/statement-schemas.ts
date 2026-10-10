import { z } from "zod";

/** The statements contract, mirrored by hand from backend/src/contracts.statements.ts. */

export const StatementIssuer = z.enum(["moe", "doe", "nadma", "moh", "state", "ruler", "federal", "other"]);
export type StatementIssuer = z.infer<typeof StatementIssuer>;

export const StatementKind = z.enum(["rule", "order", "lift", "advice"]);
export const StatementAction = z.enum(["schools-close", "outdoor-stop", "emergency", "work-from-home", "reopen", "other"]);
export const StatementStatus = z.enum(["upcoming", "in-force", "replaced", "ended"]);
export type StatementStatus = z.infer<typeof StatementStatus>;

export const Statement = z.object({
  id: z.number().int(),
  issuer: StatementIssuer,
  issuerName: z.string(),
  kind: StatementKind,
  action: StatementAction,
  summary: z.string(),
  quote: z.string(),
  states: z.array(z.string()),
  districts: z.array(z.string()),
  nationwide: z.boolean(),
  threshold: z.number().int().nullable(),
  sustainedDays: z.number().int().nullable(),
  effectiveFrom: z.string().nullable(),
  effectiveUntil: z.string().nullable(),
  publishedAt: z.string(),
  url: z.string(),
  outlet: z.string(),
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
