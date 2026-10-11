import type { AirMonitor } from "../contracts";
import type { Queryable } from "../db";
import { apiToPm25 } from "../haze/api-index";
import { addHours, hoursBetween } from "../haze/grid";
import { nea, openaq, readings, stations } from "../repositories";
import { PM25_CEILING } from "../repositories/air.repo";
import { NEA_STATIONS } from "../sources/nea";

/**
 * Every instrument that measured PM2.5 on one past UTC day, in one shape: DOE's
 * stations, Singapore's regions and the sensors OpenAQ gathers. A day is the
 * 24 hours that end after its midnight, because each source stamps an hour
 * with its end.
 */

const HOURS = 24;

function slots(start: Date, hours: { at: Date; pm25: number }[]): (number | null)[] {
  const values: (number | null)[] = new Array<number | null>(HOURS).fill(null);
  for (const hour of hours) {
    const slot = hoursBetween(start, hour.at) - 1;
    if (slot >= 0 && slot < HOURS) values[slot] = Math.round(hour.pm25 * 10) / 10;
  }
  return values;
}

function group<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

export async function dayMonitors(db: Queryable, start: Date): Promise<AirMonitor[]> {
  const end = addHours(start, HOURS);
  const [sensors, regions, read, known] = await Promise.all([openaq.between(db, start, end), nea.between(db, start, end), readings.between(db, start, end), stations.list(db)]);
  const monitors: AirMonitor[] = [];

  const byStation = group(read, (reading) => reading.stationId);
  for (const station of known) {
    const mine = byStation.get(station.id);
    // Singapore's regions are in `readings` as an index too; their measured hours come from `nea_hours` below.
    if (!mine || station.network !== "doe") continue;
    monitors.push({
      id: `doe:${station.id}`,
      name: station.name,
      source: "doe",
      provider: "Department of Environment Malaysia",
      reference: true,
      averaging: "24h",
      lat: station.lat,
      lon: station.lon,
      pm25: slots(start, mine.map((reading) => ({ at: reading.observedAt, pm25: apiToPm25(reading.api) }))),
    });
  }

  const byRegion = group(regions, (hour) => hour.region);
  for (const place of NEA_STATIONS) {
    const mine = (byRegion.get(place.region) ?? []).flatMap((hour) => (hour.pm25Hourly === null ? [] : [{ at: hour.observedAt, pm25: hour.pm25Hourly }]));
    if (mine.length === 0) continue;
    monitors.push({ id: `nea:${place.region}`, name: place.name, source: "nea", provider: "National Environment Agency Singapore", reference: true, averaging: "1h", lat: place.lat, lon: place.lon, pm25: slots(start, mine) });
  }

  for (const sensor of sensors) {
    const mine = sensor.hours.filter((hour) => hour.pm25 <= PM25_CEILING);
    if (mine.length === 0) continue;
    monitors.push({ id: `openaq:${sensor.sensorId}`, name: sensor.name, source: "openaq", provider: sensor.provider, reference: sensor.reference, averaging: "1h", lat: sensor.lat, lon: sensor.lon, pm25: slots(start, mine) });
  }
  return monitors;
}
