import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HazeDay, HazeDays } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { ingestMetarHistory, ingestNeaHistory } from "../../src/jobs/history-observations";
import { ingestOpenAq, ingestOpenAqHistory } from "../../src/jobs/ingest-openaq";
import { metar, nea, openaq, readings, sourceFetches } from "../../src/repositories";
import { FakeMetarArchiveClient, FakeOpenAqClient } from "../../src/sources/__fakes__/fake.history";
import { FakeNeaClient } from "../../src/sources/__fakes__/fake.sources";
import { parseMetarArchive } from "../../src/sources/metar-archive";
import { parseNea } from "../../src/sources/nea";
import { parseOpenAqHours, parseOpenAqSensors } from "../../src/sources/openaq";
import { testApp } from "../app";
import { recordedCycle } from "../fixtures/cycle";
import { NEA_PM25_DAY_JSON, NEA_PSI_DAY_JSON } from "../fixtures/recorded-context";
import { METAR_ARCHIVE_CSV, OPENAQ_HOURS_JSON, OPENAQ_LOCATIONS_JSON } from "../fixtures/recorded-history";

afterAll(closePool);

/** The Taman Tun Dr. Ismail sensor, the one the recorded hours are from. */
const SENSOR = 11760952;
const MORNING = new Date("2025-07-20T00:00:00Z");

describe("reading what the history sources send", () => {
  it("reads the archive's lines as the same reports the live feed gives", () => {
    const reports = parseMetarArchive(METAR_ARCHIVE_CSV);
    expect(reports).toHaveLength(15);
    expect(reports[0]).toEqual({
      icao: "WIBB",
      name: "WIBB",
      lat: 0.4608,
      lon: 101.4445,
      observedAt: MORNING,
      visibilityM: 4000,
      weather: "HZ",
      raw: "WIBB 200000Z 35002KT 4000 HZ FEW013 24/22 Q1007 NOSIG",
    });
    expect(reports.find((report) => report.icao === "WSSS")).toMatchObject({ visibilityM: 10000, weather: null });
    expect(() => parseMetarArchive("Unknown station provided")).toThrow("the METAR archive answered");
  });

  it("keeps OpenAQ's fixed PM2.5 sensors and leaves Singapore's own regions to NEA", () => {
    const sensors = parseOpenAqSensors(OPENAQ_LOCATIONS_JSON);
    expect(sensors.map((sensor) => sensor.name)).toEqual(["Kuala Lumpur", "Setia Alam", "Taman Tun Dr. Ismail"]);
    expect(sensors[0]).toMatchObject({ provider: "AirNow", reference: true, lastAt: new Date("2024-10-29T03:00:00Z") });
    expect(sensors[2]).toMatchObject({ sensorId: SENSOR, locationId: 3331918, provider: "AirGradient", reference: false });
  });

  it("stamps an OpenAQ hour with its end", () => {
    const hours = parseOpenAqHours(OPENAQ_HOURS_JSON, SENSOR);
    expect(hours).toHaveLength(5);
    expect(hours[0]).toEqual({ sensorId: SENSOR, observedAt: new Date("2025-07-20T01:00:00Z"), pm25: 62.2 });
  });
});

