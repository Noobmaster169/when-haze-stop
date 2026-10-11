import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, type Material } from "three";

/**
 * The haze as the eye meets it: fog that thins light as exp(-extinction x
 * distance), and a sky that fades from its zenith into the same haze at the
 * horizon, so far towers sink into the sky rather than into a wall.
 *
 * three.js's own FogExp2 squares the distance, which is right for nothing
 * physical. Each material keeps three's fog uniforms and swaps the formula.
 */

const BEER_LAMBERT = /* glsl */ `
#ifdef USE_FOG
  float fogFactor = 1.0 - exp( - fogDensity * vFogDepth );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;

export function withHazeFog<T extends Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <fog_fragment>", BEER_LAMBERT);
  };
  return material;
}

export interface Sky {
  mesh: Mesh;
  set(top: Color, horizon: Color): void;
  dispose(): void;
}

export function createSky(radius: number): Sky {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new Color() }, horizon: { value: new Color() } },
    vertexShader: /* glsl */ `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying float vHeight;
      void main() {
        gl_FragColor = vec4(mix(horizon, top, pow(clamp(vHeight, 0.0, 1.0), 0.85)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new SphereGeometry(radius, 32, 16);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    set(top, horizon) {
      material.uniforms.top.value.copy(top);
      material.uniforms.horizon.value.copy(horizon);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
