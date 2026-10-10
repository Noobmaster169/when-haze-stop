import type { SunPosition } from "./sun";

/**
 * What an hour of air looks like to the scene: how thick the fog, what colour
 * the sky and the haze, how strong and how red the sun. Pure.
 *
 * The fog is the backend's visibility read back as extinction, so a building
 * at the visibility distance keeps 2% of its contrast, as Koschmieder has it.
 * The sun's beam is dimmed per colour by the smoke's optical depth and the
 * air's own Rayleigh scattering along its slant path, which is what turns it
 * orange. What the beam loses mostly becomes diffuse light: peat smoke
 * scatters 97% of what it stops (Eck et al. 2019).
 */

export type Rgb = [number, number, number];

export interface Palette {
  zenith: Rgb;
  horizon: Rgb;
  haze: Rgb;
  night: Rgb;
  /** The city's own light at night: street lamps and windows. */
  glow: Rgb;
}

export interface HazeAir {
  visibilityKm: number;
  aerosolDepth: number;
}

export interface Look {
  /** Extinction per metre, for fog that falls as exp(-density x distance). */
  fogDensity: number;
  fogColour: Rgb;
  skyTop: Rgb;
  sunColour: Rgb;
  sunIntensity: number;
  /** Light from everywhere: the sky by day, the city's own lamps by night. */
  ambientColour: Rgb;
  ambientIntensity: number;
  /** 0 at night, 1 in full day, between through twilight. */
  daylight: number;
  /** The smoke's optical depth, for what draws the smoke itself. */
  smokeDepth: number;
  /** The buildings' own night light, which fades out by day. */
  glowColour: Rgb;
  glowIntensity: number;
}

/** Red, green and blue as wavelengths in micrometres. */
const WAVELENGTHS: Rgb = [0.65, 0.55, 0.45];
/**
 * How the smoke's depth falls with wavelength. Assumed: the large peat
 * particles of the 2015 haze (Eck et al. 2019) put it near 1, and no
 * Malaysian measurement was found.
 */
const ANGSTROM = 1.0;
const KOSCHMIEDER = 3.912;
const SUN_FULL = 3.2;
const AMBIENT_CLEAR = 0.45;
const AMBIENT_FROM_HAZE = 0.6;
/** How much the sunlight's own colour tints the haze it lights. */
const SUN_TINT = 0.35;
/**
 * At night smoke scatters the city's light back down as a warm skyglow, more
 * the thicker it is. How bright, at the most, as a share of the glow colour.
 */
const SKYGLOW = 0.45;
const WINDOW_GLOW = 0.035;
const LAMPLIGHT = 0.35;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a: Rgb, b: Rgb, share: number): Rgb {
  return [0, 1, 2].map((index) => a[index] + (b[index] - a[index]) * share) as Rgb;
}

/** Air mass along the sun's path, Kasten and Young 1989; null below the horizon. */
function airMass(elevation: number): number | null {
  if (elevation <= -0.83) return null;
  const degrees = Math.max(elevation, 0);
  return 1 / (Math.sin((degrees * Math.PI) / 180) + 0.50572 * (degrees + 6.07995) ** -1.6364);
}

function rayleighDepth(micrometres: number): number {
  return 0.0088 * micrometres ** -4.05;
}

function smokeDepth(aerosolDepth: number, micrometres: number): number {
  return aerosolDepth * (micrometres / 0.55) ** -ANGSTROM;
}

/** The share of the sun's direct beam that reaches the ground, per colour. */
export function beamTransmission(aerosolDepth: number, elevation: number): Rgb {
  const mass = airMass(elevation);
  if (mass === null) return [0, 0, 0];
  return WAVELENGTHS.map((micrometres) => Math.exp(-(rayleighDepth(micrometres) + smokeDepth(aerosolDepth, micrometres)) * mass)) as Rgb;
}

export function lookFor(air: HazeAir, sun: SunPosition, palette: Palette): Look {
  const daylight = smoothstep(-8, 6, sun.elevation);
  const beam = beamTransmission(air.aerosolDepth, sun.elevation);
  const brightest = Math.max(...beam, 1e-6);
  const sunColour = beam.map((value) => value / brightest) as Rgb;
  const meanBeam = (beam[0] + beam[1] + beam[2]) / 3;
  const rising = smoothstep(-1, 3, sun.elevation);

  const smoke = air.aerosolDepth;
  const hazeShare = smoke / (smoke + rayleighDepth(0.55));
  const lit = mix(mix(palette.horizon, palette.haze, hazeShare), sunColour, SUN_TINT * (1 - daylight * 0.5) * rising);
  const skyglow = SKYGLOW * Math.min(1, smoke);
  const dark = mix(palette.night, palette.glow, skyglow);
  const fogColour = mix(dark, lit, daylight);
  const skyTop = mix(mix(palette.night, palette.glow, skyglow * 0.4), mix(palette.zenith, lit, Math.sqrt(hazeShare)), daylight);

  // Light the beam loses to the smoke comes back as diffuse sky light, so a hazy noon is flat, not dark.
  const scattered = 1 - Math.exp(-smoke * Math.min(airMass(sun.elevation) ?? 3, 3));
  return {
    fogDensity: KOSCHMIEDER / (Math.max(air.visibilityKm, 0.05) * 1000),
    fogColour,
    skyTop,
    sunColour,
    sunIntensity: SUN_FULL * meanBeam * rising,
    ambientColour: mix(palette.glow, mix(skyTop, fogColour, 0.5), daylight),
    ambientIntensity: daylight * (AMBIENT_CLEAR + AMBIENT_FROM_HAZE * scattered) + (1 - daylight) * LAMPLIGHT,
    daylight,
    smokeDepth: smoke,
    glowColour: palette.glow,
    glowIntensity: WINDOW_GLOW * (1 - daylight),
  };
}
