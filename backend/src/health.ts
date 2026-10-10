import type { Pool } from "pg";
import { z } from "zod";

import { config } from "./config";
import type { CheckStatus, HealthReport } from "./contracts";

/**
 * What the system says about itself. Each probe returns the detail worth
 * reporting or throws, and `check` turns either into a reading: `/health` is
 * the one route whose whole job is to not have an exception.
 */

const TIMEOUT_MS = 2000;

/** The dependencies, behind one interface so a test can hand in ones that never dial anything. */
export interface Probes {
  postgres(): Promise<Record<string, never>>;
  llmProxy(): Promise<{ models?: number }>;
}

const ProxyHealth = z.object({ models: z.array(z.string()).optional() });

/**
 * The model gateway, through its own health endpoint and never through a
 * completion: `/healthz` reads the alias table and starts no session, so this
 * says the proxy is serving without saying anything about a cold model.
 */
async function probeLlmProxy(baseUrl: string): Promise<{ models?: number }> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/healthz`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`llm-proxy /healthz returned ${response.status}`);
  const body = ProxyHealth.safeParse(await response.json());
  return body.success && body.data.models ? { models: body.data.models.length } : {};
}

export function realProbes(pool: Pool): Probes {
  return {
    async postgres() {
      await pool.query("select 1");
      return {};
    },
    llmProxy: () => probeLlmProxy(config.LLM_PROXY_URL),
  };
}

async function check<T extends object>(probe: () => Promise<T>): Promise<{ status: CheckStatus; latencyMs: number } & Partial<T>> {
  const started = Date.now();
  try {
    const detail = await probe();
    return { status: "up", latencyMs: Date.now() - started, ...detail };
  } catch {
    // The reason is the dependency's to log. Here a probe that threw is a
    // reading like any other, and it reads "down".
    return { status: "down", latencyMs: Date.now() - started } as { status: CheckStatus; latencyMs: number } & Partial<T>;
  }
}

export async function checkHealth(probes: Probes): Promise<HealthReport> {
  const [postgres, llmProxy] = await Promise.all([check(probes.postgres), check(probes.llmProxy)]);
  const status = postgres.status === "down" ? "down" : llmProxy.status === "down" ? "degraded" : "ok";
  return { status, checks: { postgres, llmProxy }, version: config.GIT_SHA };
}
