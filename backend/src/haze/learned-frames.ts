import { blendWithSeries } from "./blend";
import { correctToPoints, type Target } from "./field-points";
import { addHours } from "./grid";
import { localDay, type ModelDay } from "./outlook";
import { PROVEN_HOURS, reshapeToLearned } from "./reshape";

/**
 * The map's future on the same series as the panel's.
 *
 * At every instrument with a learned row the run builds the one smoothed
 * series the station panel draws: the hourly forecast's first twelve hours,
 * then the blended days at the simulation's timing, joined by straight runs.
 * Every frame past the proven hours is pulled to those values at every
 * instrument, so a station dot, the panel line and the field under it tell
 * one story to the frame's resolution.
 */

export interface LearnedInstrument {
  id: string;
  lat: number;
  lon: number;
  /** Malaysian day to the learned band for it. */
  days: ReadonlyMap<string, ModelDay>;
}

export interface LearnedRun {
  asOf: Date;
  /** Hours the run forecasts after `asOf`. */
  horizon: number;
  instruments: LearnedInstrument[];
  /** The hourly forecast at an instrument in ug/m3, `ahead` hours after asOf (1 to horizon): a station's own line, elsewhere the uncorrected frame sampled there. */
  hourlyAt: (instrument: LearnedInstrument, ahead: number) => number;
  /** Calibrated smoke PM2.5 at an instrument, the same hours. */
  physicsAt: (instrument: LearnedInstrument, ahead: number) => number;
}

/** The series an instrument's frames were pulled to, ug/m3 per hour from asOf + 1. */
export interface InstrumentSeries {
  instrumentId: string;
  series: Float32Array;
}

/** The panel's series for one instrument: its hourly line blended into the learned days and smoothed onto them. */
export function smoothedSeries(input: LearnedRun, instrument: LearnedInstrument): Float32Array {
  const hourly = Array.from({ length: input.horizon }, (_, index) => input.hourlyAt(instrument, index + 1));
  const physics = Array.from({ length: input.horizon }, (_, index) => input.physicsAt(instrument, index + 1));
  const days = blendWithSeries(input.asOf, hourly, instrument.days);
  return Float32Array.from(reshapeToLearned({ asOf: input.asOf, hourly, physics, learned: days }));
}

export interface LearnedCorrection {
  targets: InstrumentSeries[];
  /** The frame `ahead` hours after asOf pulled to every instrument's series; frames within the proven hours are returned as they are. */
  correct: (ahead: number, pm25: Float32Array) => Float32Array;
}

export function learnedCorrection(input: LearnedRun): LearnedCorrection {
  const built = input.instruments.map((instrument) => ({
    instrument,
    series: smoothedSeries(input, instrument),
    // Past the last learned day the series is the hourly forecast again, which the frame already is.
    lastDay: [...instrument.days.keys()].sort().at(-1) ?? "",
  }));
  return {
    targets: built.map(({ instrument, series }) => ({ instrumentId: instrument.id, series })),
    correct(ahead, pm25) {
      if (ahead <= PROVEN_HOURS) return pm25;
      const day = localDay(addHours(input.asOf, ahead));
      const points: Target[] = built.filter((item) => day <= item.lastDay).map((item) => ({ lat: item.instrument.lat, lon: item.instrument.lon, pm25: item.series[ahead - 1] }));
      return correctToPoints(pm25, points);
    },
  };
}
