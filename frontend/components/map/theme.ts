import { parseHex, type Rgb, type Stop, STOP_VALUES } from "./scale";

/**
 * The map's colours, read from the tokens in globals.css. A canvas cannot use
 * a class name, so this is where the tokens cross into drawing code, once.
 */
export interface MapTheme {
  sea: string;
  land: string;
  coast: string;
  border: string;
  label: string;
  halo: string;
  wind: Rgb;
  fire: string;
  fireCore: string;
  ink: string;
  stops: Stop[];
}

export function readTheme(element: Element): MapTheme {
  const style = getComputedStyle(element);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    sea: token("--map-sea"),
    land: token("--map-land"),
    coast: token("--map-coast"),
    border: token("--map-border"),
    label: token("--map-label"),
    halo: token("--canvas"),
    wind: parseHex(token("--map-wind")),
    fire: token("--map-fire"),
    fireCore: token("--map-fire-core"),
    ink: token("--ink"),
    stops: STOP_VALUES.map((at) => ({ at, rgb: parseHex(token(`--api-${at}`)) })),
  };
}
