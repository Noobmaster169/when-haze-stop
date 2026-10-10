import { apiToPm25, pm25ToApi } from "./api-index";
import { distanceKm } from "./grid";
import { aerosolDepth, visibilityKm } from "./visibility";

/**
 * One hourly series for a point between stations: what the city's air was and
 * is forecast to be, and how far one could see through it. Pure.
 *
 * Stations are blended by inverse squared distance in concentration, not in
 * index points, since smoke adds micrograms and the index bands are unequal.
 */

export interface StationSeries {
  id: string;
  name: string;
  lat: number;
  lon: number;
  readings: { at: string; api: number }[];
  forecast: { at: string; api: number }[];
}

export interface CityHour {
  at: string;
  observed: boolean;
  api: number;
  pm25: number;
  visibilityKm: number;
  aerosolDepth: number;
}

export interface StationShare {
  id: string;
  name: string;
  km: number;
  share: number;
}

/** A station this close is the reading; the floor keeps the weight finite. */
const NEAREST_KM = 0.5;

export function stationShares(lat: number, lon: number, stations: StationSeries[]): StationShare[] {
  const weights = stations.map((station) => {
    const km = distanceKm(lat, lon, station.lat, station.lon);
    return { id: station.id, name: station.name, km, weight: 1 / Math.max(km, NEAREST_KM) ** 2 };
  });
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  return weights.map(({ weight, ...rest }) => ({ ...rest, km: Math.round(rest.km * 10) / 10, share: total > 0 ? weight / total : 0 }));
}

function hourOf(station: StationSeries): Map<string, { api: number; observed: boolean }> {
  const byHour = new Map<string, { api: number; observed: boolean }>();
  for (const item of station.forecast) byHour.set(item.at, { api: item.api, observed: false });
  // A reading wins over a forecast for the same hour.
  for (const item of station.readings) byHour.set(item.at, { api: item.api, observed: true });
  return byHour;
}

export function cityHours(lat: number, lon: number, stations: StationSeries[]): CityHour[] {
  const shares = stationShares(lat, lon, stations);
  const series = stations.map(hourOf);
  const hours = [...new Set(series.flatMap((byHour) => [...byHour.keys()]))].sort();
  return hours.flatMap((at) => {
    let weight = 0;
    let mass = 0;
    let observed = false;
    series.forEach((byHour, index) => {
      const value = byHour.get(at);
      if (!value) return;
      // An hour some station read is an observed hour; forecasts for it from the others are left out.
      if (value.observed && !observed) {
        observed = true;
        weight = 0;
        mass = 0;
      }
      if (value.observed !== observed) return;
      weight += shares[index].share;
      mass += shares[index].share * apiToPm25(value.api);
    });
    if (weight === 0) return [];
    const pm25 = mass / weight;
    return [
      {
        at,
        observed,
        api: Math.round(pm25ToApi(pm25)),
        pm25: Math.round(pm25 * 10) / 10,
        visibilityKm: Math.round(visibilityKm(pm25) * 10) / 10,
        aerosolDepth: Math.round(aerosolDepth(pm25) * 100) / 100,
      },
    ];
  });
}
