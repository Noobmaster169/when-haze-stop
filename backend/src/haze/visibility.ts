/**
 * How far one can see through a PM2.5 concentration, and how much of the sun
 * gets through. Pure.
 *
 * The chain: smoke's light extinction is its mass times a mass extinction
 * efficiency, plus the clean air's own; visibility is where a dark object's
 * contrast falls to 2% (Koschmieder, 3.912 / extinction).
 *
 * Every constant is from a measurement of Southeast Asian smoke, but the chain
 * is an estimate, not an observation. In the 2019 haze, MetMalaysia reported
 * visibilities two to five times shorter than it gives at the same API, likely
 * because the API is a 24 hour mean that lags the hour's peak and because
 * humidity adds mist. Treat its answer as the most one could see.
 */

/** Dry scattering per gram of aged biomass smoke, m2/g. Reid et al. 2005, ACP 5:827. */
const SCATTERING_DRY = 4.2;
/** Absorption per gram of smouldering peat smoke, m2/g. Reid et al. 2005. */
const ABSORPTION = 0.3;
/** The power law fitted to Indonesian smoke's growth with humidity, f(80%) = 1.65 (Gras et al. 1999). */
const GROWTH_EXPONENT = 0.31;
/**
 * The humidity assumed for growth. Kuala Lumpur averages about 82% but drops
 * to 55 to 65% by midday; 70% sits between, and the stored weather has no
 * humidity to use instead.
 */
export const ASSUMED_HUMIDITY = 0.7;
/** Clean dry air at 550 nm, per km: the 296 km limit of visibility in Lee et al. 2017, ACP 17:965. */
const RAYLEIGH_PER_KM = 0.0132;
/** Contrast threshold of 2%: ln(1 / 0.02). */
const KOSCHMIEDER = 3.912;
/** The smoke layer's depth, km: two thirds of Singapore's haze extinction lies below 1.5 km (Chew et al. 2013). */
const LAYER_KM = 1.25;

/** Light lost per gram of smoke at the assumed humidity, m2/g. */
export function massExtinction(humidity = ASSUMED_HUMIDITY): number {
  const growth = (1 - Math.min(humidity, 0.95)) ** -GROWTH_EXPONENT;
  return SCATTERING_DRY * growth + ABSORPTION;
}

/** Extinction per km for a PM2.5 concentration in ug/m3. ug/m3 times m2/g is 1e-6 per metre, so 1e-3 per km. */
export function extinctionPerKm(pm25: number): number {
  return massExtinction() * Math.max(0, pm25) * 1e-3 + RAYLEIGH_PER_KM;
}

export function visibilityKm(pm25: number): number {
  return KOSCHMIEDER / extinctionPerKm(pm25);
}

/** The smoke's optical depth straight up, as if it filled the layer evenly. The sun's light falls as exp(-depth / cos zenith). */
export function aerosolDepth(pm25: number): number {
  return (extinctionPerKm(pm25) - RAYLEIGH_PER_KM) * LAYER_KM;
}
