/**
 * Every outside source the app reads, described for a person. The jobs
 * process records each fetch of a tracked source under its id; the Sources
 * page joins those records to this list.
 */

export const TRACKED_SOURCES = ["doe-stations", "doe-readings", "firms", "open-meteo"] as const;
export type SourceId = (typeof TRACKED_SOURCES)[number];

export interface SourceEntry {
  id: string;
  name: string;
  provider: string;
  what: string;
  endpoint: string;
  link: string;
  cadence: string;
  everyHours: number | null;
  tracked: boolean;
}

export const SOURCE_CATALOG: readonly SourceEntry[] = [
  {
    id: "doe-stations",
    name: "Station list",
    provider: "Department of Environment Malaysia (APIMS)",
    what: "Every DOE air quality station with its name, state and coordinates.",
    endpoint: "https://eqms.doe.gov.my/api3/publicportalapims/mapcaqm",
    link: "https://eqms.doe.gov.my/APIMS/main",
    cadence: "Every hour, at 20 past",
    everyHours: 1,
    tracked: true,
  },
  {
    id: "doe-readings",
    name: "Hourly readings",
    provider: "Department of Environment Malaysia (APIMS)",
    what: "The Air Pollutant Index at every station, hour by hour, one state per request. DOE keeps about 7 days.",
    endpoint: "https://eqms.doe.gov.my/api3/publicportalapims/apitablehourly?stateid=N&datetime=...",
    link: "https://eqms.doe.gov.my/APIMS/main",
    cadence: "Every hour, at 20 past",
    everyHours: 1,
    tracked: true,
  },
  {
    id: "firms",
    name: "Fire detections",
    provider: "NASA FIRMS",
    what: "Seven days of VIIRS fire detections over South East Asia from Suomi NPP, NOAA-20 and NOAA-21, low confidence dropped.",
    endpoint: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/.../*_VIIRS_C2_SouthEast_Asia_7d.csv",
    link: "https://firms.modaps.eosdis.nasa.gov/",
    cadence: "Every 3 hours",
    everyHours: 3,
    tracked: true,
  },
  {
    id: "open-meteo",
    name: "Wind and rain",
    provider: "Open-Meteo",
    what: "Hourly wind at 925 and 850 hPa and rain on a 1 degree grid, 8 days back and 5 days ahead, one grid row per request.",
    endpoint: "https://api.open-meteo.com/v1/forecast",
    link: "https://open-meteo.com/",
    cadence: "Every hour, at 20 past",
    everyHours: 1,
    tracked: true,
  },
  {
    id: "gazetteer",
    name: "Towns and districts",
    provider: "GeoNames (CC BY 4.0)",
    what: "1,706 towns, districts and states of Malaysia, Singapore and Brunei, bundled so a search answers at once.",
    endpoint: "backend/src/sources/gazetteer-data.ts",
    link: "https://www.geonames.org/",
    cadence: "Static, bundled",
    everyHours: null,
    tracked: false,
  },
  {
    id: "geocoder",
    name: "Place search",
    provider: "Open-Meteo geocoding",
    what: "Finds the villages the bundled list leaves out. Asked by the api only when the list has few matches, and cached for a day.",
    endpoint: "https://geocoding-api.open-meteo.com/v1/search",
    link: "https://open-meteo.com/en/docs/geocoding-api",
    cadence: "On each search",
    everyHours: null,
    tracked: false,
  },
  {
    id: "basemap",
    name: "Coastlines, borders and towns",
    provider: "Natural Earth (public domain)",
    what: "The map's outline, packed once into the frontend.",
    endpoint: "frontend/public/basemap.json",
    link: "https://www.naturalearthdata.com/",
    cadence: "Static",
    everyHours: null,
    tracked: false,
  },
];
