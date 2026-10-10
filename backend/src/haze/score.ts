/**
 * How a set of forecasts did against the readings that came after them, beside
 * "no change" on exactly the same cases. Pure: the backtest hands in what each
 * run forecast and every reading, and gets the table back.
 */

export interface IssuedForecast {
  asOf: Date;
  stationId: string;
  /** Hourly from `asOf` + 1 hour. */
  api: ArrayLike<number>;
  /** The reading the forecast started from, which is what "no change" carries forward. */
  carried: number;
}

export interface LeadRow {
  lead: number;
  cases: number;
  /** Mean absolute error in API points. */
  model: number;
  persistence: number;
  /** Mean of (forecast minus reading): above zero runs high. */
  bias: number;
  /** Share of cases where the forecast and the reading fall on the same side of each line. */
  lineAgreement: Record<number, number>;
  persistenceLineAgreement: Record<number, number>;
}

const HOUR_MS = 3_600_000;

/** `readingAt(stationId, at)` is the reading at that hour or null. */
export function scoreByLead(
  issued: IssuedForecast[],
  readingAt: (stationId: string, at: Date) => number | null,
  leads: number[],
  lines: number[],
): LeadRow[] {
  return leads.map((lead) => {
    let cases = 0;
    let model = 0;
    let persistence = 0;
    let bias = 0;
    const agree: Record<number, number> = {};
    const agreeCarried: Record<number, number> = {};
    for (const line of lines) {
      agree[line] = 0;
      agreeCarried[line] = 0;
    }
    for (const forecast of issued) {
      if (forecast.api.length < lead) continue;
      const observed = readingAt(forecast.stationId, new Date(forecast.asOf.getTime() + lead * HOUR_MS));
      if (observed === null) continue;
      const value = forecast.api[lead - 1];
      cases += 1;
      model += Math.abs(value - observed);
      persistence += Math.abs(forecast.carried - observed);
      bias += value - observed;
      for (const line of lines) {
        if (value > line === observed > line) agree[line] += 1;
        if (forecast.carried > line === observed > line) agreeCarried[line] += 1;
      }
    }
    const share = (tally: Record<number, number>): Record<number, number> =>
      Object.fromEntries(lines.map((line) => [line, cases === 0 ? 0 : tally[line] / cases]));
    return {
      lead,
      cases,
      model: cases === 0 ? 0 : model / cases,
      persistence: cases === 0 ? 0 : persistence / cases,
      bias: cases === 0 ? 0 : bias / cases,
      lineAgreement: share(agree),
      persistenceLineAgreement: share(agreeCarried),
    };
  });
}
