import { inDomain } from "../haze/grid";
import { GAZETTEER, type GazetteerKind } from "./gazetteer-data";

/**
 * Towns and districts searched in memory, so the search box answers as fast
 * as it is typed into. The geocoder stays behind it for the villages this list
 * leaves out.
 */

export interface GazetteerPlace {
  name: string;
  kind: GazetteerKind;
  region: string;
  country: string;
  lat: number;
  lon: number;
  population: number;
}

/** Lower case, accents and punctuation gone, single spaces: "Kota Kinabalu" and "kota-kinabalu" are one name. */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** How well a name answers a query: whole name, then its start, then a word's start, then anywhere. Zero is no match. */
export function matchTier(name: string, query: string): number {
  if (!query) return 0;
  if (name === query) return 4;
  if (name.startsWith(query)) return 3;
  if (name.includes(` ${query}`)) return 2;
  return name.includes(query) ? 1 : 0;
}

const PLACES = GAZETTEER.map(([name, kind, region, country, lat, lon, population]) => ({
  place: { name, kind, region, country, lat: lat / 1e4, lon: lon / 1e4, population },
  key: normalise(name),
})).filter(({ place }) => inDomain(place.lat, place.lon));

/** The best matches, the bigger place first among equals, so "Petaling" finds Petaling Jaya before a hamlet of that name. */
export function searchGazetteer(query: string, limit: number): GazetteerPlace[] {
  const wanted = normalise(query);
  if (wanted.length < 2) return [];
  const scored: { place: GazetteerPlace; tier: number }[] = [];
  for (const { place, key } of PLACES) {
    const tier = matchTier(key, wanted);
    if (tier > 0) scored.push({ place, tier });
  }
  scored.sort((a, b) => b.tier - a.tier || b.place.population - a.place.population || a.place.name.localeCompare(b.place.name));
  return scored.slice(0, limit).map((item) => item.place);
}
