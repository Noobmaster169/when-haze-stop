import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from "three";

import type { CityData } from "./city-data";
import { buildSolids, buildSurfaces } from "./city-geometry";
import type { CityTheme } from "./city-theme";
import { createCameraRig } from "./camera-rig";
import type { ViewKey } from "./city-views";
import { createSky, withHazeFog } from "./haze-fog";
import type { Look } from "./haze-look";
import { createMotes } from "./haze-motes";
import type { SunPosition } from "./sun";

/**
 * The city as a live three.js scene on one canvas: the baked buildings on a
 * ground plane, lit by the hour's sun and sky and seen through its haze. The
 * page drives it with setLook and setView and never touches three.js itself.
 */

export interface CityScene {
  setLook(look: Look, sun: SunPosition): void;
  setView(view: ViewKey): void;
  dispose(): void;
}

/** Wide enough that its edge is beyond what haze lets one see, and the far plane past it. */
const GROUND_M = 60_000;
const SKY_M = 25_000;
const FAR_M = 40_000;
/** How far the sun light sits from the scene, and the half-width its shadows cover. */
const SUN_M = 4_000;
const SHADOW_M = 1_800;

const srgb = (rgb: [number, number, number]): Color => new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

export function createCityScene(canvas: HTMLCanvasElement, data: CityData, theme: CityTheme): CityScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.fog = new FogExp2(0xffffff, 0);
  const camera = new PerspectiveCamera(50, 1, 0.5, FAR_M);

  const sky = createSky(SKY_M);
  scene.add(sky.mesh);

  const groundGeometry = new PlaneGeometry(GROUND_M, GROUND_M).rotateX(-Math.PI / 2);
  const groundMaterial = withHazeFog(new MeshStandardMaterial({ color: new Color(...theme.ground), roughness: 1 }));
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.receiveShadow = true;

  const solidsMaterial = withHazeFog(new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 }));
  const solids = new Mesh(buildSolids(data, theme.colours), solidsMaterial);
  solids.castShadow = true;
  solids.receiveShadow = true;

  const surfacesMaterial = withHazeFog(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  const surfaces = new Mesh(buildSurfaces(data, theme.colours), surfacesMaterial);
  surfaces.receiveShadow = true;

  const sun = new DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -SHADOW_M, right: SHADOW_M, top: SHADOW_M, bottom: -SHADOW_M, near: 10, far: SUN_M * 2 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  const skyLight = new HemisphereLight(0xffffff, new Color(...theme.ground), 0.5);

  const motes = createMotes();
  scene.add(ground, solids, surfaces, sun, sun.target, skyLight, motes.points);

  const rig = createCameraRig(camera, canvas);

  const resize = (): void => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const { clientWidth: width, clientHeight: height } = parent;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);
  resize();

  const timer = new Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const seconds = Math.min(timer.getDelta(), 0.1);
    rig.step(seconds);
    motes.step(seconds);
    sky.mesh.position.copy(camera.position);
    renderer.render(scene, camera);
  });

  return {
    setLook(look, position) {
      const fog = srgb(look.fogColour);
      const fogFx = scene.fog as FogExp2;
      fogFx.color.copy(fog);
      fogFx.density = look.fogDensity;
      sky.set(srgb(look.skyTop), fog);
      motes.set(look.smokeDepth, fog);

      const elevation = (position.elevation * Math.PI) / 180;
      const azimuth = (position.azimuth * Math.PI) / 180;
      sun.position.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(SUN_M);
      sun.color.copy(srgb(look.sunColour));
      sun.intensity = look.sunIntensity;
      sun.castShadow = look.sunIntensity > 0.02;
      skyLight.color.copy(srgb(look.ambientColour));
      skyLight.intensity = look.ambientIntensity;
      solidsMaterial.emissive.copy(srgb(look.glowColour));
      solidsMaterial.emissiveIntensity = look.glowIntensity;
    },
    setView(view) {
      rig.go(view);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      rig.dispose();
      for (const mesh of [ground, solids, surfaces]) mesh.geometry.dispose();
      for (const material of [groundMaterial, solidsMaterial, surfacesMaterial]) material.dispose();
      sky.dispose();
      motes.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
    },
  };
}
