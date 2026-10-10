import type { HazeDay, HazeDays, StoredDay } from "../contracts";
import type { Queryable } from "../db";
import { addHours, DOMAIN, FIELD, WEATHER } from "../haze/grid";
import { air, fires, forecasts, metar, weather } from "../repositories";
import { dayMonitors } from "./day-air";
import { airportsBetween, packWind } from "./map";

/** Looking back: what is stored for each day, and one of them as the map draws it. */

const FIRE_LIMIT = 1500;
/** The wind is drawn from a frame every three hours, as on the live map. */
const WIND_EVERY_HOURS = 3;
/** A report older than this is not what an airport is seeing, so this is how far before midnight the day's first hour may look. */
const REPORT_REACH_HOURS = 3;
const DAY_MS = 86_400_000;

const NOTHING = { cells: 0, frpMw: 0, windHours: 0, airports: 0, hazeAirports: 0, monitors: 0, pm25: null };

/**
 * Every day from the first with anything stored to today, each with what it
 * holds of the four kinds of data. The wind's forecast days ahead are left
 * out: a day that has not happened is not one to look back at. With `fromDay`
 * the calendar starts no earlier than it, which keeps out the few hours of the
 * evening before that a source counting days in its own time zone brings.
 */
export async function hazeDays(db: Queryable, now = new Date(), fromDay: string | null = null): Promise<HazeDays> {
  const [burning, wind, seen, measured, hazeFrom] = await Promise.all([fires.byDay(db), weather.hoursByDay(db), metar.byDay(db), air.airByDay(db), forecasts.earliestFrameAt(db)]);
  const today = now.toISOString().slice(0, 10);
  const days = new Map<string, StoredDay>();
  const put = (day: string, part: Partial<StoredDay>): void => {
    if (day <= today && (fromDay === null || day >= fromDay)) days.set(day, { ...(days.get(day) ?? { day, ...NOTHING }), ...part });
  };
  for (const row of burning) put(row.day, { cells: row.cells, frpMw: row.frpMw });
  for (const row of wind) put(row.day, { windHours: row.hours });
  for (const row of seen) put(row.day, { airports: row.airports, hazeAirports: row.hazeAirports });
  for (const row of measured) put(row.day, { monitors: row.monitors, pm25: row.pm25 });

  const first = [...days.keys()].sort()[0];
  // Every day in between, so the strip is a calendar and a day with nothing shows as a gap.
  for (let time = first ? Date.parse(`${first}T00:00:00Z`) : Number.NaN; time <= Date.parse(`${today}T00:00:00Z`); time += DAY_MS) put(new Date(time).toISOString().slice(0, 10), {});
  return { days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)), hazeFrom: hazeFrom ? hazeFrom.toISOString() : null };
}

/** A day nothing is stored for comes back empty, not as an error: the page says there is nothing to show. */
export async function hazeDay(db: Queryable, day: string): Promise<HazeDay> {
  const start = new Date(`${day}T00:00:00Z`);
  const end = addHours(start, 24);
  const hours = Array.from({ length: 24 / WIND_EVERY_HOURS + 1 }, (_, index) => addHours(start, index * WIND_EVERY_HOURS));
  const [frames, winds, cells, airports, monitors] = await Promise.all([
    forecasts.timeline(db, start, end),
    weather.windAt(db, hours),
    fires.strongest(db, day, FIRE_LIMIT, day),
    airportsBetween(db, addHours(start, -REPORT_REACH_HOURS), end),
    dayMonitors(db, start),
  ]);
  return {
    day,
    grid: { lon0: DOMAIN.lon0, lat0: DOMAIN.lat0, nx: FIELD.nx, ny: FIELD.ny, step: FIELD.step },
    windGrid: { lon0: DOMAIN.lon0, lat0: DOMAIN.lat0, nx: WEATHER.nx, ny: WEATHER.ny, step: WEATHER.step },
    // Every frame of a past day is behind the newest reading, so all of it is what was observed.
    frames: frames.map((frame) => ({ validAt: frame.validAt.toISOString(), observed: true, field: frame.field.toString("base64") })),
    wind: winds.map((hour) => ({ validAt: hour.validAt.toISOString(), uv: packWind(hour.u, hour.v) })),
    fires: cells,
    airports: airports.filter((airport) => airport.reports.length > 0),
    monitors,
  };
}
