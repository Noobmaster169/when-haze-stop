import { z } from "zod";

import { TerminalError } from "../lib/errors";
import { fetchText, postJson } from "./http";

/**
 * The model service of the compose stack (model/): the learned forecast of
 * each instrument's peak 24 hour PM2.5 for the next three Malaysian days.
 * It builds its own features from the database, so this client only names an
 * hour and parses the answer. No feature is computed on this side.
 */

export interface ModelForecast {
  instrumentId: string;
  /** A Malaysian calendar day, `YYYY-MM-DD`. */
  day: string;
  /** The 10th, 50th and 90th percentile of the day's peak 24 h PM2.5, ug/m3, sorted. */
  p10: number;
  p50: number;
  p90: number;
  modelVersion: string;
}

export interface ModelHealth {
  /** Null while no artifact is promoted. */
  modelVersion: string | null;
  trainedAt: Date | null;
}

export interface ModelClient {
  health(): Promise<ModelHealth>;
  predict(asOf: Date): Promise<ModelForecast[]>;
}

/** Features for 189 instruments are read from the database on each ask, which can take a while on a cold service. */
const TIMEOUT_MS = 120_000;

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Forecast = z.object({ instrumentId: z.string().min(1), day: Day, p10: z.number(), p50: z.number(), p90: z.number() });
const Prediction = z.object({ modelVersion: z.string().min(1), asOf: z.string(), forecasts: z.array(Forecast) });
const Health = z.object({ status: z.literal("ok"), modelVersion: z.string().nullable(), trainedAt: z.string().nullable() });

function parse<T extends z.ZodType>(schema: T, text: string, what: string): z.output<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new TerminalError(`${what} did not answer with JSON`, { cause: error });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new TerminalError(`${what} answered in a shape this client does not know`, { cause: parsed.error });
  return parsed.data;
}

/** Quantile models can cross. The band is sorted here so a low above a high never reaches the outlook. */
export function parsePrediction(text: string): ModelForecast[] {
  const { modelVersion, forecasts } = parse(Prediction, text, "model predict");
  return forecasts.map((row) => {
    const [p10, p50, p90] = [row.p10, row.p50, row.p90].sort((a, b) => a - b);
    return { instrumentId: row.instrumentId, day: row.day, p10, p50, p90, modelVersion };
  });
}

export function parseHealth(text: string): ModelHealth {
  const { modelVersion, trainedAt } = parse(Health, text, "model health");
  return { modelVersion, trainedAt: trainedAt ? new Date(trainedAt) : null };
}

export function modelClient(baseUrl: string): ModelClient {
  const base = baseUrl.replace(/\/$/, "");
  return {
    async health() {
      return parseHealth(await fetchText(`${base}/health`, "model health", TIMEOUT_MS));
    },
    async predict(asOf) {
      return parsePrediction(await postJson(`${base}/predict`, "model predict", TIMEOUT_MS, { asOf: asOf.toISOString() }));
    },
  };
}
