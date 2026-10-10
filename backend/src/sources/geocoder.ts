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
const TIMEOUT_MS = 10_000;

const Body = z.object({
  results: z
    .array(z.object({ name: z.string(), latitude: z.number(), longitude: z.number(), country: z.string().optional(), admin1: z.string().optional() }))
    .optional(),
});

export function openMeteoGeocoder(): Geocoder {
  return {
    async search(name) {
      const url = `${BASE}?count=10&language=en&name=${encodeURIComponent(name)}`;
      const body = Body.parse(JSON.parse(await fetchText(url, "Open-Meteo geocoder", TIMEOUT_MS)));
      return (body.results ?? [])
        .filter((place) => inDomain(place.latitude, place.longitude))
        .map((place) => ({ name: place.name, region: place.admin1 ?? "", country: place.country ?? "", lat: place.latitude, lon: place.longitude }));
    },
  };
}
