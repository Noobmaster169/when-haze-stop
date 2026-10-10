import request from "supertest";
import { describe, expect, it } from "vitest";

import { HealthReport } from "../../src/contracts";
import { checkHealth } from "../../src/health";
import { allUp, testApp } from "../app";

const up = async () => ({});
const down = async () => {
  throw new Error("refused");
};

describe("health", () => {
  it("is ok when everything answers", async () => {
    const report = await checkHealth({ postgres: up, llmProxy: async () => ({ models: 4 }) });
    expect(HealthReport.parse(report)).toMatchObject({ status: "ok", checks: { llmProxy: { status: "up", models: 4 } } });
  });

  it("is degraded, not down, without the proxy", async () => {
    expect((await checkHealth({ postgres: up, llmProxy: down })).status).toBe("degraded");
  });

  it("is down without postgres, and the route answers 503", async () => {
    const report = await checkHealth({ postgres: down, llmProxy: up });
    expect(report.status).toBe("down");
    await request(testApp({ health: async () => report })).get("/health").expect(503);
    await request(testApp({ health: async () => allUp() })).get("/health").expect(200);
  });
});
