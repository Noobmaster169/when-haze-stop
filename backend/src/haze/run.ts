import { apiToPm25 } from "./api-index";
import { calibrate, type Pair, toPm25 } from "./calibrate";
import { ensembleMean } from "./ensemble";
import { type Anchor, encode, forecastPm25, modelled, observedFrame, spreadErrors, stationWeight } from "./field";
import { emissionsFor, type FireCellDay } from "./fires";
import { addHours, cellsWithin, hoursBetween } from "./grid";
import { learnedCorrector, type LearnedInstrument } from "./learned-frames";
import { REACH_KM, smokeFrom } from "./smoke";
import { carried, forecastStation, windowSlope } from "./station-forecast";
import type { Weather } from "./transport";

/**
 * One run of the model, from what was known at `asOf` to a map and a forecast
 * for every station. Pure: everything it reads is handed in, so a backfilled
 * hour, a backtest and the live one go through exactly the same code.
 */

export interface RunStation {
  id: string;
  lat: number;
  lon: number;
  /** Reading per hour from the start of the weather, NaN where there is none. */
  readings: Float32Array;
}

export interface RunInput {
  asOf: Date;
  /** The instant of hour 0 of `weather`. */
  start: Date;
  weather: Weather;
  fires: FireCellDay[];
  stations: RunStation[];
  /** Every instrument with a learned forecast. Without them the map's future is the hourly forecast alone. */
  instruments?: LearnedInstrument[];
  /** The learned model the instruments' rows came from. */
  learnedVersion?: string;
}

export interface RunFrame {
  validAt: Date;
  observed: boolean;
  field: Uint8Array;
}

export interface RunOutput {
  calibration: ReturnType<typeof calibrate>;
  frames: RunFrame[];
  /** Hourly from `asOf` + 1 hour. Absent for a station outside the region or with no recent reading. */
  forecasts: { stationId: string; api: Float32Array; physics: Float32Array }[];
  /** The learned model the future frames were corrected to, null where none was given. */
  learnedVersion: string | null;
}

/** Names the method, so runs made by different methods are never scored or drawn together. */
export const MODEL_VERSION = "v2";
export const HORIZON_HOURS = 84;
const FRAME_EVERY = 3;
const FRAMES_BACK_HOURS = 24;
/** Smoke released before the run started is missing, so the first three days are not compared with anything. */
const SPIN_UP_HOURS = 72;
const FIT_WINDOW_HOURS = 120;
/** A station that has said nothing for this long has no reading to carry forward. */
const STALE_HOURS = 6;

/** The hour of the newest reading at or before `hour`, no older than STALE_HOURS. */
function anchorHour(readings: Float32Array, hour: number): number | null {
  for (let back = 0; back <= STALE_HOURS && hour - back >= 0; back++) {
    if (!Number.isNaN(readings[hour - back])) return hour - back;
  }
  return null;
}

export function runModel(input: RunInput): RunOutput {
  const { weather, start } = input;
  const now = hoursBetween(start, input.asOf);
  const end = Math.min(weather.hours - 1, now + HORIZON_HOURS);
  const smoke = smokeFrom(ensembleMean(emissionsFor(input.fires, start, input.asOf, weather.hours), weather), weather.hours);

  const placed = input.stations.map((station) => ({ station, cells: cellsWithin(station.lat, station.lon, REACH_KM) })).filter((item) => item.cells.length > 0);

  const pairs: Pair[] = [];
  for (const { station, cells } of placed) {
    for (let hour = Math.max(SPIN_UP_HOURS, now - FIT_WINDOW_HOURS); hour <= now; hour++) {
      const api = station.readings[hour];
      if (!Number.isNaN(api)) pairs.push({ smoke: smoke.near(cells, hour), pm25: apiToPm25(api) });
    }
  }
  const calibration = calibrate(pairs);
  const modelAt = (cells: number[], hour: number): number => toPm25(calibration, smoke.near(cells, hour));

  // One anchor per station, used alike by its forecast and by the map, so the two cannot disagree.
  const anchored = placed.flatMap(({ station, cells }) => {
    const hour = anchorHour(station.readings, now);
    return hour === null ? [] : [{ station, cells, hour }];
  });

  const forecasts: RunOutput["forecasts"] = anchored.map(({ station, cells, hour }) => ({
    stationId: station.id,
    api: forecastStation({ readings: station.readings, anchorHour: hour, now, end }),
    physics: Float32Array.from({ length: end - now }, (_, ahead) => modelAt(cells, now + 1 + ahead)),
  }));

  const errorsAt = (hour: number): Anchor[] =>
    placed.flatMap(({ station, cells }) => {
      const reading = station.readings[hour];
      return Number.isNaN(reading) ? [] : [{ lat: station.lat, lon: station.lon, error: apiToPm25(reading) - modelAt(cells, hour) }];
    });
  const errorsNow = spreadErrors(anchored.map(({ station, cells, hour }) => ({ lat: station.lat, lon: station.lon, error: apiToPm25(station.readings[hour]) - modelAt(cells, hour) })));
  const slopes = spreadErrors(anchored.map(({ station, hour }) => ({ lat: station.lat, lon: station.lon, error: windowSlope(station.readings, hour) })));
  const modelNow = modelled(calibration, smoke.everywhere(now));
  const weight = stationWeight(anchored.map(({ station }) => station));
  const instruments = (input.instruments ?? []).map((instrument) => ({ instrument, cells: cellsWithin(instrument.lat, instrument.lon, REACH_KM) })).filter((item) => item.cells.length > 0);
  const cellsAt = new Map(instruments.map(({ instrument, cells }) => [`${instrument.lat},${instrument.lon}`, cells]));
  const correct = learnedCorrector({
    start,
    asOf: input.asOf,
    end,
    instruments: instruments.map(({ instrument }) => instrument),
    physicsAt: (lat, lon, hour) => modelAt(cellsAt.get(`${lat},${lon}`) ?? [], hour),
  });

  const frames: RunFrame[] = [];
  // Frames sit on fixed three-hour marks so every run's frames line up into one history, plus one at `asOf` itself.
  const startMs = start.getTime();
  const onMark = (hour: number): boolean => ((startMs / 3_600_000 + hour) % FRAME_EVERY + FRAME_EVERY) % FRAME_EVERY === 0;
  for (let hour = Math.max(0, now - FRAMES_BACK_HOURS); hour <= end; hour++) {
    if (hour !== now && !onMark(hour)) continue;
    let field: Uint8Array;
    if (hour === now) field = observedFrame(modelNow, errorsNow);
    else if (hour < now) field = observedFrame(modelled(calibration, smoke.everywhere(hour)), spreadErrors(errorsAt(hour)));
    else {
      const built = carried(hour - now);
      const trend = slopes.map((slope) => slope * built);
      const hourly = forecastPm25({ model: modelled(calibration, smoke.everywhere(hour)), modelAtAsOf: modelNow, errorsAtAsOf: errorsNow, trend, weight });
      field = encode(instruments.length > 0 ? correct(hour, hourly) : hourly);
    }
    frames.push({ validAt: addHours(start, hour), observed: hour <= now, field });
  }
  return { calibration, frames, forecasts, learnedVersion: instruments.length > 0 ? (input.learnedVersion ?? null) : null };
}