describe("the history of what was measured, over what the sources recorded", () => {
  const pool = getPool();
  const metarArchive = new FakeMetarArchiveClient(parseMetarArchive(METAR_ARCHIVE_CSV));
  const sensors = new FakeOpenAqClient(parseOpenAqSensors(OPENAQ_LOCATIONS_JSON), parseOpenAqHours(OPENAQ_HOURS_JSON, SENSOR));
  const singapore = new FakeNeaClient(parseNea(NEA_PM25_DAY_JSON, NEA_PSI_DAY_JSON));
  const SEPTEMBER = new Date("2025-09-01T12:00:00Z");
  const JULY = new Date("2025-07-21T00:00:00Z");

  beforeAll(async () => {
    // The stations and the week of readings, so a past day can be told from the days the forecast runs on.
    await recordedCycle();
    await ingestMetarHistory({ pool, metarArchive }, "2025-07-20", SEPTEMBER);
    await ingestOpenAqHistory({ pool, openaq: sensors }, "2025-07-19", JULY);
  }, 120_000);

  it("stores the archived reports under airports the live feed has not named yet", async () => {
    const pekanbaru = await metar.forAirport(pool, "WIBB", MORNING);
    expect(pekanbaru.filter((report) => report.observedAt <= new Date("2025-07-20T02:00:00Z"))).toHaveLength(5);
    expect(pekanbaru[0]).toMatchObject({ visibilityM: 4000, weather: "HZ" });
    expect((await metar.airports(pool)).map((airport) => airport.icao)).toEqual(expect.arrayContaining(["WIBB", "WMKK", "WSSS"]));
  });

  it("asks the archive again only for the span that is still filling", async () => {
    expect(await sourceFetches.succeeded(pool, "metar-archive")).toContainEqual({ from: "2025-07-20", days: 30, airports: 3, reports: 15, added: expect.any(Number) });
    metarArchive.asked.length = 0;
    expect(await ingestMetarHistory({ pool, metarArchive }, "2025-07-20", SEPTEMBER)).toBe(0);
    expect(metarArchive.asked).toEqual([{ from: "2025-08-19", days: 10 }, { from: "2025-08-29", days: 4 }]);
  });

  it("fetches a sensor's past once, and after that only the hours since its newest stored one", async () => {
    sensors.asked.length = 0;
    expect(await ingestOpenAqHistory({ pool, openaq: sensors }, "2025-07-19", JULY)).toBe(0);
    // Done and recorded as done. Setia Alam stopped in January 2025 and the embassy in 2024, so neither was ever asked for July.
    expect(sensors.asked).toEqual([]);
    expect(await sourceFetches.succeeded(pool, "openaq")).toContainEqual(expect.objectContaining({ feed: "history", from: "2025-07-19", done: String(SENSOR) }));

    expect(await ingestOpenAq({ pool, openaq: sensors }, JULY)).toBe(0);
    expect(sensors.asked).toEqual([{ sensorId: SENSOR, from: new Date("2025-07-20T05:00:00Z"), to: JULY }]);
    const { oldest, newest } = await openaq.spanBySensor(pool);
    expect([oldest.get(SENSOR), newest.get(SENSOR)]).toEqual([new Date("2025-07-20T01:00:00Z"), new Date("2025-07-20T05:00:00Z")]);
  });

  it("steps past a sensor OpenAQ refuses, and leaves it to be asked again", async () => {
    const SETIA_ALAM = 7378800;
    const faulty = new FakeOpenAqClient(parseOpenAqSensors(OPENAQ_LOCATIONS_JSON), [], [SETIA_ALAM]);
    // In January 2025 Setia Alam was still reporting, so both sensors are asked.
    await ingestOpenAqHistory({ pool, openaq: faulty }, "2025-01-05", new Date("2025-01-20T00:00:00Z"));
    expect(faulty.asked.map((ask) => ask.sensorId)).toContain(SETIA_ALAM);
    const recorded = (await sourceFetches.succeeded(pool, "openaq")).filter((detail) => detail.from === "2025-01-05");
    expect(recorded.at(-1)).toMatchObject({ feed: "history", sensorsFailed: 1 });
    expect(recorded.every((detail) => !String(detail.done).split(",").includes(String(SETIA_ALAM)))).toBe(true);
    expect(recorded.at(-1)?.refused).toBe(String(SETIA_ALAM));
  });

  it("lets a sensor OpenAQ has just refused rest for a day in the hourly fetch", async () => {
    const noon = new Date();
    // The sensors as the recording has them, still reporting at the moment of the test.
    const faulty = new FakeOpenAqClient(parseOpenAqSensors(OPENAQ_LOCATIONS_JSON).map((sensor) => ({ ...sensor, lastAt: sensor.sensorId === SENSOR ? noon : sensor.lastAt })), [], [SENSOR]);
    // The first hourly fetch is refused the sensor and says so; the next one, within the day, does not ask.
    await ingestOpenAq({ pool, openaq: faulty }, noon);
    faulty.asked.length = 0;
    await ingestOpenAq({ pool, openaq: faulty }, noon);
    expect(faulty.asked).toEqual([]);
    expect((await sourceFetches.succeeded(pool, "openaq")).at(-1)).toMatchObject({ sensorsResting: 1, sensorsFailed: 0 });
  });

  it("keeps Singapore's past hours out of the readings the forecast runs on", async () => {
    const before = await readings.oldestAt(pool);
    await ingestNeaHistory({ pool, nea: singapore }, "2026-10-09", new Date("2026-10-09T10:00:00Z"));
    expect(singapore.asked).toEqual(["2026-10-09"]);
    expect(await sourceFetches.succeeded(pool, "nea-history")).toContainEqual({ from: "2026-10-09", days: 1, hours: 115, added: expect.any(Number) });
    expect((await nea.between(pool, new Date("2026-10-08T16:00:00Z"), new Date("2026-10-09T16:00:00Z"))).length).toBeGreaterThanOrEqual(115);
    expect(await readings.oldestAt(pool)).toEqual(before);
  });

  it("serves a past day with what was stored of each kind of data", async () => {
    const app = testApp();
    const { days } = HazeDays.parse((await request(app).get("/haze/days").expect(200)).body);
    // 62.2, 47.3, 31.9, 35.8 and 29.5 ug/m3 from the one sensor; two of the three airports reported haze.
    expect(days.find((entry) => entry.day === "2025-07-20")).toMatchObject({ airports: 3, hazeAirports: 2, monitors: 1, pm25: 41.3 });
    // A calendar: every day between the first stored and the last, with or without data.
    expect(days.find((entry) => entry.day === "2025-07-25")).toEqual({ day: "2025-07-25", cells: 0, frpMw: 0, windHours: 0, airports: 0, hazeAirports: 0, monitors: 0, pm25: null });

    const day = HazeDay.parse((await request(app).get("/haze/days/2025-07-20").expect(200)).body);
    expect(day.airports.map((airport) => airport.icao)).toEqual(["WIBB", "WMKK", "WSSS"]);
    expect(day.airports[0].reports[0]).toEqual({ at: "2025-07-20T00:30:00.000Z", m: 4000, wx: "HZ" });
    expect(day.monitors).toEqual([
      expect.objectContaining({ id: `openaq:${SENSOR}`, name: "Taman Tun Dr. Ismail", source: "openaq", provider: "AirGradient", reference: false, averaging: "1h", pm25: [62.2, 47.3, 31.9, 35.8, 29.5, ...new Array<null>(19).fill(null)] }),
    ]);
  });

  it("gives a day of the stored week DOE's stations as the 24 hour mean behind each reading", async () => {
    const day = HazeDay.parse((await request(testApp()).get("/haze/days/2026-10-09").expect(200)).body);
    const doe = day.monitors.filter((monitor) => monitor.source === "doe");
    // The recorded sample holds five of DOE's stations.
    expect(doe).toHaveLength(5);
    expect(doe.every((monitor) => monitor.averaging === "24h" && monitor.reference)).toBe(true);
    expect(day.monitors.filter((monitor) => monitor.source === "nea").map((monitor) => monitor.id)).toEqual(["nea:central", "nea:east", "nea:north", "nea:south", "nea:west"]);
  });
});
