import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SourceFetchPage, SourceReport } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { WEATHER_POINTS } from "../../src/haze/grid";
import { ingestWeather } from "../../src/jobs/ingest";
import { FakeDoeClient, FakeFiresClient, FakeMetarClient, FakeNeaClient, SilentWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import { testApp } from "../app";
import { recordedCycle } from "../fixtures/cycle";
import { FIRE_CELLS, LAST_HOUR, READINGS, STATIONS } from "../fixtures/recorded";

afterAll(closePool);

describe("every fetch of a source is kept and served", () => {
  const app = testApp();
  let report: SourceReport;

  beforeAll(async () => {
    await recordedCycle();
    const silent = {
      pool: getPool(),
      doe: new FakeDoeClient(STATIONS, READINGS),
      fires: new FakeFiresClient([]),
      weather: new SilentWeatherClient(),
      metar: new FakeMetarClient([]),
      nea: new FakeNeaClient([]),
    };
    await expect(ingestWeather(silent)).rejects.toThrow("did not answer");
    report = SourceReport.parse((await request(app).get("/sources").expect(200)).body);
  }, 120_000);

  const source = (id: string) => {
    const found = report.sources.find((entry) => entry.id === id);
    if (!found) throw new Error(`no source ${id} in the report`);
    return found;
  };

  it("records what DOE gave: the station list and the readings by state", () => {
    expect(source("doe-stations").lastSuccess?.detail).toEqual({ stations: STATIONS.length, states: 4 });
    const readings = source("doe-readings").lastSuccess?.detail ?? {};
    expect(Number(readings.requests) % 4).toBe(0);
    expect(readings.received).toBeGreaterThan(0);
    expect(readings.newestReading).toBe(LAST_HOUR.toISOString());
  });

  it("records the fire detections and the weather grid", () => {
    expect(source("firms").lastSuccess?.detail).toMatchObject({ detections: FIRE_CELLS.length });
    expect(source("open-meteo").lastSuccess?.detail).toMatchObject({ points: WEATHER_POINTS, hours: 200 });
    expect(source("open-meteo").day.ok).toBeGreaterThan(0);
  });

  it("keeps a failed fetch with its reason, beside the last good one", () => {
    const weather = source("open-meteo");
    expect(weather.lastFailure).toMatchObject({ ok: false, error: "Open-Meteo forecast did not answer", detail: {} });
    expect(weather.day.failed).toBeGreaterThan(0);
    expect(weather.marks.at(-1)).toMatchObject({ ok: false });
  });

  it("pages a source's fetches five at a time, newest first", async () => {
    const first = SourceFetchPage.parse((await request(app).get("/sources/fetches?source=open-meteo").expect(200)).body);
    expect(first).toMatchObject({ page: 1, pageSize: 5 });
    expect(first.fetches.length).toBeLessThanOrEqual(5);
    expect(first.fetches[0]).toMatchObject({ source: "open-meteo", ok: false });
    const second = SourceFetchPage.parse((await request(app).get("/sources/fetches?source=open-meteo&page=2").expect(200)).body);
    expect(second.total).toBe(first.total);
    await request(app).get("/sources/fetches?source=nope").expect(400);
  });

  it("records the airports' reports and Singapore's hours", () => {
    expect(source("metar").lastSuccess?.detail).toMatchObject({ airports: 29, reports: 29, newestReport: "2026-10-10T08:30:00.000Z" });
    expect(source("nea").lastSuccess?.detail).toMatchObject({ stations: 5, newestReading: "2026-10-10T09:00:00.000Z" });
    expect(Number(source("nea").lastSuccess?.detail.hours)).toBeGreaterThanOrEqual(23 * 5 + 5);
  });

  it("lists the sources that are not fetched on a schedule, with no history", () => {
    expect(source("geocoder")).toMatchObject({ tracked: false, lastSuccess: null, everyHours: null });
  });
});
