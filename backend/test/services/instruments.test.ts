import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { openaq } from "../../src/repositories";
import { listInstruments } from "../../src/services/instruments";
import { parseOpenAqSensors } from "../../src/sources/openaq";
import { recordedCycle } from "../fixtures/cycle";
import { OPENAQ_LOCATIONS_JSON } from "../fixtures/recorded-history";

afterAll(closePool);

describe("the one list of instruments", () => {
  beforeAll(async () => {
    await recordedCycle();
    await openaq.upsertSensors(getPool(), parseOpenAqSensors(OPENAQ_LOCATIONS_JSON));
  }, 120_000);

  it("names every station, sensor and airport once, by the shared rule", async () => {
    const instruments = await listInstruments(getPool());
    const ids = instruments.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(instruments.find((item) => item.id === "CA16W")).toEqual({ id: "CA16W", kind: "doe", lat: 3.10626, lon: 101.717931 });
    expect(instruments.find((item) => item.id === "SGCENTRAL")).toMatchObject({ kind: "nea" });
    // The reference monitor at the US embassy in Kuala Lumpur, as OpenAQ lists it.
    expect(instruments.find((item) => item.id === "openaq:2085316")).toMatchObject({ kind: "openaq", lat: 3.15675, lon: 101.72145 });
    // Subang, the first airport of the recorded METAR sample.
    expect(instruments.find((item) => item.kind === "airport")).toMatchObject({ id: expect.stringMatching(/^W[A-Z]{3}$/) });
  });

  it("orders by kind then id, so a run and the model package see the same order", async () => {
    const kinds = (await listInstruments(getPool())).map((item) => item.kind);
    const order = ["doe", "nea", "openaq", "airport"];
    expect(kinds).toEqual([...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });
});
