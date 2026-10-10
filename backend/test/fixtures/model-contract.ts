import type { ModelForecast } from "../../src/sources/model";

/**
 * The model service's answer as its contract defines it, not a recorded one:
 * the service (model/) did not exist when this seam was written, so nothing
 * could be recorded. The ids are the recorded week's stations, the days the
 * three after its last hour (10 October 2026, 11:00 Malaysian time). Replace
 * this file with a recorded answer once the service runs; the shape must not
 * change, the numbers may.
 */

export const CONTRACT_VERSION = "2026-10-11-contract";

const forecast = (instrumentId: string, day: string, p10: number, p50: number, p90: number): ModelForecast => ({ instrumentId, day, p10, p50, p90, modelVersion: CONTRACT_VERSION });

/** Nine rows for three known instruments, plus one for a sensor the database does not hold. */
export const CONTRACT_FORECASTS: ModelForecast[] = [
  forecast("CA24N", "2026-10-11", 40, 52, 80),
  forecast("CA24N", "2026-10-12", 30, 45, 70),
  forecast("CA24N", "2026-10-13", 20, 30, 50),
  forecast("CA19B", "2026-10-11", 35, 48, 72),
  forecast("CA19B", "2026-10-12", 28, 40, 64),
  forecast("CA19B", "2026-10-13", 18, 28, 46),
  forecast("SGCENTRAL", "2026-10-11", 30, 44, 66),
  forecast("SGCENTRAL", "2026-10-12", 24, 36, 58),
  forecast("SGCENTRAL", "2026-10-13", 15, 24, 40),
  forecast("openaq:999999", "2026-10-11", 10, 15, 20),
];

/** The same answer as the service would write it, with one band deliberately out of order. */
export const PREDICT_JSON = JSON.stringify({
  modelVersion: CONTRACT_VERSION,
  asOf: "2026-10-10T03:00:00Z",
  forecasts: [
    { instrumentId: "CA24N", day: "2026-10-11", p10: 40, p50: 52, p90: 80 },
    { instrumentId: "CA24N", day: "2026-10-12", p10: 45, p50: 30, p90: 70 },
  ],
});

export const HEALTH_JSON = JSON.stringify({ status: "ok", modelVersion: CONTRACT_VERSION, trainedAt: "2026-10-11T02:00:00Z" });
export const HEALTH_EMPTY_JSON = JSON.stringify({ status: "ok", modelVersion: null, trainedAt: null });
