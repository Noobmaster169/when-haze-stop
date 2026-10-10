/** The world outside: each data source behind one interface, with its fake in `__fakes__/`. */
export { type DoeClient, doeClient, type DoeReading, type DoeStation } from "./doe";
export { type FiresClient, firmsClient } from "./firms";
export { type FoundPlace, type Geocoder, openMeteoGeocoder } from "./geocoder";
export { openMeteoClient, type WeatherClient } from "./weather";
