import type { Queryable } from "../db";
import { emissionsFor } from "../haze/fires";
import { addHours, cellsWithin, DOMAIN, hoursBetween, WEATHER, WEATHER_POINTS } from "../haze/grid";
import { REACH_KM } from "../haze/smoke";
import type { Emission, Weather } from "../haze/transport";
import { TerminalError } from "../lib/errors";
import { council, fires as fireCells, stations, weather } from "../repositories";
import type { RunCalibration } from "../repositories/council.repo";
import type { FiresClient } from "../sources";
import { ANALOGUE_DAYS, analogueStarts, extendWeather } from "../suppression/analogue";
import type { WindMember, WindSummary } from "../suppression/attribution";
import type { Complex } from "../suppression/complexes";
import { dayOneFor } from "../suppression/package";
import type { TargetArea } from "../suppression/targets";
import { complexesFrom } from "./fire-complexes";

/**
 * Everything one council run hands the engine, loaded once: the stored run's
 * calibration, the wind members (forecast, then a replayed past window), the
 * emissions the engine would burn, and the complexes they belong to. The seam
 * reads it twice, for the attribution and for the verdict's maps.
 */

/** Smoke lives up to six days, so the run starts far enough back to hold everything still in the air. */
const LOOKBACK_DAYS = 8;
export const HORIZON_DAYS = 14;
const WIND_MEMBERS = 4;

export interface Prepared {
  calibration: RunCalibration;
  asOf: Date;
  /** Hour 0 of the weather and emissions. */
  start: Date;
  /** The data's hour, counted from `start`. */
  now: number;
  /** Hours in each member's weather. */
  hours: number;
  /** Hours scored after `now`. */
  span: number;
  dayOne: string;
  members: { member: WindMember; weather: Weather }[];
  emissions: Emission[];
  /** Complex id to the emissions of its cells. */
  byComplex: Map<string, Emission[]>;
  complexes: Complex[];
  /** The field cells around each target station. */
  stationCells: number[][];
  /** Plan day of an emission: 0 before day 1. */
  planDay(emission: Emission): number;
}

export async function prepare(pool: Queryable, target: TargetArea, fires?: FiresClient): Promise<Prepared> {
  const calibration = await council.latestCalibration(pool);
  if (!calibration) throw new TerminalError("no model run is stored yet, so there is no calibration to turn smoke into ug/m3");
  const asOf = calibration.asOf;
  const start = addHours(asOf, -24 * LOOKBACK_DAYS);
  const now = hoursBetween(start, asOf);
  const span = HORIZON_DAYS * 24;
  const hours = now + span + 1;

  const forecast = await weather.load(pool, start, addHours(asOf, span));
  if (!forecast || forecast.hours <= now) throw new TerminalError("the stored weather does not reach the latest run's hour");
  const forecastEnd = addHours(start, forecast.hours - 1).toISOString().slice(0, 10);
  const members: Prepared["members"] = [];
  for (const from of analogueStarts(asOf, WIND_MEMBERS)) {
    const analogue = await weather.load(pool, from, addHours(from, ANALOGUE_DAYS * 24 - 1));
    if (!analogue || analogue.hours < ANALOGUE_DAYS * 24) continue;
    members.push({
      member: { id: `W${members.length + 1}`, label: `forecast to ${forecastEnd}, then the wind of ${from.toISOString().slice(0, 10)} onwards replayed` },
      weather: extendWeather(forecast, analogue, hours, WEATHER_POINTS),
    });
  }
  if (members.length === 0) throw new TerminalError("no stored analogue window of wind is complete");

  const cells = await fireCells.since(pool, addHours(start, -24).toISOString().slice(0, 10));
  const lastKnownDay = addHours(new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`), -24).toISOString().slice(0, 10);
  const { complexes } = await complexesFrom(pool, cells, lastKnownDay, fires);
  const placed = (await stations.list(pool)).filter((station) => target.stationIds.includes(station.id));
  if (placed.length === 0) throw new TerminalError(`none of ${target.name}'s stations is stored`);

  const dayOne = dayOneFor(asOf);
  const dayOneHour = hoursBetween(start, new Date(`${dayOne}T00:00:00Z`));
  const emissions = emissionsFor(cells, start, asOf, hours);
  return {
    calibration,
    asOf,
    start,
    now,
    hours,
    span,
    dayOne,
    members,
    emissions,
    byComplex: groupEmissions(emissions, complexes),
    complexes,
    stationCells: placed.map((station) => cellsWithin(station.lat, station.lon, REACH_KM)),
    planDay: (emission) => Math.max(0, Math.floor((emission.startHour - dayOneHour) / 24) + 1),
  };
}

function groupEmissions(emissions: Emission[], complexes: Complex[]): Map<string, Emission[]> {
  const owner = new Map<string, string>();
  for (const complex of complexes) for (const cell of complex.cells) owner.set(`${cell.lat10}|${cell.lon10}`, complex.id);
  const grouped = new Map<string, Emission[]>();
  for (const emission of emissions) {
    const id = owner.get(`${Math.round(emission.lat * 10)}|${Math.round(emission.lon * 10)}`);
    if (id) grouped.set(id, [...(grouped.get(id) ?? []), emission]);
  }
  return grouped;
}

/** Where MetMalaysia is asked about the wind: the source regions, the strait, and the target. */
const WIND_PLACES = [
  { name: "Riau", lat: 0, lon: 102 },
  { name: "Jambi", lat: -2, lon: 104 },
  { name: "South Sumatra", lat: -3, lon: 105 },
  { name: "West Kalimantan", lat: -2, lon: 110 },
  { name: "Central Kalimantan", lat: -3, lon: 113 },
  { name: "Strait of Malacca", lat: 2, lon: 101 },
  { name: "Kuala Lumpur", lat: 3, lon: 102 },
];

export function summariseWind(member: string, wind: Weather, from: number, to: number): WindSummary {
  const places = WIND_PLACES.map((place) => {
    const point = (place.lat - DOMAIN.lat0) * WEATHER.nx + (place.lon - DOMAIN.lon0);
    let u = 0;
    let v = 0;
    let rain = 0;
    for (let hour = from; hour < to; hour++) {
      u += wind.u[hour * WEATHER_POINTS + point];
      v += wind.v[hour * WEATHER_POINTS + point];
      rain += wind.rain[hour * WEATHER_POINTS + point];
    }
    const hours = Math.max(1, to - from);
    return { ...place, u: u / hours, v: v / hours, rainMm: rain };
  });
  return { member, places };
}
