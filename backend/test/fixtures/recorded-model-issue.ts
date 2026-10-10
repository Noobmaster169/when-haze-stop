import type { ModelForecast } from "../../src/sources/model";

/**
 * The real 00:00 UTC issue of 10 October 2026 by version 2026-10-11-c88cac5a,
 * copied from the compose database's model_forecasts for Seremban and
 * Petaling Jaya of the recorded week (Kuching had no fresh level and no row;
 * Cheras and Klang are left out so the outlook tests keep a station without
 * one), Singapore Central, KLIA and one OpenAQ sensor. Peak 24 h PM2.5 in ug/m3, p10 / p50 / p90.
 */

export const ISSUE_VERSION = "2026-10-11-c88cac5a";
export const ISSUE_AT = new Date("2026-10-10T00:00:00Z");

const forecast = (instrumentId: string, day: string, p10: number, p50: number, p90: number): ModelForecast => ({ instrumentId, day, p10, p50, p90, modelVersion: ISSUE_VERSION });

export const RECORDED_ISSUE: ModelForecast[] = [
  forecast("CA19B", "2026-10-11", 63.24499, 71.510506, 79.021614),
  forecast("CA19B", "2026-10-12", 64.31917, 67.19841, 86.07694),
  forecast("CA19B", "2026-10-13", 59.32177, 65.039474, 75.03307),
  forecast("CA24N", "2026-10-11", 87.80852, 95.48732, 115.0787),
  forecast("CA24N", "2026-10-12", 84.088066, 86.193665, 94.68326),
  forecast("CA24N", "2026-10-13", 73.40405, 79.17109, 81.32408),
  forecast("SGCENTRAL", "2026-10-11", 89.303535, 100.1655, 134.5394),
  forecast("SGCENTRAL", "2026-10-12", 83.65145, 87.00359, 107.31709),
  forecast("SGCENTRAL", "2026-10-13", 72.86522, 86.55415, 96.58409),
  forecast("WMKK", "2026-10-11", 76.78807, 79.049774, 81.32538),
  forecast("WMKK", "2026-10-12", 72.41495, 72.660545, 97.07525),
  forecast("WMKK", "2026-10-13", 63.079117, 63.931194, 77.9124),
  forecast("openaq:12488751", "2026-10-11", 21.706633, 30.02165, 71.90262),
  forecast("openaq:12488751", "2026-10-12", 12.781236, 29.648237, 74.188065),
  forecast("openaq:12488751", "2026-10-13", 21.852537, 27.906488, 64.20107),
];
