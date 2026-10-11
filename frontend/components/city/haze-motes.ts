import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Points, PointsMaterial } from "three";

import { withHazeFog } from "./haze-fog";

/**
 * Soft sheets of smoke drifting through the city, so the haze is seen to move
 * rather than sit as a tint. How opaque they are follows the hour's smoke
 * depth; where they drift is for the eye only and is not the wind.
 */

const COUNT = 2400;
const SPAN = 5200;
const LOW = 20;
const HIGH = 900;
/** Metres a second, quickened so a drift is visible in the time one watches. */
const DRIFT = { x: 9, z: -5 };
/** The smoke depth at which the sheets are as thick as they get. */
const FULL_DEPTH = 2;
const MOST = 0.32;

function puff(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

export interface Motes {
  points: Points;
  /** Opacity from the smoke depth, colour from the haze. */
  set(aerosolDepth: number, colour: Color): void;
  step(seconds: number): void;
  dispose(): void;
}

export function createMotes(): Motes {
  const positions = new Float32Array(COUNT * 3);
  for (let index = 0; index < COUNT; index++) {
    positions[index * 3] = (Math.random() - 0.5) * SPAN;
    positions[index * 3 + 1] = LOW + Math.random() ** 2 * (HIGH - LOW);
    positions[index * 3 + 2] = (Math.random() - 0.5) * SPAN;
  }
  const geometry = new BufferGeometry();
  const attribute = new Float32BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);
  const texture = puff();
  const material = withHazeFog(new PointsMaterial({ map: texture, size: 140, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0 }));
  const points = new Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    set(aerosolDepth, colour) {
      material.opacity = MOST * Math.min(1, aerosolDepth / FULL_DEPTH);
      material.color.copy(colour);
      points.visible = material.opacity > 0.005;
    },
    step(seconds) {
      const half = SPAN / 2;
      for (let index = 0; index < COUNT; index++) {
        let x = positions[index * 3] + DRIFT.x * seconds;
        let z = positions[index * 3 + 2] + DRIFT.z * seconds;
        if (x > half) x -= SPAN;
        if (z < -half) z += SPAN;
        positions[index * 3] = x;
        positions[index * 3 + 2] = z;
      }
      attribute.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
