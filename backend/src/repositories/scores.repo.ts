import type { LeadScore } from "../contracts";
import type { Queryable } from "../db";
import type { Quantiles } from "../haze/chance";
import { GRID_KEY } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";

/**
 * How the forecasts did, worked out from what is stored: every run's forecast
 * for a station at 24, 48 and 72 hours, beside the reading that hour and the
 * reading the run started from.
 */

/** One forecast that has since been checked, as SQL finds them. `lead` hours after `as_of`. Runs on the current grid and method only, so an hour run twice counts once and an old method's errors are not counted as this one's. */
const CHECKED = `
  select l.lead, o.api as observed, f.api[l.lead] as forecast, b.api as carried, r.as_of
    from forecast_runs r
    join station_forecasts f on f.run_id = r.id
    cross join (values (24), (48), (72)) as l(lead)
    join readings o on o.station_id = f.station_id and o.observed_at = r.as_of + make_interval(hours => l.lead)
    join readings b on b.station_id = f.station_id and b.observed_at = r.as_of
   where array_length(f.api, 1) >= l.lead and r.grid = $1 and r.model = $2`;

export async function byLead(db: Queryable): Promise<{ since: Date | null; leads: LeadScore[] }> {
  const { rows } = await db.query<{ lead: number; cases: string; model: number | null; persistence: number | null; since: Date | null }>(
    `select lead, count(*) as cases, avg(abs(observed - forecast)) as model,
            avg(abs(observed - carried)) as persistence, min(as_of) as since
       from (${CHECKED}) c group by lead order by lead`,
    [GRID_KEY, MODEL_VERSION],
  );
  const round = (value: number | null): number | null => (value === null ? null : Math.round(Number(value) * 10) / 10);
  return {
    since: rows.reduce<Date | null>((first, row) => (row.since && (!first || row.since < first) ? row.since : first), null),
    leads: [24, 48, 72].map((lead) => {
      const row = rows.find((item) => item.lead === lead);
      return { leadHours: lead, cases: row ? Number(row.cases) : 0, model: round(row?.model ?? null), persistence: round(row?.persistence ?? null) };
    }),
  };
}

export interface ErrorBucket {
  lead: number;
  hazy: boolean;
  cases: number;
  quantiles: Quantiles;
}

/** The spread of (reading minus forecast) by lead, split by whether the station started above 100. */
export async function errorQuantiles(db: Queryable): Promise<ErrorBucket[]> {
  const { rows } = await db.query<{ lead: number; hazy: boolean; cases: string; q: number[] }>(
    `select lead, carried > 100 as hazy, count(*) as cases,
            percentile_cont(array[0.1, 0.25, 0.5, 0.75, 0.9]) within group (order by observed - forecast) as q
       from (${CHECKED}) c group by lead, carried > 100`,
    [GRID_KEY, MODEL_VERSION],
  );
  return rows.map((row) => ({ lead: row.lead, hazy: row.hazy, cases: Number(row.cases), quantiles: row.q.map(Number) as Quantiles }));
}
