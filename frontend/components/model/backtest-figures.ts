/**
 * The backtest figures the published JSON does not carry, copied from
 * model/reports/2026-10-11-c88cac5a/scores.json. Hazy-day errors and the
 * ablation's changes are read from the JSON instead; these fill in the rest of
 * the same tables.
 */

export interface ForecastRow {
  name: string;
  /** The key into the JSON's hazy-day error, where it has one. */
  key: "model" | "noChange" | "v2" | null;
  allMae: number;
  hazyMae: number;
  hit150: number;
  falseAlarm150: number | null;
}

export interface DayTable {
  label: string;
  hazyDays: number;
  rows: ForecastRow[];
}

export const REFERENCE_DAYS = 2315;

export const DAY_ONE: DayTable = {
  label: "Day ahead",
  hazyDays: 168,
  rows: [
    { name: "Learned model", key: "model", allMae: 4.01, hazyMae: 15.48, hit150: 0.5, falseAlarm150: 0.43 },
    { name: "No change", key: "noChange", allMae: 4.59, hazyMae: 17.53, hit150: 0.48, falseAlarm150: 0.49 },
    { name: "Current forecast (v2)", key: "v2", allMae: 4.93, hazyMae: 18.05, hit150: 0.41, falseAlarm150: 0.33 },
    { name: "Climatology", key: null, allMae: 6.98, hazyMae: 41.01, hit150: 0, falseAlarm150: null },
  ],
};

export const DAY_TWO: DayTable = {
  label: "Two days ahead",
  hazyDays: 173,
  rows: [
    { name: "Learned model", key: "model", allMae: 4.63, hazyMae: 16.7, hit150: 0.44, falseAlarm150: 0.34 },
    { name: "No change", key: "noChange", allMae: 5.45, hazyMae: 20.61, hit150: 0.39, falseAlarm150: 0.56 },
    { name: "Current forecast (v2)", key: "v2", allMae: 6.38, hazyMae: 23.09, hit150: 0.32, falseAlarm150: 0.43 },
    { name: "Climatology", key: null, allMae: 7.19, hazyMae: 42.63, hit150: 0, falseAlarm150: null },
  ],
};

/** Day-ahead all-day error by test month: the month, rows trained on, model, no change, v2. */
export const MONTHS: readonly (readonly [string, number, number, number, number])[] = [
  ["2025-07", 1218, 2.94, 3.01, 3.61],
  ["2025-08", 2795, 3.73, 4.8, 5.22],
  ["2025-09", 4393, 3.05, 4.03, 4.44],
  ["2025-10", 6043, 2.78, 3.54, 3.74],
  ["2025-11", 7676, 2.9, 3.53, 3.79],
  ["2025-12", 9243, 2.75, 2.78, 3.0],
  ["2026-01", 10947, 2.46, 2.03, 2.95],
  ["2026-02", 12663, 3.02, 3.94, 4.5],
  ["2026-03", 14187, 2.49, 2.97, 3.45],
  ["2026-04", 15971, 2.68, 3.41, 3.53],
  ["2026-05", 17738, 3.34, 4.5, 4.63],
  ["2026-06", 19573, 3.49, 2.71, 3.38],
  ["2026-07", 21337, 3.25, 3.7, 3.65],
  ["2026-08", 23011, 3.49, 3.71, 4.44],
  ["2026-09 (haze)", 24816, 13.89, 16.59, 15.97],
  ["2026-10 (haze, 8 days)", 26637, 19.1, 19.23, 19.54],
];

/** The ablation's full-model hazy error and each group's error without it; the change column comes from the JSON. */
export const ABLATION_FULL_MAE = 17.09;
export const ABLATION_MAE: Record<string, number> = {
  "Air state": 22.31,
  "Physics (transport model)": 18.02,
  "Fires by direction": 17.62,
  Weather: 17.48,
  Identity: 17.37,
  Calendar: 16.76,
};
export const ABLATION_DAYS = 419;

/** The same backtest scored with DOE stations included, on the days the physics input exists. */
export const WITH_DOE = { hazyMae: 17.2, days: 419, hit150: 0.7, falseAlarm150: 0.17 };
