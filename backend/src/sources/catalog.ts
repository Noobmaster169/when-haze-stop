/**
 * Every outside source the app reads, described for a person. The jobs
 * process records each fetch of a tracked source under its id; the Sources
 * page joins those records to this list.
 */

export const TRACKED_SOURCES = ["doe-stations", "doe-readings", "firms", "open-meteo", "firms-archive", "open-meteo-history", "metar", "nea"] as const;
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
    id: "firms-archive",
    name: "Fire archive",
    provider: "NASA FIRMS",
    what: "Older fire detections, and NASA's own label for the hotspots that are not vegetation burning (gas flares, industry, volcanoes). Those are taken out of the fires the model burns.",
    endpoint: "https://firms.modaps.eosdis.nasa.gov/api/area/csv/...",
    link: "https://firms.modaps.eosdis.nasa.gov/api/area/",
    cadence: "On demand (pnpm haze:history)",
    everyHours: null,
    tracked: true,
  },
  {
    id: "open-meteo-history",
    name: "Wind and rain history",
    provider: "Open-Meteo",
    what: "The same wind and rain for the months before this app started, from Open-Meteo's archive of past model runs.",
    endpoint: "https://historical-forecast-api.open-meteo.com/v1/forecast",
    link: "https://open-meteo.com/en/docs/historical-forecast-api",
    cadence: "On demand (pnpm haze:history)",
    everyHours: null,
    tracked: true,
  },
  {
    id: "metar",
    name: "Airport visibility",
    provider: "NOAA Aviation Weather Center",
    what: "The weather reports (METARs) of 29 airports in Malaysia, Singapore, Brunei, Sumatra and Kalimantan: prevailing visibility and whether the observer reported haze or smoke.",
    endpoint: "https://aviationweather.gov/api/data/metar?ids=...&format=json",
    link: "https://aviationweather.gov/data/api/",
    cadence: "Every hour, at 20 past",
    everyHours: 1,
    tracked: true,
  },
  {
    id: "nea",
    name: "Singapore readings",
    provider: "National Environment Agency Singapore (data.gov.sg)",
    what: "Singapore's five regions as stations beside DOE's: the 24-hour PSI is their reading, and the measured one-hour PM2.5 goes on the panel.",
    endpoint: "https://api.data.gov.sg/v1/environment/pm25 and /psi",
    link: "https://www.haze.gov.sg/",
    cadence: "Every hour, at 20 past",
    everyHours: 1,
    tracked: true,
  },
  {
    id: "geocoder",
    name: "Place search",
    provider: "Open-Meteo geocoding",
    what: "Turns a place name into coordinates for the search box and the assistant. Asked by the api on each search, not recorded here.",
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
