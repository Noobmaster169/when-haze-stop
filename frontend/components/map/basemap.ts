import { z } from "zod";

/**
 * Coastlines, borders and town names, from Natural Earth (public domain),
 * packed into public/basemap.json: every line is its first point in
 * hundredths of a degree, then steps from each point to the next.
 */

const Line = z.array(z.number().int());
const Packed = z.object({
  land: z.array(z.array(Line)),
  borders: z.array(Line),
  places: z.array(z.object({ n: z.string(), x: z.number(), y: z.number(), r: z.number(), c: z.string() })),
});

export interface MapPlace {
  name: string;
  lon: number;
  lat: number;
  /** Natural Earth's rank: 0 is a capital-sized city, 8 a small town. */
  rank: number;
  country: string;
}

export interface Basemap {
  /** Each landmass as its rings, each ring as lon, lat, lon, lat. */
  land: Float32Array[][];
  borders: Float32Array[];
  places: MapPlace[];
}

function unpack(steps: number[]): Float32Array {
  const line = new Float32Array(steps.length);
  let lon = 0;
  let lat = 0;
  for (let index = 0; index < steps.length; index += 2) {
    lon += steps[index];
    lat += steps[index + 1];
    line[index] = lon / 100;
    line[index + 1] = lat / 100;
  }
  return line;
}

export async function loadBasemap(url: string): Promise<Basemap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The basemap did not load: ${response.status}`);
  const packed = Packed.parse(await response.json());
  return {
    land: packed.land.map((rings) => rings.map(unpack)),
    borders: packed.borders.map(unpack),
    places: packed.places.map((place) => ({ name: place.n, lon: place.x, lat: place.y, rank: place.r, country: place.c })),
  };
}
