import type { Queryable } from "../db";
import type { OpenAqHour, OpenAqSensor } from "../sources/openaq";

/** OpenAQ's PM2.5 sensors and their hourly means. An hour once stored is never rewritten. */

export interface StoredSensor {
  sensorId: number;
  name: string;
  provider: string;
  reference: boolean;
  lat: number;
  lon: number;
}

/** OpenAQ renames and moves a place now and then; its newest word on a sensor replaces the last. */
export async function upsertSensors(db: Queryable, sensors: OpenAqSensor[]): Promise<void> {
  if (sensors.length === 0) return;
  await db.query(
    `insert into openaq_sensors (sensor_id, location_id, name, provider, reference, lat, lon)
     select * from unnest($1::bigint[], $2::bigint[], $3::text[], $4::text[], $5::boolean[], $6::float8[], $7::float8[])
     on conflict (sensor_id) do update
       set location_id = excluded.location_id, name = excluded.name, provider = excluded.provider, reference = excluded.reference,
           lat = excluded.lat, lon = excluded.lon, updated_at = now()`,
    [
      sensors.map((sensor) => sensor.sensorId),
      sensors.map((sensor) => sensor.locationId),
      sensors.map((sensor) => sensor.name),
      sensors.map((sensor) => sensor.provider),
      sensors.map((sensor) => sensor.reference),
      sensors.map((sensor) => sensor.lat),
      sensors.map((sensor) => sensor.lon),
    ],
  );
}

/** Returns how many were new. */
export async function insertHours(db: Queryable, hours: OpenAqHour[]): Promise<number> {
  if (hours.length === 0) return 0;
  const { rowCount } = await db.query(
    `insert into openaq_hours (sensor_id, observed_at, pm25)
     select * from unnest($1::bigint[], $2::timestamptz[], $3::real[])
     on conflict do nothing`,
    [hours.map((hour) => hour.sensorId), hours.map((hour) => hour.observedAt), hours.map((hour) => hour.pm25)],
  );
  return rowCount ?? 0;
}

/** Every sensor that has at least one stored hour. */
export async function withHours(db: Queryable): Promise<StoredSensor[]> {
  const { rows } = await db.query<{ sensor_id: string; name: string; provider: string; reference: boolean; lat: number; lon: number }>(
    `select sensor_id, name, provider, reference, lat, lon from openaq_sensors s
      where exists (select 1 from openaq_hours h where h.sensor_id = s.sensor_id) order by sensor_id`,
  );
  return rows.map((row) => ({ sensorId: Number(row.sensor_id), name: row.name, provider: row.provider, reference: row.reference, lat: row.lat, lon: row.lon }));
}

/** Each sensor's oldest and newest stored hour: where its history and its next hourly fetch pick up. */
export async function spanBySensor(db: Queryable): Promise<{ oldest: Map<number, Date>; newest: Map<number, Date> }> {
  const { rows } = await db.query<{ sensor_id: string; oldest: Date; newest: Date }>(
    "select sensor_id, min(observed_at) as oldest, max(observed_at) as newest from openaq_hours group by sensor_id",
  );
  return { oldest: new Map(rows.map((row) => [Number(row.sensor_id), row.oldest])), newest: new Map(rows.map((row) => [Number(row.sensor_id), row.newest])) };
}

/** The sensors that reported in a window, each with its hours there, oldest first. */
export async function between(db: Queryable, after: Date, until: Date): Promise<(StoredSensor & { hours: { at: Date; pm25: number }[] })[]> {
  const { rows } = await db.query<{ sensor_id: string; name: string; provider: string; reference: boolean; lat: number; lon: number; observed_at: Date; pm25: number }>(
    `select s.sensor_id, s.name, s.provider, s.reference, s.lat, s.lon, h.observed_at, h.pm25
       from openaq_hours h join openaq_sensors s using (sensor_id)
      where h.observed_at > $1 and h.observed_at <= $2
      order by s.sensor_id, h.observed_at`,
    [after, until],
  );
  const sensors = new Map<number, StoredSensor & { hours: { at: Date; pm25: number }[] }>();
  for (const row of rows) {
    const id = Number(row.sensor_id);
    let sensor = sensors.get(id);
    if (!sensor) {
      sensor = { sensorId: id, name: row.name, provider: row.provider, reference: row.reference, lat: row.lat, lon: row.lon, hours: [] };
      sensors.set(id, sensor);
    }
    sensor.hours.push({ at: row.observed_at, pm25: row.pm25 });
  }
  return [...sensors.values()];
}
