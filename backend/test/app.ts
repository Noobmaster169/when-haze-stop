import { FakeLlmClient } from "../src/agents/__fakes__/fake.llm-client";
import { type AppDeps, createApp } from "../src/app";
import type { HealthReport } from "../src/contracts";
import { getPool } from "../src/db";
import { FakeGeocoder } from "../src/sources/__fakes__/fake.sources";

/** Everything answering, which is the uninteresting case every route test needs and none of them is about. */
export function allUp(): HealthReport {
  return { status: "ok", checks: { postgres: { status: "up" }, llmProxy: { status: "up", models: 4 } }, version: "test" };
}

/** An app wired to fakes, and any of them replaceable by the test that cares about it. */
export function testApp(overrides: Partial<AppDeps> = {}) {
  return createApp({
    pool: getPool(),
    health: async () => allUp(),
    // No test may reach the proxy. A chat route test scripts this instead.
    llm: new FakeLlmClient("{}"),
    // Nor a geocoder: a test that searches hands in the places it expects back.
    geocoder: new FakeGeocoder(),
    ...overrides,
  });
}

/** A step of the chat loop, as the model would write it. */
export const step = {
  final: (answer: string) => JSON.stringify({ action: "final", answer }),
  tool: (...calls: { tool: string; args?: Record<string, unknown>; thought?: string }[]) => JSON.stringify({ action: "tool", calls }),
};
