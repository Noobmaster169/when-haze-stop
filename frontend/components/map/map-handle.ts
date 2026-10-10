import type { Station } from "@/lib/api/haze-schemas";

/** What the map canvas offers the page around it: the layers it can show, what a tap picks, and how the page can move it. */

export interface Layers {
  haze: boolean;
  stations: boolean;
  fires: boolean;
  wind: boolean;
}

export interface MapHandle {
  zoom(factor: number): void;
  /** Glides to a place, centred in the part of the map a floating panel leaves uncovered. */
  flyTo(lon: number, lat: number): void;
  /** Slides the map just enough that a point is not under the panel. */
  reveal(lon: number, lat: number): void;
  /** Where a point is on the canvas now, for anything laid over the map. */
  locate(lon: number, lat: number): { x: number; y: number } | null;
}

export interface Pick {
  lon: number;
  lat: number;
  station: Station | null;
}
