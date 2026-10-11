import { z } from "zod";

/**
 * Every request and response body the api speaks, as zod schemas with the TS
 * types derived from them. The frontend mirrors these by hand under
 * frontend/lib/api/ and parses every response, so a drift fails at the
 * boundary naming the field.
 */

export * from "./contracts.alerts";
export * from "./contracts.chat";
export * from "./contracts.council";
export * from "./contracts.council-run";
export * from "./contracts.haze";
export * from "./contracts.model";
export * from "./contracts.simulation";
export * from "./contracts.sources";
export * from "./contracts.statements";

export const CheckStatus = z.enum(["up", "down"]);
export type CheckStatus = z.infer<typeof CheckStatus>;

const check = <T extends z.ZodRawShape>(detail: T) =>
  z.object({ status: CheckStatus, latencyMs: z.number().optional(), ...detail });

export const HealthChecks = z.object({
  postgres: check({}),
  /** `models` catches a proxy serving an empty alias table, which otherwise looks like a working one. */
  llmProxy: check({ models: z.number().optional() }),
});
export type HealthChecks = z.infer<typeof HealthChecks>;

export const HealthReport = z.object({
  /**
   * `down` only when the api cannot do its job at all, which is postgres.
   * A proxy that is away is `degraded` and still a 200: every page but the
   * chat is served without it.
   */
  status: z.enum(["ok", "degraded", "down"]),
  checks: HealthChecks,
  /** The commit this image was built from, or "dev" outside one. */
  version: z.string(),
});
export type HealthReport = z.infer<typeof HealthReport>;

export const ModelList = z.object({
  models: z.array(z.object({ id: z.string(), provider: z.string(), model: z.string() })),
});
export type ModelList = z.infer<typeof ModelList>;
