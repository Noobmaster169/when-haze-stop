import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { apiToPm25, pm25ToApi } from "../../src/haze/api-index";
import { blendWithSeries } from "../../src/haze/blend";
import { FIRST_FIT } from "../../src/haze/calibrate";
import { sampleAt } from "../../src/haze/field";
import { chanceAbove, firstHindcast } from "../../src/haze/chance";
import { emissionsFor, type FireCellDay } from "../../src/haze/fires";
import { addHours, DOMAIN, FIELD, FIELD_CELLS, hoursBetween } from "../../src/haze/grid";
import type { LearnedInstrument } from "../../src/haze/learned-frames";
import { localDay, type ModelDay } from "../../src/haze/outlook";
import { PROVEN_HOURS, reshapeToLearned } from "../../src/haze/reshape";
import { runModel, type RunInput, type RunStation } from "../../src/haze/run";
import { spearman } from "../../src/haze/stats";
import { CENTRAL, simulate } from "../../src/haze/transport";
import { parseMetars } from "../../src/sources/metar";
import { NEA_STATIONS } from "../../src/sources/nea";
import { FIRE_CELLS, FIRST_HOUR, LAST_HOUR, READINGS, STATIONS } from "../fixtures/recorded";
import { METAR_JSON } from "../fixtures/recorded-context";
import { ISSUE_VERSION, RECORDED_ISSUE } from "../fixtures/recorded-model-issue";
import { steadyWind } from "../fixtures/steady-wind";

const START = new Date("2026-10-06T00:00:00Z");

function massAt(mass: Float32Array, hour: number, east: boolean): number {
  // The fires in the sample sit near 105E, so column 36 splits the grid around them.
  let sum = 0;
  for (let cell = 0; cell < FIELD_CELLS; cell++) {
    const column = cell % FIELD.nx;
    if (east ? column > 40 : column < 28) sum += mass[hour * FIELD_CELLS + cell];
  }
  return sum;
}

describe("the transport model", () => {
  const emissions = emissionsFor(FIRE_CELLS, START, LAST_HOUR, 120);

  it("carries smoke downwind and not upwind", () => {
    const mass = simulate(emissions, steadyWind(START, 120, 5, 0), CENTRAL, 1);
    expect(massAt(mass, 100, true)).toBeGreaterThan(0);
    expect(massAt(mass, 100, true)).toBeGreaterThan(massAt(mass, 100, false) * 20);
  });

  it("loses smoke to rain", () => {
    const dry = simulate(emissions, steadyWind(START, 120, 2, 0), CENTRAL, 1);
    const wet = simulate(emissions, steadyWind(START, 120, 2, 0, 3), CENTRAL, 1);
    const total = (mass: Float32Array): number => mass.reduce((sum, value) => sum + value, 0);
    expect(total(wet)).toBeLessThan(total(dry) * 0.5);
  });

  it("gives the same answer for the same seed", () => {
    const weather = steadyWind(START, 60, 3, 1);
    expect(simulate(emissions, weather, CENTRAL, 7)).toEqual(simulate(emissions, weather, CENTRAL, 7));
  });

  it("burns tomorrow's fires at the mean of the last three known days", () => {
    const known = emissions.filter((fire) => fire.startHour < hoursBetween(START, new Date("2026-10-10T00:00:00Z")));
    const carried = emissions.filter((fire) => fire.startHour >= hoursBetween(START, new Date("2026-10-10T00:00:00Z")));
    expect(known).toHaveLength(FIRE_CELLS.length);
    // The cell at 3.6S 105.7E burned 2083.5, 3132.2 and 2694.3 MW on the three days.
    const cell = carried.find((fire) => fire.lat === -3.6 && fire.lon === 105.7);
    expect(cell?.frpMw).toBeCloseTo((2083.5 + 3132.2 + 2694.3) / 3, 1);
  });

  it("burns no fire from the day of the issue time or after, neither as seen nor carried forward", () => {
    // Test vectors, not recorded fires: a cell at 5.0N 100.0E, far from every recorded one, on the
    // UTC day of the issue time (not complete yet) and on the day after.
    const leaks: FireCellDay[] = [
      { day: "2026-10-10", lat10: 50, lon10: 1000, frpMw: 5000 },
      { day: "2026-10-11", lat10: 50, lon10: 1000, frpMw: 5000 },
    ];
    const withLeaks = emissionsFor([...FIRE_CELLS, ...leaks], START, LAST_HOUR, 120);
    expect(withLeaks.filter((fire) => fire.lat === 5 && fire.lon === 100)).toEqual([]);
    expect(withLeaks).toEqual(emissions);
  });
});

