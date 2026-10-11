import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { WEATHER_POINTS } from "../../src/haze/grid";
import { dailyWindAt } from "../../src/haze/wind-at";
import { writeDataset } from "../../src/jobs/dataset";
import { ingestMetarHistory } from "../../src/jobs/history-observations";
import { ingestOpenAqHistory } from "../../src/jobs/ingest-openaq";
import { FakeMetarArchiveClient, FakeOpenAqClient } from "../../src/sources/__fakes__/fake.history";
import { parseMetarArchive } from "../../src/sources/metar-archive";
import { parseOpenAqHours, parseOpenAqSensors } from "../../src/sources/openaq";
import { recordedCycle } from "../fixtures/cycle";
import { METAR_ARCHIVE_CSV, OPENAQ_HOURS_JSON, OPENAQ_LOCATIONS_JSON } from "../fixtures/recorded-history";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

describe("the wind at one place", () => {
  it("is the grid's own wind where the wind is the same everywhere, a day at a time", () => {
    // 36 hours of 3 m/s to the east and 4 to the north from midnight: one whole day and half of the next.
    const grid = steadyWind(new Date("2026-10-06T00:00:00Z"), 36, 3, 4);
    expect(grid.u).toHaveLength(36 * WEATHER_POINTS);
    const days = dailyWindAt(grid, 3.14, 101.69);
    expect(days.map((day) => [day.day, day.hours])).toEqual([["2026-10-06", 24], ["2026-10-07", 12]]);
    expect(days[0].u).toBeCloseTo(3, 5);
    expect(days[0].v).toBeCloseTo(4, 5);
    expect(dailyWindAt(grid, 20, 101.69)).toEqual([]);
  });
});

describe("the history as tables for training", () => {
  const SENSOR = 11760952;
  let dir: string;
  let counts: Record<string, number>;
  const table = async (name: string): Promise<string[][]> =>
    gunzipSync(await readFile(join(dir, `${name}.csv.gz`))).toString("utf8").trim().split("\n").map((line) => line.split(","));

  beforeAll(async () => {
    const pool = getPool();
    await recordedCycle();
    await ingestMetarHistory({ pool, metarArchive: new FakeMetarArchiveClient(parseMetarArchive(METAR_ARCHIVE_CSV)) }, "2025-07-20", new Date("2025-09-01T12:00:00Z"));
    await ingestOpenAqHistory({ pool, openaq: new FakeOpenAqClient(parseOpenAqSensors(OPENAQ_LOCATIONS_JSON), parseOpenAqHours(OPENAQ_HOURS_JSON, SENSOR)) }, "2025-07-19", new Date("2025-07-21T00:00:00Z"));
    dir = await mkdtemp(join(tmpdir(), "haze-dataset-"));
    counts = await writeDataset(pool, dir, "2025-07-01", new Date("2026-10-10T08:00:00Z"));
  }, 120_000);

  it("names every instrument once, of all four kinds", async () => {
    const rows = await table("instruments");
    expect(rows[0]).toEqual(["instrument_id", "kind", "name", "provider", "reference", "averaging", "lat", "lon"]);
    expect(rows).toHaveLength(counts.instruments + 1);
    const kinds = new Set(rows.slice(1).map((row) => row[1]));
    expect([...kinds].sort()).toEqual(["airport", "doe", "nea", "openaq"]);
    expect(rows.find((row) => row[0] === `openaq:${SENSOR}`)?.slice(1, 6)).toEqual(["openaq", "Taman Tun Dr. Ismail", "AirGradient", "false", "1h"]);
  });

  it("gives each ground truth a row an instrument and day, as measured", async () => {
    const pm25 = await table("pm25_daily");
    // 62.2, 47.3, 31.9, 35.8 and 29.5 ug/m3 on the morning of 20 July 2025.
    expect(pm25.find((row) => row[0] === `openaq:${SENSOR}` && row[1] === "2025-07-20")).toEqual([`openaq:${SENSOR}`, "2025-07-20", "41.34", "62.2", "5"]);
    const visibility = await table("visibility_daily");
    // Pekanbaru reported five times that morning: 4, 4, 5, 6 and 7 km, the first three in haze.
    expect(visibility.find((row) => row[0] === "airport:WIBB" && row[1] === "2025-07-20")).toEqual(["airport:WIBB", "2025-07-20", "5", "5", "4000", "5000", "3"]);
  });

  it("gives the inputs for the same days: the fires, and the wind at each instrument", async () => {
    expect((await table("fires_daily"))[0]).toEqual(["day", "lat", "lon", "frp_mw"]);
    expect(counts.fires_daily).toBeGreaterThan(0);
    const wind = await table("wind_daily");
    // The recorded cycle stores a steady 3 m/s wind to the east and north from 6 October 2026.
    expect(wind.find((row) => row[0] === "nea:east" && row[1] === "2026-10-07")).toEqual(["nea:east", "2026-10-07", "3", "3", "0", "24"]);
  });
});
