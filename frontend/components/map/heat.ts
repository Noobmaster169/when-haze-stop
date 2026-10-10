import { bracket, API_PER_BYTE } from "./field";
import type { MapData } from "./map-data";
import { colourAt, type Stop } from "./scale";

/**
 * The haze field as an image: one pixel a cell, which the canvas then scales
 * up smoothly. Only haze is drawn. Good air (the official band, 50 and under)
 * is left clear so the map shows where the haze is and nothing else; the
 * colour fades in through Moderate and is full from Unhealthy (above 100).
 */

const CLEAR_TO = 50;
const FULL_FROM = 100;
const FULL_ALPHA = 0.64;

export interface Heat {
  canvas: HTMLCanvasElement;
  paint(data: MapData, at: number): void;
}

export function createHeat(stops: Stop[]): Heat {
  const canvas = document.createElement("canvas");
  /** Every value a byte can hold, coloured once. */
  const table = new Uint8ClampedArray(256 * 4);
  for (let byte = 0; byte < 256; byte++) {
    const api = byte * API_PER_BYTE;
    const [red, green, blue] = colourAt(stops, api);
    const alpha = FULL_ALPHA * Math.min(1, Math.max(0, (api - CLEAR_TO) / (FULL_FROM - CLEAR_TO)));
    table.set([red, green, blue, Math.round(alpha * 255)], byte * 4);
  }

  return {
    canvas,
    paint(data, at) {
      const { nx, ny } = data.grid;
      if (canvas.width !== nx || canvas.height !== ny) {
        canvas.width = nx;
        canvas.height = ny;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      const image = context.createImageData(nx, ny);
      const { from, to, share } = bracket(data.times, at);
      const before = data.fields[from];
      const after = data.fields[to];
      for (let row = 0; row < ny; row++) {
        // The field's first row is the south; an image's first row is the top.
        const source = (ny - 1 - row) * nx;
        for (let column = 0; column < nx; column++) {
          const byte = Math.round(before[source + column] * (1 - share) + after[source + column] * share);
          const pixel = (row * nx + column) * 4;
          image.data[pixel] = table[byte * 4];
          image.data[pixel + 1] = table[byte * 4 + 1];
          image.data[pixel + 2] = table[byte * 4 + 2];
          image.data[pixel + 3] = table[byte * 4 + 3];
        }
      }
      context.putImageData(image, 0, 0);
    },
  };
}
