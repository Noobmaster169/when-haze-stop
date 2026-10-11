import { FIELD_CELLS } from "./grid";
import { seeded } from "./rng";
import { CENTRAL, type Emission, simulate, type TransportParams, type Weather } from "./transport";

/**
 * The model run several times with its uncertain settings varied, averaged.
 *
 * No setting here was tuned to readings: a week of DOE data moved the fit only
 * between 0.73 and 0.79 across the whole of these ranges, so the average of
 * the range is steadier than any one guess inside it.
 */

export const MEMBERS = 10;

/** Member 0 is the central guess; the rest are drawn from the ranges, the same ones every run. */
export function memberParams(member: number): TransportParams {
  if (member === 0) return CENTRAL;
  const random = seeded(member * 2654435761);
  return {
    speed: 0.85 + 0.3 * random.next(),
    veerDeg: 10 * random.gauss(),
    diffusivity: CENTRAL.diffusivity * Math.exp(0.5 * random.gauss()),
    decayHours: 48 + 72 * random.next(),
    scavenging: CENTRAL.scavenging * Math.exp(0.5 * random.gauss()),
    particles: CENTRAL.particles,
  };
}

/** The mean smoke mass per cell per hour over the members. */
export function ensembleMean(emissions: Emission[], weather: Weather, members = MEMBERS): Float32Array {
  const mean = new Float32Array(weather.hours * FIELD_CELLS);
  for (let member = 0; member < members; member++) {
    const mass = simulate(emissions, weather, memberParams(member), 5000 + member);
    for (let index = 0; index < mean.length; index++) mean[index] += mass[index] / members;
  }
  return mean;
}
