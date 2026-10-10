import type { Place, Station } from "../contracts";
import type { Queryable } from "../db";
import { distanceKm } from "../haze/grid";
import { childLogger } from "../lib/logger";
import { metar, stations } from "../repositories";
import type { Geocoder } from "../sources";
import { AIRPORT_ALIASES } from "../sources/metar";

/** A name to a place on the map, with the DOE station that speaks for it. */

const log = childLogger({ module: "places" });

/**
 * The geocoder is someone else's service and the stations are ours. When it
 * does not answer, a search still finds every station by name, which covers
 * most of what people type; the failure is logged, not hidden.
 */
async function geocoded(geocoder: Geocoder, text: string): Promise<Awaited<ReturnType<Geocoder["search"]>>> {
  try {
    return await geocoder.search(text);
  } catch (error) {
    log.warn({ err: error instanceof Error ? error.message : String(error) }, "the geocoder did not answer; searching station names only");
    return [];
  }
}

export function nearestStation(all: Station[], lat: number, lon: number): Place["nearest"] {
  let best: Place["nearest"] = null;
  for (const station of all) {
    const km = distanceKm(lat, lon, station.lat, station.lon);
    if (!best || km < best.km) best = { id: station.id, name: station.name, network: station.network, km: Math.round(km) };
  }
  return best;
}

/**
 * Stations whose own name matches come first: someone typing "Klang" means the
 * Klang the readings are for, before any other place the geocoder knows by
 * that name.
 */
export async function findPlaces(db: Queryable, geocoder: Geocoder, query: string): Promise<Place[]> {
  const all = await stations.list(db);
  const wanted = query.trim().toLowerCase();
  const own: Place[] = all
    .filter((station) => station.name.toLowerCase().includes(wanted))
    .map((station) => ({
      name: station.name,
      region: station.state,
      country: station.network === "nea" ? "Singapore" : "Malaysia",
      lat: station.lat,
      lon: station.lon,
      nearest: { id: station.id, name: station.name, network: station.network, km: 0 },
    }));

  const found = await geocoded(geocoder, query);
  const elsewhere: Place[] = found
    .filter((place) => !own.some((station) => station.name.toLowerCase() === place.name.toLowerCase()))
    .map((place) => ({ ...place, nearest: nearestStation(all, place.lat, place.lon) }));
  return [...own, ...elsewhere].slice(0, 8);
}

export interface ResolvedStation {
  station: Station;
  /** What was asked for, where it is not the station itself: "Sepang, 23 km away". */
  via: string | null;
}

/**
 * The station that speaks for whatever was typed: a station id, a station's
 * name, or any place the geocoder knows, which gets the closest station.
 * Null where nothing in the region matches.
 */
export async function resolveStation(db: Queryable, geocoder: Geocoder, text: string): Promise<ResolvedStation | null> {
  const all = await stations.list(db);
  const wanted = text.trim().toLowerCase();
  const exact = all.find((station) => station.id.toLowerCase() === wanted || station.name.toLowerCase() === wanted);
  if (exact) return { station: exact, via: null };

  const airport = await knownAirport(db, wanted);
  const [place] = airport ? [airport] : await geocoded(geocoder, text);
  if (place) {
    const nearest = nearestStation(all, place.lat, place.lon);
    const station = all.find((item) => item.id === nearest?.id);
    if (station && nearest) return { station, via: nearest.km === 0 ? null : `${place.name}, ${nearest.km} km away` };
  }
  const partial = all.find((station) => station.name.toLowerCase().includes(wanted));
  return partial ? { station: partial, via: null } : null;
}

/** An airport by its code or usual name ("KLIA"), asked before the geocoder, to which KLIA is a village in Sabah. */
async function knownAirport(db: Queryable, wanted: string): Promise<ResolvedPoint | null> {
  const code = AIRPORT_ALIASES[wanted] ?? wanted.toUpperCase();
  const airport = (await metar.airports(db)).find((item) => item.icao === code || item.name.toLowerCase() === wanted);
  return airport ? { name: airport.name, lat: airport.lat, lon: airport.lon } : null;
}

export interface ResolvedPoint {
  name: string;
  lat: number;
  lon: number;
}

/**
 * The spot that was typed, for a source that is not read at stations: a
 * station's own position, an airport, or the place the geocoder found. Null
 * where nothing in the region matches.
 */
export async function resolvePoint(db: Queryable, geocoder: Geocoder, text: string): Promise<ResolvedPoint | null> {
  const all = await stations.list(db);
  const wanted = text.trim().toLowerCase();
  const exact = all.find((station) => station.id.toLowerCase() === wanted || station.name.toLowerCase() === wanted);
  if (exact) return { name: exact.name, lat: exact.lat, lon: exact.lon };
  const airport = await knownAirport(db, wanted);
  if (airport) return airport;
  const [place] = await geocoded(geocoder, text);
  if (place) return { name: place.name, lat: place.lat, lon: place.lon };
  const partial = all.find((station) => station.name.toLowerCase().includes(wanted));
  return partial ? { name: partial.name, lat: partial.lat, lon: partial.lon } : null;
}
