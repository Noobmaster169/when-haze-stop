import { Vector3, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { VIEWS, type ViewKey } from "./city-views";

/**
 * Moves the camera between views and lets one look about once there. The
 * skyline orbits the towers slowly until it is touched. A standing view keeps
 * the orbit target a metre ahead of the eye, so dragging turns the head
 * instead of flying round the city.
 */

const GLIDE_S = 1.6;
const ORBIT_SPEED = 0.35;

export interface CameraRig {
  go(view: ViewKey): void;
  step(seconds: number): void;
  dispose(): void;
}

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createCameraRig(camera: PerspectiveCamera, element: HTMLElement): CameraRig {
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
  });

  let glide: { from: Vector3; to: Vector3; fromTarget: Vector3; toTarget: Vector3; t: number } | null = null;
  let current: ViewKey | null = null;

  function settle(view: ViewKey): void {
    const { standing } = VIEWS[view];
    controls.enabled = true;
    controls.enableZoom = !standing;
    controls.enablePan = !standing;
    controls.rotateSpeed = standing ? -0.35 : 0.6;
    controls.autoRotate = !standing;
    controls.autoRotateSpeed = ORBIT_SPEED;
    controls.minDistance = standing ? 0.5 : 150;
    controls.maxDistance = standing ? 2 : 6000;
    controls.minPolarAngle = standing ? 0.15 : 0;
    controls.maxPolarAngle = standing ? Math.PI - 0.15 : Math.PI / 2 - 0.04;
  }

  function aim(view: ViewKey): Vector3 {
    const { position, lookAt, standing } = VIEWS[view];
    return standing ? position.clone().add(lookAt.clone().sub(position).normalize()) : lookAt.clone();
  }

  return {
    go(view) {
      if (view === current) return;
      const first = current === null;
      current = view;
      if (first) {
        camera.position.copy(VIEWS[view].position);
        controls.target.copy(aim(view));
        settle(view);
        controls.update();
        return;
      }
      controls.enabled = false;
      controls.autoRotate = false;
      // Limits of the view being left would clamp the glide, so open them for the move.
      controls.minDistance = 0;
      controls.maxDistance = Infinity;
      glide = { from: camera.position.clone(), to: VIEWS[view].position.clone(), fromTarget: controls.target.clone(), toTarget: aim(view), t: 0 };
    },
    step(seconds) {
      if (glide && current) {
        glide.t = Math.min(1, glide.t + seconds / GLIDE_S);
        const share = ease(glide.t);
        camera.position.lerpVectors(glide.from, glide.to, share);
        controls.target.lerpVectors(glide.fromTarget, glide.toTarget, share);
        camera.lookAt(controls.target);
        if (glide.t >= 1) {
          glide = null;
          settle(current);
        }
        return;
      }
      controls.update(seconds);
    },
    dispose() {
      controls.dispose();
    },
  };
}
