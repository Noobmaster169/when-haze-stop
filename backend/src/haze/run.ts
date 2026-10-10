import { type Calibration, calibrate, type Pair, toApi } from "./calibrate";
import { ensembleMean } from "./ensemble";
import { type Anchor, forecastFrame, modelled, observedFrame, spreadErrors, stationWeight } from "./field";
import { emissionsFor, type FireCellDay } from "./fires";
import { addHours, cellsWithin, hoursBetween } from "./grid";
import { REACH_KM, smokeFrom } from "./smoke";
import type { Weather } from "./transport";

/**
 * One run of the model, from what was known at `asOf` to a map and a forecast
 * for every station. Pure: everything it reads is handed in, so a backfilled
 * hour and the live one go through exactly the same code.
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
}

export interface RunFrame {
  validAt: Date;
  observed: boolean;
  field: Uint8Array;
}

export interface RunOutput {
  calibration: Calibration;
  frames: RunFrame[];
  /** Hourly from `asOf` + 1 hour. Absent for a station outside the region or with no recent reading. */
  forecasts: { stationId: string; api: Float32Array }[];
}

/** The modelled change is scaled by this before it moves a forecast: its changes have run about this much too large. */
export const GAIN = 0.4;
export const HORIZON_HOURS = 84;
const FRAME_EVERY = 3;
const FRAMES_BACK_HOURS = 24;
/** Smoke released before the run started is missing, so the first three days are not compared with anything. */
const SPIN_UP_HOURS = 72;
const FIT_WINDOW_HOURS = 120;
/** A station that has said nothing for this long has no reading to carry forward. */
const STALE_HOURS = 6;

function latestReading(readings: Float32Array, hour: number): number | null {
  for (let back = 0; back <= STALE_HOURS && hour - back >= 0; back++) {
    const value = readings[hour - back];
    if (!Number.isNaN(value)) return value;
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
      if (!Number.isNaN(api)) pairs.push({ smoke: smoke.near(cells, hour), api });
    }
  }
  const calibration = calibrate(pairs);
  const modelAt = (cells: number[], hour: number): number => toApi(calibration, smoke.near(cells, hour));

  const forecasts: RunOutput["forecasts"] = [];
  for (const { station, cells } of placed) {
    const anchor = latestReading(station.readings, now);
    if (anchor === null) continue;
    const base = modelAt(cells, now);
    const api = new Float32Array(end - now);
    for (let hour = now + 1; hour <= end; hour++) api[hour - now - 1] = Math.max(0, anchor + GAIN * (modelAt(cells, hour) - base));
    forecasts.push({ stationId: station.id, api });
  }

  const anchorsAt = (hour: number): Anchor[] =>
    placed.flatMap(({ station, cells }) => {
      const reading = station.readings[hour];
      return Number.isNaN(reading) ? [] : [{ lat: station.lat, lon: station.lon, error: reading - modelAt(cells, hour) }];
    });

  const modelNow = modelled(calibration, smoke.everywhere(now));
  const errorsNow = spreadErrors(anchorsAt(now));
  const weight = stationWeight(placed.map(({ station }) => station));

  const frames: RunFrame[] = [];
  // Frames sit on fixed three-hour marks so every run's frames line up into one history, plus one at `asOf` itself.
  const startMs = start.getTime();
  const onMark = (hour: number): boolean => ((startMs / 3_600_000 + hour) % FRAME_EVERY + FRAME_EVERY) % FRAME_EVERY === 0;
  for (let hour = Math.max(0, now - FRAMES_BACK_HOURS); hour <= end; hour++) {
    if (hour !== now && !onMark(hour)) continue;
    const model = hour === now ? modelNow : modelled(calibration, smoke.everywhere(hour));
    const field = hour <= now ? observedFrame(model, hour === now ? errorsNow : spreadErrors(anchorsAt(hour))) : forecastFrame(model, modelNow, errorsNow, weight, GAIN);
    frames.push({ validAt: addHours(start, hour), observed: hour <= now, field });
  }
  return { calibration, frames, forecasts };
}
