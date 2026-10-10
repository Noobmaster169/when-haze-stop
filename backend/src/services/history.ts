import type { HazeDay, HazeDays } from "../contracts";
import type { Queryable } from "../db";
import { addHours, DOMAIN, FIELD, WEATHER } from "../haze/grid";
import { fires, forecasts, weather } from "../repositories";
import { packWind } from "./map";

/** Looking back: which days are stored, and one of them as the map draws it. */

const FIRE_LIMIT = 1500;
/** The wind is drawn from a frame every three hours, as on the live map. */
const WIND_EVERY_HOURS = 3;

export async function hazeDays(db: Queryable): Promise<HazeDays> {
  const hazeFrom = await forecasts.earliestFrameAt(db);
  return { days: await fires.byDay(db), hazeFrom: hazeFrom ? hazeFrom.toISOString() : null };
}

/** A day nothing is stored for comes back empty, not as an error: the page says there is nothing to show. */
export async function hazeDay(db: Queryable, day: string): Promise<HazeDay> {
  const start = new Date(`${day}T00:00:00Z`);
  const end = addHours(start, 24);
  const hours = Array.from({ length: 24 / WIND_EVERY_HOURS + 1 }, (_, index) => addHours(start, index * WIND_EVERY_HOURS));
  const [frames, winds, cells] = await Promise.all([forecasts.timeline(db, start, end), weather.windAt(db, hours), fires.strongest(db, day, FIRE_LIMIT, day)]);
  return {
    day,
    grid: { lon0: DOMAIN.lon0, lat0: DOMAIN.lat0, nx: FIELD.nx, ny: FIELD.ny, step: FIELD.step },
    windGrid: { lon0: DOMAIN.lon0, lat0: DOMAIN.lat0, nx: WEATHER.nx, ny: WEATHER.ny, step: WEATHER.step },
    // Every frame of a past day is behind the newest reading, so all of it is what was observed.
    frames: frames.map((frame) => ({ validAt: frame.validAt.toISOString(), observed: true, field: frame.field.toString("base64") })),
    wind: winds.map((hour) => ({ validAt: hour.validAt.toISOString(), uv: packWind(hour.u, hour.v) })),
    fires: cells,
  };
}
