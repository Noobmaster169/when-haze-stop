import type { Place, Station } from "../contracts";
import type { Queryable } from "../db";
import { distanceKm } from "../haze/grid";
import { childLogger } from "../lib/logger";
import { metar, stations } from "../repositories";
import type { Geocoder } from "../sources";
import { matchTier, normalise, searchGazetteer } from "../sources/gazetteer";
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

const RESULTS = 8;
/** A gazetteer or geocoder place this close to one already listed under the same name is the same place. */
const SAME_PLACE_KM = 15;

interface Ranked {
  place: Place;
  tier: number;
  /** Stations rank above towns of equal match, then the bigger place. */
  weight: number;
}

function isListed(listed: Ranked[], name: string, lat: number, lon: number): boolean {
  const key = normalise(name);
  return listed.some((item) => normalise(item.place.name) === key && distanceKm(lat, lon, item.place.lat, item.place.lon) < SAME_PLACE_KM);
}

/**
 * Our stations and the gazetteer answer from memory, at once. The geocoder
 * is someone else's service and takes seconds, so it is asked only with
 * `remote`, which the search box does when memory found little.
 */
export async function findPlaces(db: Queryable, geocoder: Geocoder, query: string, options: { remote: boolean } = { remote: false }): Promise<Place[]> {
  const all = await stations.list(db);
  const wanted = normalise(query);
  const ranked: Ranked[] = [];
  for (const station of all) {
    const tier = matchTier(normalise(station.name), wanted);
    if (tier === 0) continue;
    const place: Place = {
      name: station.name,
      kind: "station",
      region: station.state,
      country: station.network === "nea" ? "Singapore" : "Malaysia",
      lat: station.lat,
      lon: station.lon,
      nearest: { id: station.id, name: station.name, network: station.network, km: 0 },
    };
    ranked.push({ place, tier, weight: Number.MAX_SAFE_INTEGER });
  }
  for (const found of searchGazetteer(query, RESULTS * 2)) {
    if (isListed(ranked, found.name, found.lat, found.lon)) continue;
    const place: Place = { name: found.name, kind: found.kind, region: found.region, country: found.country, lat: found.lat, lon: found.lon, nearest: nearestStation(all, found.lat, found.lon) };
    ranked.push({ place, tier: matchTier(normalise(found.name), wanted), weight: found.population });
  }
  ranked.sort((a, b) => b.tier - a.tier || b.weight - a.weight);
  const local = ranked.slice(0, RESULTS);
  if (!options.remote) return local.map((item) => item.place);

  const remote = (await geocoded(geocoder, query))
    .filter((found) => !isListed(local, found.name, found.lat, found.lon))
    .map((found): Place => ({ ...found, kind: "place", nearest: nearestStation(all, found.lat, found.lon) }));
  return [...local.map((item) => item.place), ...remote].slice(0, RESULTS + 4);
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

  // An airport first, then the gazetteer, which answers at once; the geocoder only for what neither knows.
  const airport = await knownAirport(db, wanted);
  const [known] = airport ? [airport] : searchGazetteer(text, 1);
  const [place] = known ? [known] : await geocoded(geocoder, text);
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
