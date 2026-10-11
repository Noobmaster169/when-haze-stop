import type { Queryable } from "../db";
import { metar, openaq, stations } from "../repositories";

/**
 * Every place that measures the air or sees the haze, as one list with one
 * naming rule. The hindcast, the simulation scores and the model package all
 * read it, and the Python package builds the same list from the same tables,
 * so the rule here is the contract:
 *
 *   stations        id as stored; kind is the network (doe or nea)
 *   openaq_sensors  "openaq:" and the sensor id; reference and low-cost alike
 *   airports        the ICAO code
 *
 * Ordered by kind in that order, then id. Nothing is filtered by region.
 */

export type InstrumentKind = "doe" | "nea" | "openaq" | "airport";

export interface Instrument {
  id: string;
  kind: InstrumentKind;
  lat: number;
  lon: number;
}

export function openAqInstrumentId(sensorId: number): string {
  return `openaq:${sensorId}`;
}

export async function listInstruments(db: Queryable): Promise<Instrument[]> {
  const byId = (a: Instrument, b: Instrument): number => a.id.localeCompare(b.id);
  const placed = (await stations.list(db)).map((station) => ({ id: station.id, kind: station.network, lat: station.lat, lon: station.lon }));
  const sensors = (await openaq.sensors(db)).map((sensor) => ({ id: openAqInstrumentId(sensor.sensorId), kind: "openaq" as const, lat: sensor.lat, lon: sensor.lon }));
  const airports = (await metar.airports(db)).map((airport) => ({ id: airport.icao, kind: "airport" as const, lat: airport.lat, lon: airport.lon }));
  return [
    ...placed.filter((item) => item.kind === "doe").sort(byId),
    ...placed.filter((item) => item.kind === "nea").sort(byId),
    ...sensors.sort(byId),
    ...airports.sort(byId),
  ];
}
