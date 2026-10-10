import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HazeDay, HazeDays } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { FIXED_MIN_DAYS } from "../../src/haze/fixed-sources";
import { type HistoryDeps, ingestFireHistory, ingestFixedSources, ingestWeatherHistory } from "../../src/jobs/history";
import { fires, fixedSources, sourceFetches, weather } from "../../src/repositories";
import { FakeFireArchiveClient, FakeWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import { parseFirmsCsv } from "../../src/sources/firms";
import { type ArchiveSpan, parseFixedSources } from "../../src/sources/firms-archive";
import { testApp } from "../app";
import { recordedCycle } from "../fixtures/cycle";
import { LABELLED_KERTEH, LIVE_FIRE, LIVE_KERTEH } from "../fixtures/recorded-archive";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

/** The recorded rows cover these days and nothing else, so the archive is said to hold only them. */
const SPANS: ArchiveSpan[] = [
  { satellite: "snpp", labelled: true, from: "2025-12-01", to: "2025-12-05" },
  { satellite: "snpp", labelled: false, from: "2026-08-01", to: "2026-08-05" },
  { satellite: "noaa20", labelled: false, from: "2026-08-01", to: "2026-08-05" },
  { satellite: "noaa21", labelled: false, from: "2026-08-01", to: "2026-08-05" },
];
const LIVE = [...LIVE_KERTEH, LIVE_FIRE].flatMap((group) => parseFirmsCsv(group.csv, group.satellite));
const NOON_5_AUGUST = new Date("2026-08-05T12:00:00Z");
/** The 0.1 degree cells of the two halves of the Kerteh complex, and of the Kalimantan fire. */
const KERTEH = [
  { lat10: 45, lon10: 1034 },
  { lat10: 46, lon10: 1033 },
];
const FIRE = { lat10: -19, lon10: 1101 };

describe("the history job, over what the archive recorded", () => {
  let deps: HistoryDeps;
  let archive: FakeFireArchiveClient;

  beforeAll(async () => {
    // The week the hourly cycle stores, so the weather history has something to join up with.
    await recordedCycle();
    archive = new FakeFireArchiveClient(SPANS, LIVE, { snpp: parseFixedSources(LABELLED_KERTEH) });
    deps = { pool: getPool(), archive, weather: new FakeWeatherClient(steadyWind(new Date("2026-10-06T00:00:00Z"), 24, 3, 3), (start, hours) => steadyWind(start, hours, 3, 3)) };
    await ingestFixedSources(deps);
    await ingestFireHistory(deps, NOON_5_AUGUST);
  }, 120_000);

  it("keeps the cells NASA labelled on enough days as fixed sources", async () => {
    const sites = await fixedSources.sites(deps.pool, FIXED_MIN_DAYS);
    expect(sites).toEqual(expect.arrayContaining([{ lat100: 455, lon100: 10345 }, { lat100: 465, lon100: 10337 }]));
  });

  it("stores the fires of the archived days without the gas complex in them", async () => {
    const august = (await fires.since(deps.pool, "2026-08-01")).filter((cell) => cell.day <= "2026-08-05");
    const at = (where: { lat10: number; lon10: number }) => august.filter((cell) => cell.lat10 === where.lat10 && cell.lon10 === where.lon10);
    // The northern half is gone on all five days. Of the southern, only the two hotspots 4 km off it on 1 August are left.
    expect(at(KERTEH[1])).toEqual([]);
    expect(at(KERTEH[0])).toEqual([{ day: "2026-08-01", ...KERTEH[0], frpMw: expect.closeTo(5.42, 2) }]);
    expect(at(FIRE)).toEqual([{ day: "2026-08-01", ...FIRE, frpMw: expect.closeTo(65.15, 2) }]);
  });

  it("drops a single faint pixel no second pass confirmed", async () => {
    // 5 August, 17 km west of the complex: one detection of 2 MW from one satellite.
    const august = await fires.since(deps.pool, "2026-08-05");
    expect(august.filter((cell) => cell.lat10 === 45 && cell.lon10 === 1032)).toEqual([]);
  });

  it("serves the stored days and one of them for the map to draw", async () => {
    const app = testApp();
    const { days, hazeFrom } = HazeDays.parse((await request(app).get("/haze/days").expect(200)).body);
    expect(days.find((entry) => entry.day === "2026-08-01")).toEqual({ day: "2026-08-01", cells: 2, frpMw: 71 });
    expect(days.map((entry) => entry.day)).toEqual([...days.map((entry) => entry.day)].sort());
    expect(hazeFrom).not.toBeNull();

    const august = HazeDay.parse((await request(app).get("/haze/days/2026-08-01").expect(200)).body);
    expect(august.fires).toHaveLength(2);
    expect(august.fires[0]).toEqual({ lat: expect.closeTo(-1.85, 5), lon: expect.closeTo(110.15, 5), frpMw: 65 });
    expect(august.frames).toEqual([]);

    const october = HazeDay.parse((await request(app).get("/haze/days/2026-10-09").expect(200)).body);
    expect(october.frames.length).toBeGreaterThan(0);
    expect(october.wind).toHaveLength(9);
    await request(app).get("/haze/days/yesterday").expect(400);
  });

  it("records each span it fetched, and asks only for the unsettled days when run again", async () => {
    const recorded = await sourceFetches.succeeded(deps.pool, "firms-archive");
    expect(recorded).toContainEqual({ feed: "labelled", satellite: "snpp", from: "2025-12-01", days: 5, fixedSeen: 19, fixedAdded: expect.any(Number) });
    expect(recorded).toContainEqual(expect.objectContaining({ feed: "live", from: "2026-08-01", days: 5, detections: LIVE.length, fixedDropped: 64 }));

    archive.asked.length = 0;
    await ingestFixedSources(deps);
    await ingestFireHistory(deps, NOON_5_AUGUST);
    expect(archive.asked.filter((call) => call.labelled)).toEqual([]);
    expect(archive.asked.filter((call) => !call.labelled)).toHaveLength(3);
  });

  it("fills the wind back to the day asked for and stops at what is stored", async () => {
    await ingestWeatherHistory(deps, "2026-10-05", new Date("2026-10-10T08:00:00Z"));
    expect(await weather.earliestAt(deps.pool)).toEqual(new Date("2026-10-05T00:00:00Z"));
    const grid = await weather.load(deps.pool, new Date("2026-10-05T00:00:00Z"), new Date("2026-10-07T00:00:00Z"));
    expect(grid?.hours).toBe(49);
    expect(await ingestWeatherHistory(deps, "2026-10-05", new Date("2026-10-10T08:00:00Z"))).toBe(0);
  });

  it("refuses a span of wind that stops short, rather than leave a hole", async () => {
    const short = { ...deps, weather: new FakeWeatherClient(steadyWind(new Date("2026-10-06T00:00:00Z"), 24, 3, 3), (start) => steadyWind(start, 20, 3, 3)) };
    await expect(ingestWeatherHistory(short, "2026-10-04", new Date("2026-10-10T08:00:00Z"))).rejects.toThrow("stops 4 hours short");
    expect(await weather.earliestAt(deps.pool)).toEqual(new Date("2026-10-05T00:00:00Z"));
  });
});
