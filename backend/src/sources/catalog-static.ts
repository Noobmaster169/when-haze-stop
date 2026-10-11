/** The sources nothing fetches on a schedule: bundled once, or asked only when a person searches. They have no fetch history. */

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

export const STATIC_SOURCES: readonly SourceEntry[] = [
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
