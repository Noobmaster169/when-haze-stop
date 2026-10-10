/**
 * The index as a colour and as a word. Pure.
 *
 * The bands are Malaysia's own. The ramp's stops come from the tokens in
 * globals.css, read once by theme.ts, so the legend, the map and the dots can
 * only ever agree.
 */

export type Rgb = [number, number, number];
export interface Stop {
  at: number;
  rgb: Rgb;
}

/** The values the ramp is defined at, which are also the legend's ticks. */
export const STOP_VALUES = [0, 50, 100, 150, 200, 300, 400] as const;

export type BandKey = "good" | "moderate" | "unhealthy" | "very-unhealthy" | "hazardous";

export function bandKey(api: number): BandKey {
  if (api <= 50) return "good";
  if (api <= 100) return "moderate";
  if (api <= 200) return "unhealthy";
  if (api <= 300) return "very-unhealthy";
  return "hazardous";
}

const NAMES: Record<BandKey, string> = {
  good: "Good",
  moderate: "Moderate",
  unhealthy: "Unhealthy",
  "very-unhealthy": "Very unhealthy",
  hazardous: "Hazardous",
};

export function band(api: number): string {
  return NAMES[bandKey(api)];
}

/** DOE's bands as [ug/m3, API], the same table as the backend's `haze/api-index.ts`. */
const PM25_BANDS: readonly (readonly [number, number])[] = [
  [0, 0],
  [12.0, 50],
  [50.4, 100],
  [55.4, 150],
  [150.4, 200],
  [250.4, 300],
  [350.4, 400],
  [500.4, 500],
];

/** The index a PM2.5 concentration would give if it held for 24 hours, which is what a measured value is coloured by. */
export function pm25ToApi(ugm3: number): number {
  if (ugm3 <= 0) return 0;
  for (let index = 1; index < PM25_BANDS.length; index++) {
    const [toUg, toApi] = PM25_BANDS[index];
    if (ugm3 > toUg && index < PM25_BANDS.length - 1) continue;
    const [fromUg, fromApi] = PM25_BANDS[index - 1];
    return fromApi + ((ugm3 - fromUg) * (toApi - fromApi)) / (toUg - fromUg);
  }
  return 0;
}

export function parseHex(hex: string): Rgb {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3 ? [...clean].map((digit) => digit + digit).join("") : clean;
  const value = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(value)) return [128, 128, 128];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** The ramp's colour at a value, blended between the two stops around it. */
export function colourAt(stops: Stop[], api: number): Rgb {
  const value = Math.max(stops[0].at, Math.min(stops[stops.length - 1].at, api));
  for (let index = 1; index < stops.length; index++) {
    const above = stops[index];
    if (value > above.at) continue;
    const below = stops[index - 1];
    const share = (value - below.at) / (above.at - below.at);
    return [0, 1, 2].map((channel) => Math.round(below.rgb[channel] + (above.rgb[channel] - below.rgb[channel]) * share)) as Rgb;
  }
  return stops[stops.length - 1].rgb;
}

export function css(rgb: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})` : `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]} / ${alpha})`;
}

/** The swatch beside a value, in the band's colour token. */
export const BAND_SWATCH: Record<BandKey, string> = {
  good: "bg-api-0",
  moderate: "bg-api-50",
  unhealthy: "bg-api-150",
  "very-unhealthy": "bg-api-200",
  hazardous: "bg-api-300",
};
