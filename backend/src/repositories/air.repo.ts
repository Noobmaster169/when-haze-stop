import type { Queryable } from "../db";
import { BAND_EDGES } from "../haze/api-index";

/**
 * Measured PM2.5 across every instrument that reports it, for looking back:
 * DOE's stations, Singapore's regions and OpenAQ's sensors, read together
 * because a past day is judged on all of them at once.
 */

/** DOE's bands as SQL: the 24 hour mean PM2.5 an API reading stands for, the same lines as `apiToPm25`. */
const PM25_OF_API = `case ${BAND_EDGES.slice(1)
  .map(([toUg, toApi], k) => {
    const [fromUg, fromApi] = BAND_EDGES[k];
    const line = `${fromUg} + (api - ${fromApi}) * ${(toUg - fromUg) / (toApi - fromApi)}`;
    return k === BAND_EDGES.length - 2 ? `else ${line}` : `when api <= ${toApi} then ${line}`;
  })
  .join(" ")} end`;

/** An hour is stamped with its end, so the hour ending at midnight belongs to the day before. */
const DAY_OF = "((observed_at - interval '1 second') at time zone 'UTC')::date";
/**
 * Above this a sensor's hour is taken for a fault and left out of what is
 * read. OpenAQ passes a broken sensor's numbers on as they come; the ceiling
 * sits far above the haze this app has stored, so no real episode is cut.
 */
export const PM25_CEILING = 2000;

/** For each UTC day, how many instruments measured PM2.5 and the median of their daily means, ug/m3. */
export async function airByDay(db: Queryable): Promise<{ day: string; monitors: number; pm25: number }[]> {
  const { rows } = await db.query<{ day: string; monitors: string; pm25: number }>(
    `with daily as (
       select ${DAY_OF} as day, avg(pm25) as pm25 from openaq_hours where pm25 <= ${PM25_CEILING} group by 1, sensor_id
       union all
       select ${DAY_OF}, avg(pm25_hourly) from nea_hours where pm25_hourly is not null group by 1, region
       union all
       select ${DAY_OF}, avg(${PM25_OF_API}) from readings r join stations s on s.id = r.station_id where s.network = 'doe' group by 1, station_id
     )
     select to_char(day, 'YYYY-MM-DD') as day, count(*) as monitors, percentile_cont(0.5) within group (order by pm25) as pm25
       from daily group by day order by day`,
  );
  return rows.map((row) => ({ day: row.day, monitors: Number(row.monitors), pm25: Math.round(row.pm25 * 10) / 10 }));
}

export interface InstrumentDay {
  /** The source and the instrument's id there: `doe:CA01R`, `nea:east`, `openaq:11760952`. */
  instrumentId: string;
  day: string;
  /** Mean and largest of the day's values, ug/m3. For a DOE station each value is itself a 24 hour mean. */
  mean: number;
  max: number;
  hours: number;
}

/** Every instrument's PM2.5 for each UTC day from `fromDay`, the rows a model is trained and scored on. */
export async function dailyByInstrument(db: Queryable, fromDay: string): Promise<InstrumentDay[]> {
  const { rows } = await db.query<{ id: string; day: string; mean: number; max: number; hours: string }>(
    `select id, to_char(day, 'YYYY-MM-DD') as day, mean, max, hours from (
       select 'openaq:' || sensor_id as id, ${DAY_OF} as day, avg(pm25) as mean, max(pm25) as max, count(*) as hours
         from openaq_hours where pm25 <= ${PM25_CEILING} group by 1, 2
       union all
       select 'nea:' || region, ${DAY_OF}, avg(pm25_hourly), max(pm25_hourly), count(*)
         from nea_hours where pm25_hourly is not null group by 1, 2
       union all
       select 'doe:' || station_id, ${DAY_OF}, avg(${PM25_OF_API}), max(${PM25_OF_API}), count(*)
         from readings r join stations s on s.id = r.station_id where s.network = 'doe' group by 1, 2
     ) daily where day >= $1 order by day, id`,
    [fromDay],
  );
  return rows.map((row) => ({ instrumentId: row.id, day: row.day, mean: row.mean, max: row.max, hours: Number(row.hours) }));
}
