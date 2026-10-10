import { z } from "zod";

import { inDomain } from "../haze/grid";
import { fetchText } from "./http";

/** Open-Meteo's geocoder: a place name to coordinates, for the search box and the assistant. */

export interface FoundPlace {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
}

export interface Geocoder {
  /** Places inside the map's region, best match first. */
  search(name: string): Promise<FoundPlace[]>;
}

const BASE = "https://geocoding-api.open-meteo.com/v1/search";
/** A search box cannot wait longer; the gazetteer has already answered by then. */
const TIMEOUT_MS = 6_000;
/** Place names do not move. A day keeps repeated searches instant without growing stale. */
const CACHE_MS = 86_400_000;
const CACHE_SIZE = 500;

const Body = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        country_code: z.string().optional(),
        admin1: z.string().optional(),
        population: z.number().optional(),
      }),
    )
    .optional(),
});

export function openMeteoGeocoder(): Geocoder {
  const cache = new Map<string, { at: number; places: FoundPlace[] }>();
  return {
    async search(name) {
      const key = name.trim().toLowerCase();
      const kept = cache.get(key);
      if (kept && Date.now() - kept.at < CACHE_MS) return kept.places;

      const url = `${BASE}?count=10&language=en&name=${encodeURIComponent(name)}`;
      const body = Body.parse(JSON.parse(await fetchText(url, "Open-Meteo geocoder", TIMEOUT_MS)));
      // Malaysia first, then the bigger place: "Petaling" should find Petaling Jaya before five hamlets in Sumatra.
      const places = (body.results ?? [])
        .filter((place) => inDomain(place.latitude, place.longitude))
        .sort((a, b) => Number(b.country_code === "MY") - Number(a.country_code === "MY") || (b.population ?? 0) - (a.population ?? 0))
        .map((place) => ({ name: place.name, region: place.admin1 ?? "", country: place.country ?? "", lat: place.latitude, lon: place.longitude }));
      if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value ?? "");
      cache.set(key, { at: Date.now(), places });
      return places;
    },
  };
}
