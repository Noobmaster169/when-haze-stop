import { REGION, type Size, toLat, toLon, toX, toY, type View } from "./geo";
import { type MapData, windAt } from "./map-data";
import { css, type Rgb } from "./scale";

/**
 * The wind, drawn as short trails that drift the way the smoke is carried.
 *
 * Each trail is a point moved a little every frame by the wind under it; the
 * canvas is faded a little every frame too, which is what leaves the tail.
 */

interface Particle {
  lon: number;
  lat: number;
  age: number;
}

const MAX_AGE = 110;
const MAX_PARTICLES = 1100;
/** Degrees moved a frame for each metre a second: fast enough to read, slow enough to follow. */
const DRIFT = 0.0028;

export interface WindLayer {
  reset(view: View, size: Size): void;
  step(context: CanvasRenderingContext2D, view: View, size: Size, data: MapData, at: number): void;
}

export function createWind(colour: Rgb): WindLayer {
  let particles: Particle[] = [];

  function place(particle: Particle, view: View, size: Size): void {
    const west = Math.max(REGION.lon0, toLon(view, size, 0));
    const east = Math.min(REGION.lon1, toLon(view, size, size.width));
    const south = Math.max(REGION.lat0, toLat(view, size, size.height));
    const north = Math.min(REGION.lat1, toLat(view, size, 0));
    particle.lon = west + Math.random() * (east - west);
    particle.lat = south + Math.random() * (north - south);
    particle.age = Math.floor(Math.random() * MAX_AGE);
  }

  return {
    reset(view, size) {
      const count = Math.round(Math.min(MAX_PARTICLES, (size.width * size.height) / 1100));
      particles = Array.from({ length: count }, () => {
        const particle = { lon: 0, lat: 0, age: 0 };
        place(particle, view, size);
        return particle;
      });
    },

    step(context, view, size, data, at) {
      context.globalCompositeOperation = "destination-in";
      context.fillStyle = "rgb(0 0 0 / 0.92)";
      context.fillRect(0, 0, size.width, size.height);
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = css(colour, 0.42);
      context.lineWidth = 1;
      context.beginPath();
      // Zoomed in, a degree is more pixels, so the same wind would race.
      const pace = DRIFT * Math.min(1, 60 / view.scale);
      for (const particle of particles) {
        const inside = particle.lon >= REGION.lon0 && particle.lon <= REGION.lon1 && particle.lat >= REGION.lat0 && particle.lat <= REGION.lat1;
        if (!inside || particle.age > MAX_AGE) {
          place(particle, view, size);
          particle.age = 0;
          continue;
        }
        const [u, v] = windAt(data, at, particle.lon, particle.lat);
        const x = toX(view, size, particle.lon);
        const y = toY(view, size, particle.lat);
        particle.lon += u * pace;
        particle.lat += v * pace;
        particle.age++;
        context.moveTo(x, y);
        context.lineTo(toX(view, size, particle.lon), toY(view, size, particle.lat));
      }
      context.stroke();
    },
  };
}
