import type { Place, Station } from "../contracts";
import type { Queryable } from "../db";
import { distanceKm } from "../haze/grid";
import { childLogger } from "../lib/logger";
import { stations } from "../repositories";
import type { Geocoder } from "../sources";

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
    if (!best || km < best.km) best = { id: station.id, name: station.name, km: Math.round(km) };
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
    .map((station) => ({ name: station.name, region: station.state, country: "Malaysia", lat: station.lat, lon: station.lon, nearest: { id: station.id, name: station.name, km: 0 } }));

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

  const [place] = await geocoded(geocoder, text);
  if (place) {
    const nearest = nearestStation(all, place.lat, place.lon);
    const station = all.find((item) => item.id === nearest?.id);
    if (station && nearest) return { station, via: nearest.km === 0 ? null : `${place.name}, ${nearest.km} km away` };
  }
  const partial = all.find((station) => station.name.toLowerCase().includes(wanted));
  return partial ? { station: partial, via: null } : null;
}
