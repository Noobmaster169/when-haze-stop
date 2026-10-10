/** The world outside: each data source behind one interface, with its fake in `__fakes__/`. */
export { type DoeClient, doeClient, type DoeReading, type DoeStation } from "./doe";
export { type FiresClient, firmsClient } from "./firms";
export { type ArchiveSpan, type FireArchiveClient, firmsArchiveClient, type LabelledSource, type Satellite } from "./firms-archive";
export { AIRPORTS, FAR_M, type MetarClient, metarClient, type MetarReport } from "./metar";
export { NEA_REGIONS, NEA_STATIONS, type NeaClient, neaClient, type NeaHour, type NeaRegion, neaRegionOf } from "./nea";
export { type FoundPlace, type Geocoder, openMeteoGeocoder } from "./geocoder";
export { openMeteoClient, type WeatherClient } from "./weather";
