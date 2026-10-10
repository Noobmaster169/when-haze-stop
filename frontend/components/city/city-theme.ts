import { Color, SRGBColorSpace } from "three";

import type { CityColours } from "./city-geometry";
import type { Palette, Rgb } from "./haze-look";
import type { Linear } from "./mesh-builder";

/**
 * The 3D city's colours, read from the tokens in globals.css. WebGL cannot
 * use a class name, so this is where the tokens cross into the scene, once.
 * The sky's are kept in sRGB, where haze-look mixes them; the materials'
 * are linear, as three.js lights them.
 */
export interface CityTheme {
  palette: Palette;
  ground: Linear;
  colours: CityColours;
}

export function readCityTheme(element: Element): CityTheme {
  const style = getComputedStyle(element);
  const color = (name: string): Color => new Color(style.getPropertyValue(name).trim() || "#808080");
  const srgb = (name: string): Rgb => {
    const { r, g, b } = color(name).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
    return [r, g, b];
  };
  const linear = (name: string): Linear => {
    const { r, g, b } = color(name);
    return [r, g, b];
  };
  return {
    palette: { zenith: srgb("--city-zenith"), horizon: srgb("--city-horizon"), haze: srgb("--city-haze"), night: srgb("--city-night"), glow: srgb("--city-glow") },
    ground: linear("--city-ground"),
    colours: {
      building: linear("--city-building"),
      glass: linear("--city-glass"),
      park: linear("--city-park"),
      water: linear("--city-water"),
      road: linear("--city-road"),
      tower: linear("--city-tower"),
    },
  };
}
