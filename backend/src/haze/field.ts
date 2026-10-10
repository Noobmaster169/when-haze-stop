import { type Calibration, toApi } from "./calibrate";
import { cellCentre, distanceKm, FIELD_CELLS } from "./grid";

/**
 * The map: API over the whole grid at one hour.
 *
 * Away from any station it is the model alone. Near stations it is pulled to
 * what they read, by spreading each station's error (reading minus model) over
 * the cells around it. A forecast frame carries the errors from `asOf`
 * forward and damps the modelled change, the same way a station forecast does.
 */

/** A station as the field needs it: where it is, and how wrong the model is there. */
export interface Anchor {
  lat: number;
  lon: number;
  /** Reading minus modelled API. */
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

export function modelled(calibration: Calibration, smoke: Float32Array): Float32Array {
  const api = new Float32Array(smoke.length);
  for (let cell = 0; cell < smoke.length; cell++) api[cell] = toApi(calibration, smoke[cell]);
  return api;
}

/** One byte a cell holding API / 2, which reaches 510 and loses nothing a map can show. */
export function encode(api: Float32Array): Uint8Array {
  const bytes = new Uint8Array(api.length);
  for (let cell = 0; cell < api.length; cell++) bytes[cell] = Math.max(0, Math.min(255, Math.round(api[cell] / 2)));
  return bytes;
}

/** A frame at or before `asOf`: the model plus the errors measured at that same hour. */
export function observedFrame(model: Float32Array, errors: Float32Array): Uint8Array {
  const api = new Float32Array(model.length);
  for (let cell = 0; cell < model.length; cell++) api[cell] = model[cell] + errors[cell];
  return encode(api);
}

/**
 * A frame after `asOf`. Near stations the modelled change is scaled by `gain`,
 * because the model's changes have been about that much too large; far from
 * them the model is left as it is.
 */
export function forecastFrame(model: Float32Array, modelAtAsOf: Float32Array, errorsAtAsOf: Float32Array, weight: Float32Array, gain: number): Uint8Array {
  const api = new Float32Array(model.length);
  for (let cell = 0; cell < model.length; cell++) {
    api[cell] = model[cell] + errorsAtAsOf[cell] - weight[cell] * (1 - gain) * (model[cell] - modelAtAsOf[cell]);
  }
  return encode(api);
}
