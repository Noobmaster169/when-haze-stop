import { distanceKm } from "../haze/grid";
import { regionOf } from "../haze/regions";
import type { Place } from "../suppression/complexes";
import { GAZETTEER } from "./gazetteer-data";
import { INDONESIAN_PLACES } from "./places-id-data";

/**
 * Names the place a fire complex is in, and says whose soil it is, from the
 * bundled gazetteers (GeoNames, CC BY 4.0): Malaysia, Singapore and Brunei in
 * gazetteer-data.ts, Indonesia in places-id-data.ts. The country is the
 * nearest named place's, which is right everywhere but within a few km of a
 * land border; the mandate rules only need the island and the country.
 */

interface Named {
  name: string;
  province: string;
  country: Place["country"];
  lat: number;
  lon: number;
}

const NAMED: Named[] = [
  ...INDONESIAN_PLACES.map(([name, , province, lat, lon]) => ({ name, province, country: "Indonesia" as const, lat: lat / 1e4, lon: lon / 1e4 })),
  ...GAZETTEER.filter(([, kind]) => kind !== "state").map(([name, , region, country, lat, lon]) => ({
    name,
    province: region,
    country: country as Place["country"],
    lat: lat / 1e4,
    lon: lon / 1e4,
  })),
];

/** Past this the nearest named place says little about where a fire is: southern Thailand has none in either list. */
const NAMED_WITHIN_KM = 80;

function areaOf(lat: number, lon: number, country: Place["country"]): Place["area"] {
  const region = regionOf(lat, lon);
  if (country === "Indonesia") return region === "Borneo" ? "kalimantan" : region === "Sumatra and the Riau islands" ? "sumatra" : "other";
  if (country === "Malaysia") return region === "Borneo" ? "malaysian_borneo" : region === "Peninsular Malaysia and southern Thailand" ? "peninsula" : "other";
  return "other";
}

export function placeOf(lat: number, lon: number): Place {
  let nearest = NAMED[0];
  let best = Number.POSITIVE_INFINITY;
  for (const place of NAMED) {
    const km = distanceKm(lat, lon, place.lat, place.lon);
    if (km < best) {
      best = km;
      nearest = place;
    }
  }
  if (best > NAMED_WITHIN_KM && regionOf(lat, lon) === "Peninsular Malaysia and southern Thailand" && lat > 6) {
    return { name: "southern Thailand", province: "", country: "Thailand", area: "other" };
  }
  return { name: `near ${nearest.name}`, province: nearest.province, country: nearest.country, area: areaOf(lat, lon, nearest.country) };
}
