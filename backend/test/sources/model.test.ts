import { afterEach, describe, expect, it, vi } from "vitest";

import { TerminalError, UpstreamError } from "../../src/lib/errors";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { modelClient, parseHealth, parsePrediction } from "../../src/sources/model";
import { CONTRACT_FORECASTS, CONTRACT_VERSION, HEALTH_EMPTY_JSON, HEALTH_JSON, PREDICT_JSON } from "../fixtures/model-contract";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stands in for the service without a socket: the client's one fetch is answered as given. */
function answering(status: number, body: string): { calls: { url: string; method: string; body: string | null }[] } {
  const calls: { url: string; method: string; body: string | null }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : null });
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  });
  return { calls };
}

describe("the model service client", () => {
  it("reads a prediction and sorts a band the service wrote out of order", () => {
    const rows = parsePrediction(PREDICT_JSON);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ instrumentId: "CA24N", day: "2026-10-11", p10: 40, p50: 52, p90: 80, modelVersion: CONTRACT_VERSION });
    expect(rows[1]).toMatchObject({ p10: 30, p50: 45, p90: 70 });
  });

  it("refuses a shape it does not know, and text that is not JSON", () => {
    expect(() => parsePrediction(JSON.stringify({ forecasts: [] }))).toThrow(TerminalError);
    expect(() => parsePrediction("<html>")).toThrow(TerminalError);
    expect(() => parseHealth(JSON.stringify({ status: "down" }))).toThrow(TerminalError);
  });

  it("reads health with and without a live model", () => {
    expect(parseHealth(HEALTH_JSON)).toEqual({ modelVersion: CONTRACT_VERSION, trainedAt: new Date("2026-10-11T02:00:00Z") });
    expect(parseHealth(HEALTH_EMPTY_JSON)).toEqual({ modelVersion: null, trainedAt: null });
  });

  it("posts the hour asked for and parses the answer", async () => {
    const { calls } = answering(200, PREDICT_JSON);
    const rows = await modelClient("http://model.test:4002/").predict(new Date("2026-10-10T03:00:00Z"));
    expect(rows).toHaveLength(2);
    expect(calls).toEqual([{ url: "http://model.test:4002/predict", method: "POST", body: JSON.stringify({ asOf: "2026-10-10T03:00:00.000Z" }) }]);
  });

  it("reports a service with no promoted model as an upstream failure with its status", async () => {
    answering(503, JSON.stringify({ error: "no live model" }));
    await expect(modelClient("http://model.test:4002").predict(new Date())).rejects.toMatchObject({ name: "UpstreamError", status: 503 });
    await expect(modelClient("http://model.test:4002").predict(new Date())).rejects.toBeInstanceOf(UpstreamError);
  });

  it("has a fake that answers what it was handed and remembers each ask", async () => {
    const fake = new FakeModelClient(CONTRACT_FORECASTS);
    const asOf = new Date("2026-10-10T03:00:00Z");
    expect(await fake.predict(asOf)).toBe(CONTRACT_FORECASTS);
    expect(fake.asked).toEqual([asOf]);
    expect((await fake.health()).modelVersion).toBe(CONTRACT_VERSION);
    expect((await new FakeModelClient([]).health()).modelVersion).toBeNull();
  });
});
