import { WEATHER_POINTS } from "../../src/haze/grid";
import type { WeatherGrid } from "../../src/haze/transport";

/**
 * A wind that blows the same way everywhere and never changes.
 *
 * A test vector for the physics, not data: with it, where the smoke must end
 * up can be worked out by hand. It never reaches the database of a running app.
 */
export function steadyWind(start: Date, hours: number, u: number, v: number, rain = 0): WeatherGrid {
  return {
    start,
    hours,
    u: new Float32Array(hours * WEATHER_POINTS).fill(u),
    v: new Float32Array(hours * WEATHER_POINTS).fill(v),
    rain: new Float32Array(hours * WEATHER_POINTS).fill(rain),
  };
}
