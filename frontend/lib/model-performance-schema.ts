import { z } from "zod";

/**
 * The shape of lib/data/model-performance.json, the learned model's published
 * scores. The file is written by the model's report step, not by hand, so it
 * is parsed here: a renamed field fails the build and the test naming it,
 * instead of reaching a chart as undefined.
 */

const Trio = z.object({ model: z.number(), v2: z.number(), noChange: z.number() });
const Pair = z.object({ model: z.number(), v2: z.number() });

const Crossing = z.object({ events: z.number().int(), hit: Trio, falseAlarm: Trio });

const SeriesRow = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  real: z.number(),
  model: z.number(),
  low: z.number(),
  high: z.number(),
  noChange: z.number(),
  v2: z.number().nullable(),
});

export const ModelPerformanceSchema = z.object({
  version: z.string(),
  parquet: z.string(),
  testSpan: z.string(),
  stationDays: z.number().int(),
  nextDay: z.object({
    within10: Trio,
    within20: Trio,
    corr: Trio,
    changeCorr: Trio,
    bigMoves: z.object({ cases: z.number().int(), realSize: z.number(), directionRight: Pair, sizePredicted: Pair }),
    cross150: Crossing,
  }),
  twoDays: z.object({ within20: Trio, cross150: Crossing }),
  doeOnly: z.object({ within20: z.number(), hit150: z.number(), falseAlarm150: z.number(), changeCorr: z.number() }),
  neaOnly: z.object({ within20: z.number(), hit150: z.number(), falseAlarm150: z.number() }),
  bandCoverageHazy: z.number(),
  backtest: z.object({
    months: z.number().int(),
    hazyMaeDay1: Trio,
    hazyMaeDay2: Trio,
    monthsWon: z.string(),
    ablation: z.array(z.tuple([z.string(), z.number()])).min(1),
    leaks: z.object({ shift: z.boolean(), shuffle: z.boolean() }),
  }),
  example: z.object({
    station: z.string(),
    issued: z.string(),
    inputs: z.object({
      level: z.number(),
      lag24: z.number(),
      near50: z.number(),
      fireTotal3d: z.number(),
      heaviestBearing: z.number(),
      fireS3R2: z.number(),
      fireS3R1: z.number(),
      alongFire24: z.number(),
      rain48: z.number(),
      smokeNow: z.number(),
      smoke48h: z.number(),
    }),
    outputs: z.array(z.object({ day: z.string(), low: z.number(), p50: z.number(), high: z.number(), real: z.number().nullable() })).min(2),
  }),
  series: z.array(z.object({ id: z.string(), name: z.string(), rows: z.array(SeriesRow).min(2) })).min(1),
  scatter: z.array(z.object({ real: z.number(), model: z.number() })).min(1),
});

export type ModelPerformance = z.infer<typeof ModelPerformanceSchema>;
export type StationSeries = ModelPerformance["series"][number];
export type SeriesPoint = StationSeries["rows"][number];
