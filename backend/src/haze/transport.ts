import { DOMAIN, FIELD, FIELD_CELLS, WEATHER } from "./grid";
import { seeded } from "./rng";

/**
 * Where the smoke goes: a Lagrangian particle model.
 *
 * Each fire releases particles through its day. Every hour a particle is
 * carried by the wind where it is, nudged at random to stand in for
 * turbulence, and loses mass to time and to rain. What a cell holds at an hour
 * is the mass of the particles in it. The output is in arbitrary units;
 * `calibrate.ts` is what ties it to a reading.
 */

/** One hour's wind and rain over the weather grid, hour-major: `[hour * points + point]`. */
export interface Weather {
  hours: number;
  u: Float32Array;
  v: Float32Array;
  rain: Float32Array;
}

/** Weather with a clock on it: the instant of hour 0. */
export interface WeatherGrid extends Weather {
  start: Date;
}

/** A fire cell burning through one day, in hours from the start of the run. */
export interface Emission {
  startHour: number;
  lat: number;
  lon: number;
  frpMw: number;
}

export interface TransportParams {
  /** Multiplies the wind. One for a wind already at smoke height. */
  speed: number;
  /** Turns the wind clockwise, in degrees. */
  veerDeg: number;
  /** Horizontal turbulent diffusivity, m2/s. */
  diffusivity: number;
  /** E-folding time of the smoke, hours. */
  decayHours: number;
  /** Rain removal: mass is multiplied by exp(-scavenging * rain^0.8) each hour. */
  scavenging: number;
  /** Particles released per fire cell per day. */
  particles: number;
}

export const CENTRAL: TransportParams = { speed: 1, veerDeg: 0, diffusivity: 5000, decayHours: 72, scavenging: 0.36, particles: 6 };

const MAX_AGE_HOURS = 144;
const METRES_PER_DEGREE = 111_195;
/** A particle this depleted no longer shows on any map. */
const SPENT = 1e-4;

/** Smoke mass per field cell per hour, hour-major. */
export function simulate(emissions: Emission[], weather: Weather, params: TransportParams, seed: number): Float32Array {
  const random = seeded(seed);
  const { nx, ny } = WEATHER;
  const points = nx * ny;
  const mass = new Float32Array(weather.hours * FIELD_CELLS);
  const veer = (params.veerDeg * Math.PI) / 180;
  const cos = Math.cos(veer);
  const sin = Math.sin(veer);
  const jitter = Math.sqrt(2 * params.diffusivity * 3600);
  const keep = Math.exp(-1 / params.decayHours);

  for (const fire of emissions) {
    const released = fire.frpMw / params.particles;
    for (let n = 0; n < params.particles; n++) {
      let lat = fire.lat + random.next() * 0.1;
      let lon = fire.lon + random.next() * 0.1;
      let carried = released;
      let hour = fire.startHour + Math.floor(random.next() * 24);
      for (let age = 0; age < MAX_AGE_HOURS && hour < weather.hours; age++, hour++) {
        // A fire day that began before the run has hours with no weather to move it.
        if (hour < 0) continue;
        const x = (lon - DOMAIN.lon0) / WEATHER.step;
        const y = (lat - DOMAIN.lat0) / WEATHER.step;
        if (x < 0 || x >= nx - 1 || y < 0 || y >= ny - 1) break;
        const i = Math.floor(x);
        const j = Math.floor(y);
        const ax = x - i;
        const ay = y - j;
        const at = hour * points + j * nx + i;
        const w00 = (1 - ax) * (1 - ay);
        const w10 = ax * (1 - ay);
        const w01 = (1 - ax) * ay;
        const w11 = ax * ay;
        const blend = (field: Float32Array): number => field[at] * w00 + field[at + 1] * w10 + field[at + nx] * w01 + field[at + nx + 1] * w11;
        const u = blend(weather.u);
        const v = blend(weather.v);
        const rain = blend(weather.rain);

        const column = Math.floor((lon - DOMAIN.lon0) / FIELD.step);
        const row = Math.floor((lat - DOMAIN.lat0) / FIELD.step);
        mass[hour * FIELD_CELLS + row * FIELD.nx + column] += carried;

        const east = (u * cos + v * sin) * params.speed * 3600 + jitter * random.gauss();
        const north = (-u * sin + v * cos) * params.speed * 3600 + jitter * random.gauss();
        lat += north / METRES_PER_DEGREE;
        lon += east / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
        carried *= keep;
        if (rain > 0) carried *= Math.exp(-params.scavenging * Math.pow(rain, 0.8));
        if (carried < released * SPENT) break;
      }
    }
  }
  return mass;
}
