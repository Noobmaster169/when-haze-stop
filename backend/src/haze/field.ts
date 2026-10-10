import { pm25ToApi } from "./api-index";
import { type Calibration, toPm25 } from "./calibrate";
import { cellCentre, distanceKm, FIELD_CELLS } from "./grid";

/**
 * The map: API over the whole grid at one hour, worked out in PM2.5.
 *
 * Away from any station it is the model alone. Near stations it is pulled to
 * what they read, by spreading each station's error (reading minus model, in
 * ug/m3) over the cells around it. A forecast frame starts from the frame at
 * `asOf` and adds the same two things a station forecast adds: the stations'
 * recent slope carried on, and the modelled change. So the map agrees with the
 * dots on it, and the first forecast frame follows on from the last observed
 * one instead of jumping. Near stations the forecast is theirs: the slope, not
 * the model's change, which did not beat "no change" there. Far from every
 * station the model is all there is, and its change is taken whole.
 */

/** A station as the field needs it: where it is, and a value to spread around it. */
export interface Anchor {
  lat: number;
  lon: number;
  /** For errors, reading minus model in ug/m3; for slopes, ug/m3 an hour. */
  error: number;
}

/** A station's pull falls off with the square of distance; this many km keeps it finite on top of one. */
const NEAR_KM = 15;
/** Past this distance from every station the readings say nothing and the model stands alone. */
const FADE_KM = 200;

/** Reading minus model, spread over the grid and faded to nothing far from every station. */
export function spreadErrors(anchors: Anchor[]): Float32Array {
  const spread = new Float32Array(FIELD_CELLS);
  if (anchors.length === 0) return spread;
  for (let cell = 0; cell < FIELD_CELLS; cell++) {
    const centre = cellCentre(cell);
    let weighted = 0;
    let weight = 0;
    let nearest = Infinity;
    for (const anchor of anchors) {
      const km = distanceKm(centre.lat, centre.lon, anchor.lat, anchor.lon);
      if (km < nearest) nearest = km;
      const pull = 1 / (km * km + NEAR_KM * NEAR_KM);
      weighted += pull * anchor.error;
      weight += pull;
    }
    spread[cell] = Math.exp(-((nearest / FADE_KM) ** 2)) * (weighted / weight);
  }
  return spread;
}

/** How much of each cell's value comes from the stations rather than the model, 0 to 1. */
export function stationWeight(anchors: { lat: number; lon: number }[]): Float32Array {
  const weight = new Float32Array(FIELD_CELLS);
  for (let cell = 0; cell < FIELD_CELLS; cell++) {
    const centre = cellCentre(cell);
    let nearest = Infinity;
    for (const anchor of anchors) nearest = Math.min(nearest, distanceKm(centre.lat, centre.lon, anchor.lat, anchor.lon));
    weight[cell] = Math.exp(-((nearest / FADE_KM) ** 2));
  }
  return weight;
}

/** Modelled PM2.5 in every cell. */
export function modelled(calibration: Calibration, smoke: Float32Array): Float32Array {
  const pm25 = new Float32Array(smoke.length);
  for (let cell = 0; cell < smoke.length; cell++) pm25[cell] = toPm25(calibration, smoke[cell]);
  return pm25;
}

/** One byte a cell holding API / 2, which reaches 510 and loses nothing a map can show. */
export function encode(pm25: Float32Array): Uint8Array {
  const bytes = new Uint8Array(pm25.length);
  for (let cell = 0; cell < pm25.length; cell++) bytes[cell] = Math.max(0, Math.min(255, Math.round(pm25ToApi(Math.max(0, pm25[cell])) / 2)));
  return bytes;
}

/** A frame at or before `asOf`: the model plus the errors measured at that same hour. */
export function observedFrame(model: Float32Array, errors: Float32Array): Uint8Array {
  const pm25 = new Float32Array(model.length);
  for (let cell = 0; cell < model.length; cell++) pm25[cell] = model[cell] + errors[cell];
  return encode(pm25);
}

export interface ForecastFrameInput {
  /** Modelled PM2.5 at the frame's hour and at `asOf`. */
  model: Float32Array;
  modelAtAsOf: Float32Array;
  errorsAtAsOf: Float32Array;
  /** The stations' slopes spread over the grid, already multiplied by how much has built up by this hour. */
  trend: Float32Array;
  weight: Float32Array;
}

/** A frame after `asOf`: the stations' forecast near them, fading to the model's own change far from them. */
export function forecastFrame(input: ForecastFrameInput): Uint8Array {
  const { model, modelAtAsOf, errorsAtAsOf, trend, weight } = input;
  const pm25 = new Float32Array(model.length);
  for (let cell = 0; cell < model.length; cell++) {
    pm25[cell] = modelAtAsOf[cell] + errorsAtAsOf[cell] + trend[cell] + (1 - weight[cell]) * (model[cell] - modelAtAsOf[cell]);
  }
  return encode(pm25);
}
