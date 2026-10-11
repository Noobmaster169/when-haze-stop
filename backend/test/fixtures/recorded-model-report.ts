import type { ModelReport } from "../../src/sources/model";

/**
 * The live version's backtest as the model service's GET /report answers it,
 * copied from model/reports/2026-10-11-c88cac5a/scores.json: the pooled
 * hazy-day MAE on the reference instruments at one and two days ahead.
 */

export const REPORT_VERSION = "2026-10-11-c88cac5a";

export const REPORT_JSON = JSON.stringify({
  version: REPORT_VERSION,
  trainedAt: "2026-10-10T17:44:15.598186+00:00",
  promotionScore: 15.480474519567545,
  hazyMae: {
    d1: { model: 15.480474519567545, persistence: 17.53, v2: 18.05 },
    d2: { model: 16.7, persistence: 20.61, v2: 23.09 },
  },
});

export const RECORDED_REPORT: ModelReport = {
  version: REPORT_VERSION,
  trainedAt: new Date("2026-10-10T17:44:15.598Z"),
  promotionScore: 15.480474519567545,
  hazyMae: {
    d1: { model: 15.480474519567545, persistence: 17.53, v2: 18.05 },
    d2: { model: 16.7, persistence: 20.61, v2: 23.09 },
  },
};
