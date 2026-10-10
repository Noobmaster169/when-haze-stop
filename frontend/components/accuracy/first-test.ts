/**
 * The first test of the model, run on 10 October 2026 over real data: 68 DOE
 * stations, rolling starts every six hours from 6 October, each forecast
 * using only the fires known at its start. Shown beside the live record until
 * that has enough checked forecasts to stand alone. Full write-up in
 * docs/FEATURES.md.
 */
export const FIRST_TEST = {
  period: "6 to 10 October 2026",
  rankCorrelation: 0.84,
  stationHours: 8184,
  leads: [
    { leadHours: 24, model: 15.2, persistence: 14.9, cases: 858 },
    { leadHours: 48, model: 20.2, persistence: 20.6, cases: 594 },
    { leadHours: 72, model: 29.4, persistence: 28.6, cases: 330 },
  ],
} as const;
