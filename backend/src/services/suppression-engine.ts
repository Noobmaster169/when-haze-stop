import type { Queryable } from "../db";
import { ensembleMean } from "../haze/ensemble";
import { emissionsFor } from "../haze/fires";
import { addHours, cellsWithin, DOMAIN, distanceKm, hoursBetween, WEATHER, WEATHER_POINTS } from "../haze/grid";
import { REACH_KM, smokeFrom } from "../haze/smoke";
import type { Emission, Weather } from "../haze/transport";
import { TerminalError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import { council, fires as fireCells, stations, weather } from "../repositories";
import type { FiresClient } from "../sources";
import { ANALOGUE_DAYS, analogueStarts, extendWeather } from "../suppression/analogue";
import { type Attribution, mean, type WindMember, type WindSummary } from "../suppression/attribution";
import type { Complex } from "../suppression/complexes";
import { dayOneFor } from "../suppression/package";
import type { TargetArea } from "../suppression/targets";
import { complexesFrom } from "./fire-complexes";

/**
 * The seam between the council and the smoke engine (docs/council/06-engine-seam.md).
 *
 * The council never runs the engine itself: it gets one `Attribution` per run
 * and scores every plan from it. This implementation composes the engine's
 * public pieces (`emissionsFor`, `ensembleMean`, `smokeFrom`) and the stored
 * run's calibration, and changes none of them, so the engine can be reworked
 * underneath it. The fake hands back a recorded attribution.
 */

export interface SuppressionEngine {
  attribute(request: { target: TargetArea }): Promise<Attribution>;
}

const log = childLogger({ module: "services.suppression-engine" });
/** Smoke lives up to six days, so the run starts far enough back to hold everything still in the air. */
const LOOKBACK_DAYS = 8;
export const HORIZON_DAYS = 14;
const WIND_MEMBERS = 4;
/** Ensemble members per wind member: a third of the hourly run's, as only a ranking and sums are read. */
const ENSEMBLE = 3;
/** Complexes given a day-by-day contribution: the most influential, plus the ones any rule or baseline names. */
const CANDIDATES = 40;
/** A complex too small and too far to matter is not worth a pass of the engine. */
const WORTH_MW = 50;
const WORTH_KM = 500;

export interface EngineDeps {
  pool: Queryable;
  /** The FIRMS files, for detection counts and the night share; optional. */
  fires?: FiresClient;
}

export function engineSuppression(deps: EngineDeps): SuppressionEngine {
  return {
    async attribute({ target }) {
      const run = await council.latestCalibration(deps.pool);
      if (!run) throw new TerminalError("no model run is stored yet, so there is no calibration to turn smoke into ug/m3");
      const asOf = run.asOf;
      const start = addHours(asOf, -24 * LOOKBACK_DAYS);
      const now = hoursBetween(start, asOf);
      const span = HORIZON_DAYS * 24;
      const hours = now + span + 1;

      const forecast = await weather.load(deps.pool, start, addHours(asOf, span));
      if (!forecast || forecast.hours <= now) throw new TerminalError("the stored weather does not reach the latest run's hour");
      const members: { member: WindMember; weather: Weather }[] = [];
      for (const from of analogueStarts(asOf, WIND_MEMBERS)) {
        const analogue = await weather.load(deps.pool, from, addHours(from, ANALOGUE_DAYS * 24 - 1));
        if (!analogue || analogue.hours < ANALOGUE_DAYS * 24) continue;
        const forecastEnd = addHours(start, forecast.hours - 1).toISOString().slice(0, 10);
        members.push({
          member: { id: `W${members.length + 1}`, label: `forecast to ${forecastEnd}, then the wind of ${from.toISOString().slice(0, 10)} onwards replayed` },
          weather: extendWeather(forecast, analogue, hours, WEATHER_POINTS),
        });
      }
      if (members.length === 0) throw new TerminalError("no stored analogue window of wind is complete");

      const cells = await fireCells.since(deps.pool, addHours(start, -24).toISOString().slice(0, 10));
      const lastKnownDay = addHours(new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`), -24).toISOString().slice(0, 10);
      const { complexes } = await complexesFrom(deps.pool, cells, lastKnownDay, deps.fires);
      const placed = (await stations.list(deps.pool)).filter((station) => target.stationIds.includes(station.id));
      if (placed.length === 0) throw new TerminalError(`none of ${target.name}'s stations is stored`);
      const stationCells = placed.map((station) => cellsWithin(station.lat, station.lon, REACH_KM));

      const dayOne = dayOneFor(asOf);
      const dayOneHour = hoursBetween(start, new Date(`${dayOne}T00:00:00Z`));
      const planDay = (emission: Emission) => Math.max(0, Math.floor((emission.startHour - dayOneHour) / 24) + 1);
      const emissions = emissionsFor(cells, start, asOf, hours);
      const byComplex = groupEmissions(emissions, complexes);

      /** The target's 24-hour PM2.5 from some emissions, ug/m3, for each hour after `asOf`. */
      const atTarget = (some: Emission[], wind: Weather): Float32Array => {
        const smoke = smokeFrom(ensembleMean(some, wind, ENSEMBLE), hours);
        const series = new Float32Array(span);
        for (let hour = 0; hour < span; hour++) {
          let sum = 0;
          for (const near of stationCells) sum += smoke.near(near, now + 1 + hour);
          series[hour] = (run.slope * sum) / stationCells.length;
        }
        return series;
      };

      const baseline = members.map(({ weather: wind }) => atTarget(emissions, wind).map((value) => value + run.intercept));
      const ceiling = members.map(({ weather: wind }) => atTarget(emissions.filter((emission) => planDay(emission) >= 1), wind));
      log.info({ asOf, complexes: complexes.length, members: members.length }, "baseline and ceiling made");

      const worth = complexes.filter((complex) => complex.firePowerMw >= WORTH_MW || distanceKm(target.centre.lat, target.centre.lon, complex.lat, complex.lon) <= WORTH_KM);
      const share = new Map<string, number>();
      for (const complex of worth) {
        const future = (byComplex.get(complex.id) ?? []).filter((emission) => planDay(emission) >= 1);
        const shares = members.map(({ weather: wind }, m) => mean(atTarget(future, wind)) / Math.max(1e-9, mean(ceiling[m])));
        share.set(complex.id, shares.reduce((sum, value) => sum + value, 0) / shares.length);
      }
      const chosen = candidates(complexes, share, target);
      log.info({ worth: worth.length, candidates: chosen.length }, "complexes ranked by influence");

      const contributions = new Map<string, Float32Array[][]>();
      for (const id of chosen) {
        const byDay = new Map<number, Emission[]>();
        for (const emission of byComplex.get(id) ?? []) {
          const day = planDay(emission);
          if (day >= 1 && day <= HORIZON_DAYS) byDay.set(day, [...(byDay.get(day) ?? []), emission]);
        }
        contributions.set(
          id,
          members.map(({ weather: wind }) => Array.from({ length: HORIZON_DAYS + 1 }, (_, day) => (byDay.has(day) ? atTarget(byDay.get(day)!, wind) : new Float32Array(span)))),
        );
      }
      log.info({ candidates: chosen.length }, "day-by-day contributions made");
      const winds = members.map(({ member, weather: wind }) => summariseWind(member.id, wind, now + 1, hours));
      return { asOf: asOf.toISOString(), dayOne, hours: span, days: HORIZON_DAYS, members: members.map((item) => item.member), baseline, ceiling, contributions, complexes, winds };
    },
  };
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

function summariseWind(member: string, wind: Weather, from: number, to: number): WindSummary {
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

/** The most influential complexes, every Malaysian one that reaches the target, and the biggest and nearest in Kalimantan, which the baselines use. */
function candidates(complexes: Complex[], share: Map<string, number>, target: TargetArea): string[] {
  const ranked = [...share].sort((a, b) => b[1] - a[1]);
  const chosen = new Set(ranked.slice(0, CANDIDATES).map(([id]) => id));
  for (const [id, value] of ranked) if (value > 0.001 && complexes.find((complex) => complex.id === id)?.place.country === "Malaysia") chosen.add(id);
  const kalimantan = complexes.filter((complex) => complex.place.area === "kalimantan");
  const biggest = [...kalimantan].sort((a, b) => b.firePowerMw - a.firePowerMw)[0];
  const km = (complex: Complex) => distanceKm(target.centre.lat, target.centre.lon, complex.lat, complex.lon);
  const nearest = [...kalimantan].sort((a, b) => km(a) - km(b))[0];
  if (biggest) chosen.add(biggest.id);
  if (nearest) chosen.add(nearest.id);
  return [...chosen];
}

