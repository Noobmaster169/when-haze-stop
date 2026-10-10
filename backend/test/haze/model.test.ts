import { describe, expect, it } from "vitest";

import { FIRST_FIT } from "../../src/haze/calibrate";
import { chanceAbove, firstHindcast } from "../../src/haze/chance";
import { emissionsFor } from "../../src/haze/fires";
import { addHours, FIELD, FIELD_CELLS, hoursBetween } from "../../src/haze/grid";
import { runModel, type RunStation } from "../../src/haze/run";
import { spearman } from "../../src/haze/stats";
import { CENTRAL, simulate } from "../../src/haze/transport";
import { FIRE_CELLS, FIRST_HOUR, LAST_HOUR, READINGS, STATIONS } from "../fixtures/recorded";
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
});

describe("a model run", () => {
  const hours = hoursBetween(START, LAST_HOUR) + 85;
  const stations: RunStation[] = STATIONS.map((station) => {
    const readings = new Float32Array(hours).fill(NaN);
    for (const reading of READINGS.filter((item) => item.stationId === station.id)) readings[hoursBetween(START, reading.observedAt)] = reading.api;
    return { id: station.id, lat: station.lat, lon: station.lon, readings };
  });
  // A south-westerly, which is what carries Sumatran smoke to the peninsula.
  const output = runModel({ asOf: LAST_HOUR, start: START, weather: steadyWind(START, hours, 3, 3), fires: FIRE_CELLS, stations });

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
