import type { CityAir } from "../contracts";
import type { Queryable } from "../db";
import { cityHours, stationShares, type StationSeries } from "../haze/city-air";
import { distanceKm } from "../haze/grid";
import { ASSUMED_HUMIDITY, massExtinction } from "../haze/visibility";
import { stations } from "../repositories";
import { outlookContext, outlookFor } from "./outlook";

/**
 * The cities the 3D view can show, and their air: the stations around each
 * blended into one series. A city is a point, the place its scene is centred.
 */

interface City {
  name: string;
  lat: number;
  lon: number;
}

/** Kuala Lumpur is centred on the Petronas Twin Towers, the origin of the baked scene in frontend/public/city/kl.json. */
export const CITIES: Record<string, City> = {
  kl: { name: "Kuala Lumpur", lat: 3.15785, lon: 101.71165 },
};

/** Stations this close are the city's own; KL's two, Batu Muda and Cheras, are about 6 km out. */
const AROUND_KM = 10;

/** Null for a city that is not in CITIES. */
export async function cityAir(db: Queryable, key: string): Promise<CityAir | null> {
  if (!Object.hasOwn(CITIES, key)) return null;
  const city = CITIES[key];
  const all = await stations.list(db);
  const byDistance = all
    .map((station) => ({ station, km: distanceKm(city.lat, city.lon, station.lat, station.lon) }))
    .sort((a, b) => a.km - b.km);
  const around = byDistance.filter((item) => item.km <= AROUND_KM);
  const chosen = (around.length > 0 ? around : byDistance.slice(0, 1)).map((item) => item.station);

  const context = await outlookContext(db);
  const series: StationSeries[] = await Promise.all(
    chosen.map(async (station) => {
      const outlook = context ? await outlookFor(db, station, context) : null;
      return { id: station.id, name: station.name, lat: station.lat, lon: station.lon, readings: outlook?.readings ?? [], forecast: outlook?.forecast ?? [] };
    }),
  );
  const hours = cityHours(city.lat, city.lon, series);
  const observed = hours.filter((hour) => hour.observed);
  return {
    city: { key, ...city },
    stations: stationShares(city.lat, city.lon, series).map((share) => ({ ...share, share: Math.round(share.share * 100) / 100 })),
    asOf: observed.length > 0 ? observed[observed.length - 1].at : null,
    humidity: ASSUMED_HUMIDITY,
    massExtinction: Math.round(massExtinction() * 100) / 100,
    hours,
  };
}