const HOURS = hoursBetween(START, LAST_HOUR) + 85;
const RUN_STATIONS: RunStation[] = STATIONS.map((station) => {
  const readings = new Float32Array(HOURS).fill(NaN);
  for (const reading of READINGS.filter((item) => item.stationId === station.id)) readings[hoursBetween(START, reading.observedAt)] = reading.api;
  return { id: station.id, lat: station.lat, lon: station.lon, readings };
});
// A south-westerly, which is what carries Sumatran smoke to the peninsula.
const RUN_INPUT: RunInput = { asOf: LAST_HOUR, start: START, weather: steadyWind(START, HOURS, 3, 3), fires: FIRE_CELLS, stations: RUN_STATIONS };

describe("a model run", () => {
  const output = runModel(RUN_INPUT);

  it("forecasts every station that has a recent reading, starting from that reading", () => {
    expect(output.forecasts.map((forecast) => forecast.stationId).sort()).toEqual(STATIONS.map((station) => station.id).sort());
    const petalingJaya = output.forecasts.find((forecast) => forecast.stationId === "CA19B");
    expect(petalingJaya?.api).toHaveLength(84);
    // The last reading was 161, and one hour cannot move a day-averaged index far.
    expect(Math.abs((petalingJaya?.api[0] ?? 0) - 161)).toBeLessThan(10);
  });

  it("writes one frame at the hour it ran and marks the past as observed", () => {
    const now = output.frames.filter((frame) => frame.validAt.getTime() === LAST_HOUR.getTime());
    expect(now).toHaveLength(1);
    expect(output.frames.every((frame) => frame.observed === frame.validAt <= LAST_HOUR)).toBe(true);
    expect(output.frames.at(-1)?.validAt.getTime()).toBeLessThanOrEqual(addHours(LAST_HOUR, 84).getTime());
    expect(output.frames[0].field).toHaveLength(FIELD_CELLS);
  });

  it("falls back to the first fit when it has too few readings to make its own", () => {
    expect(output.calibration).toMatchObject({ fallback: true, ...FIRST_FIT });
  });

  it("follows on from the observed map into the forecast without a jump", () => {
    const at = output.frames.findIndex((frame) => frame.validAt.getTime() === LAST_HOUR.getTime());
    const [now, next] = [output.frames[at].field, output.frames[at + 1].field];
    let moved = 0;
    for (let cell = 0; cell < now.length; cell++) moved += Math.abs(now[cell] - next[cell]) * 2;
    // One byte is two API points; the first forecast frame is at most three hours on.
    expect(moved / now.length).toBeLessThan(3);
  });

  it("gives every forecast station its calibrated smoke, hour by hour, on the same indices as the forecast", () => {
    const seremban = output.forecasts.find((forecast) => forecast.stationId === "CA24N");
    expect(seremban?.physics).toHaveLength(84);
    // Nothing less than the fit's intercept, which is the air with no modelled smoke; the series is Float32.
    expect(seremban?.physics.every((value) => value >= FIRST_FIT.intercept - 0.001)).toBe(true);
    expect(output.learnedVersion).toBeNull();
  });

  it("is what it was before the learned correction existed, byte for byte, when no instrument is given", () => {
    // Checksums of the frames and the station forecasts this input gave at commit 39078e9. A change to the
    // model is meant to move them; the learned correction must not, because nothing learned was handed in.
    const frames = createHash("sha256");
    for (const frame of output.frames) frames.update(frame.field);
    expect(frames.digest("hex")).toBe("871ea3d7b3cd337f53e39704f1d4d73ea3c481bddd1060451404f463d581ae96");
    const forecasts = createHash("sha256");
    for (const forecast of output.forecasts) forecasts.update(forecast.stationId).update(Buffer.from(forecast.api.buffer));
    expect(forecasts.digest("hex")).toBe("e052de2419f4b29a3a2b0f7cf81c1d6449b2431bf64d059bdff516dfb0013f12");
  });
});

