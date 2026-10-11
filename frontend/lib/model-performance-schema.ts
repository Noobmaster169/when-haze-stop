import { z } from "zod";

/**
 * The shape of lib/data/model-performance.json, the learned model's published
 * scores. The file is written by the model's report step, not by hand, so it
 * is parsed here: a renamed field fails the build and the test naming it,
 * instead of reaching a chart as undefined. Strict objects, so a stale file
 * of the earlier shape fails loudly rather than parsing to half a page.
 */

const Share = z.number().min(0).max(1);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A share that has no meaning on an instrument with no events of that kind (no crossing, no big move) is null. */
const Score = z.strictObject({
  days: z.number().int().positive(),
  mae: z.number(),
  maeNoChange: z.number(),
  within20: Share,
  events150: z.number().int(),
  hit150: Share.nullable(),
  falseAlarm150: Share.nullable(),
  hitNoChange: Share.nullable(),
  bigMoves: z.number().int(),
  directionRight: Share.nullable(),
  maxReal: z.number(),
});

const OverallScore = Score.extend({ hit150: Share, falseAlarm150: Share, hitNoChange: Share, directionRight: Share });

export const KINDS = ["doe", "nea", "openaq"] as const;
const Kind = z.enum(KINDS);

const Tally = z.strictObject({ caught: z.number().int(), missed: z.number().int(), falseAlarm: z.number().int(), quietRight: z.number().int() });

const Row = z.strictObject({ day: Day, real: z.number(), model: z.number(), low: z.number(), high: z.number(), noChange: z.number() });

export const ModelPerformanceSchema = z.strictObject({
  version: z.string(),
  testSpan: z.string(),
  stationDays: z.number().int().positive(),
  instruments: z.number().int().positive(),
  overall: z.strictObject({ doe: OverallScore, nea: OverallScore, openaq: OverallScore, all: OverallScore }),
  twoDay: z.strictObject({ days: z.number().int(), within20: Share, within20NoChange: Share, mae: z.number(), maeNoChange: z.number() }),
  cross150: z.strictObject({ model: Tally, noChange: Tally, v2: Tally }),
  errorHistogram: z.array(z.strictObject({ low: z.number(), model: z.number().int(), noChange: z.number().int() })).min(2),
  bandCoverage: z.strictObject({ doe: Share, nea: Share, openaq: Share }),
  scatter: z.array(z.strictObject({ real: z.number(), model: z.number(), kind: Kind })).min(1),
  stations: z
    .array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        kind: Kind,
        state: z.string().nullable(),
        score: Score,
        rows: z.array(Row).min(1),
      }),
    )
    .min(1),
});

export type ModelPerformance = z.infer<typeof ModelPerformanceSchema>;
export type Kind = z.infer<typeof Kind>;
export type Station = ModelPerformance["stations"][number];
export type StationScore = Station["score"];
export type StationRow = Station["rows"][number];
export type HistogramBin = ModelPerformance["errorHistogram"][number];
export type CrossTally = z.infer<typeof Tally>;