describe("a run on the learned forecast", () => {
  // The recorded issue's instruments at their stored positions: two DOE stations, Singapore Central, KLIA and
  // the Tambulaung sensor in Sabah (openaq_sensors in db/seed).
  const klia = parseMetars(METAR_JSON).find((report) => report.icao === "WMKK");
  const central = NEA_STATIONS.find((station) => station.id === "SGCENTRAL");
  const positions = new Map<string, { lat: number; lon: number }>([
    ...STATIONS.map((station) => [station.id, { lat: station.lat, lon: station.lon }] as const),
    ["SGCENTRAL", { lat: central?.lat ?? NaN, lon: central?.lon ?? NaN }],
    ["WMKK", { lat: klia?.lat ?? NaN, lon: klia?.lon ?? NaN }],
    ["openaq:12488751", { lat: 6.226897, lon: 116.451696 }],
  ]);
  const instruments: LearnedInstrument[] = [...positions].flatMap(([id, at]) => {
    const days = new Map<string, ModelDay>(RECORDED_ISSUE.filter((row) => row.instrumentId === id).map((row) => [row.day, { p10: row.p10, p50: row.p50, p90: row.p90 }]));
    return days.size === 0 ? [] : [{ id, ...at, days }];
  });
  const plain = runModel(RUN_INPUT);
  const learned = runModel({ ...RUN_INPUT, instruments, learnedVersion: ISSUE_VERSION });
  const seremban = STATIONS.find((station) => station.id === "CA24N");
  if (!seremban) throw new Error("the recorded sample has no Seremban");
  const cellOf = (at: { lat: number; lon: number }): number => Math.floor((at.lat - DOMAIN.lat0) / FIELD.step) * FIELD.nx + Math.floor((at.lon - DOMAIN.lon0) / FIELD.step);
  const apiAt = (frame: Uint8Array, at: { lat: number; lon: number }): number => frame[cellOf(at)] * 2;

  const now = hoursBetween(START, LAST_HOUR);
  const aheadOf = (frame: { validAt: Date }): number => hoursBetween(START, frame.validAt) - now;
  const instrumentOf = (id: string): LearnedInstrument => {
    const found = instruments.find((instrument) => instrument.id === id);
    if (!found) throw new Error(`no instrument ${id}`);
    return found;
  };
  const targetOf = (id: string): Float32Array => {
    const found = learned.targets.find((target) => target.instrumentId === id);
    if (!found) throw new Error(`no target series for ${id}`);
    return found.series;
  };

  it("covers the five placed instruments and names the issue", () => {
    expect(instruments.map((instrument) => instrument.id).sort()).toEqual(["CA19B", "CA24N", "SGCENTRAL", "WMKK", "openaq:12488751"]);
    expect(learned.targets.map((target) => target.instrumentId).sort()).toEqual(instruments.map((instrument) => instrument.id).sort());
    expect(learned.learnedVersion).toBe(ISSUE_VERSION);
    expect(plain.targets).toEqual([]);
  });

  it("gives a station the very series the panel draws: its hourly line blended into the learned days and smoothed with its stored smoke", () => {
    for (const id of ["CA24N", "CA19B"]) {
      const forecast = learned.forecasts.find((item) => item.stationId === id);
      if (!forecast) throw new Error(`no forecast for ${id}`);
      const hourly = Array.from(forecast.api, apiToPm25);
      const days = blendWithSeries(LAST_HOUR, hourly, instrumentOf(id).days);
      const expected = reshapeToLearned({ asOf: LAST_HOUR, hourly, physics: Array.from(forecast.physics), learned: days });
      const series = targetOf(id);
      expect(series).toHaveLength(expected.length);
      expected.forEach((value, index) => expect(series[index]).toBeCloseTo(value, 3));
      expect(Array.from(series.slice(0, PROVEN_HOURS))).toEqual(Array.from(Float32Array.from(hourly.slice(0, PROVEN_HOURS))));
      expect(Array.from(series.slice(PROVEN_HOURS))).not.toEqual(Array.from(Float32Array.from(hourly.slice(PROVEN_HOURS))));
    }
  });

  it("pulls every frame past the proven hours to each instrument's own smoothed series, to the frame's resolution", () => {
    let checked = 0;
    for (const frame of learned.frames) {
      const ahead = aheadOf(frame);
      if (ahead <= PROVEN_HOURS) continue;
      const pm25 = Float32Array.from(frame.field, (byte) => apiToPm25(byte * 2));
      for (const instrument of instruments) {
        const lastDay = [...instrument.days.keys()].sort().at(-1) ?? "";
        if (localDay(frame.validAt) > lastDay) continue;
        const target = targetOf(instrument.id)[ahead - 1];
        expect(Math.abs(pm25ToApi(sampleAt(pm25, instrument.lat, instrument.lon)) - pm25ToApi(target))).toBeLessThanOrEqual(2);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(100);
  });

  it("pulls a place with no hourly forecast of its own, Singapore Central, from the smoke alone to its series", () => {
    const at = new Date("2026-10-11T06:00:00Z");
    const index = learned.frames.findIndex((item) => item.validAt.getTime() === at.getTime());
    const central = instrumentOf("SGCENTRAL");
    const target = targetOf("SGCENTRAL")[aheadOf({ validAt: at }) - 1];
    // No DOE station is near, so the hourly run leaves the field there to the smoke alone, far below the blend.
    expect(Math.abs(apiAt(plain.frames[index].field, central) - pm25ToApi(target))).toBeGreaterThan(20);
    expect(Math.abs(apiAt(learned.frames[index].field, central) - pm25ToApi(target))).toBeLessThanOrEqual(2);
  });

  it("leaves every frame up to twelve hours after the run exactly as the hourly run drew it", () => {
    for (const [at, frame] of learned.frames.entries()) {
      expect(frame.validAt).toEqual(plain.frames[at].validAt);
      if (aheadOf(frame) <= PROVEN_HOURS) expect(frame.field).toEqual(plain.frames[at].field);
    }
    expect(learned.frames.some((frame) => aheadOf(frame) > PROVEN_HOURS)).toBe(true);
    expect(learned.forecasts.map((forecast) => forecast.api)).toEqual(plain.forecasts.map((forecast) => forecast.api));
  });
});

describe("chance of passing a line", () => {
  // Petaling Jaya on 10 October: a forecast peak of 153 for the next day, from a station already above 100.
  const errors = firstHindcast(24, true);

  it("matches the replayed week's errors", () => {
    expect(chanceAbove(153, 150, errors)).toBeCloseTo(0.56, 2);
    expect(chanceAbove(153, 180, errors)).toBeCloseTo(0.01, 2);
  });

  it("falls as the line rises and never reaches certainty", () => {
    const chances = [100, 150, 180, 200, 400].map((line) => chanceAbove(153, line, errors));
    expect([...chances].sort((a, b) => b - a)).toEqual(chances);
    expect(chances[0]).toBeLessThan(1);
    expect(chances.at(-1)).toBeGreaterThan(0);
  });
});

describe("rank correlation", () => {
  it("is 1 where one series rises whenever the other does", () => {
    // Kuching's readings through the afternoon of 10 October, against their own order.
    const readings = READINGS.filter((reading) => reading.stationId === "CA65Q" && reading.observedAt >= addHours(FIRST_HOUR, 24)).map((reading) => reading.api);
    expect(spearman(readings, [...readings].map((value) => value * 2))).toBeCloseTo(1);
  });
});
