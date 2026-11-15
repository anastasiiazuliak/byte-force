import { Vector3, type MeshStandardMaterial } from 'three';
import { MOON_RADIUS_METERS } from './projection';

export const ACTIVE_LATITUDE = -80;
export const FADE_LATITUDE = -75;
export const INACTIVE_BRIGHTNESS = 0.2;
export const GLOBE_CENTER: [number, number, number] = [0, -MOON_RADIUS_METERS, 0];
// The visual shell sits beneath the reviewed relief so the cap can be rendered and picked directly.
export const GLOBE_SHELL_RADIUS = MOON_RADIUS_METERS - 12_000;
export const GLOBE_MIN_DISTANCE = MOON_RADIUS_METERS + 35_000;
export const GLOBE_MAX_POLAR_ANGLE = Math.PI / 10;

export function globeFitDistance(fov: number, aspect: number) {
  const vertical = fov * Math.PI / 360;
  const limiting = Math.min(vertical, Math.atan(Math.tan(vertical) * Math.max(0.01, aspect)));
  return MOON_RADIUS_METERS / Math.sin(limiting) * 1.08;
}

export function globeOverviewPosition(distance: number): Vector3 {
  // The small tilt keeps the orbit camera's up direction stable at the pole.
  return new Vector3(0, 1, 0.001).normalize().multiplyScalar(distance).add(new Vector3(...GLOBE_CENTER));
}

export function globeCloseupPosition(point: { x: number; y: number; z: number }): Vector3 {
  const center = new Vector3(...GLOBE_CENTER);
  const direction = new Vector3(point.x, point.y, point.z).sub(center);
  const distance = Math.max(GLOBE_MIN_DISTANCE, direction.length() + 65_000);
  direction.normalize();
  if (Math.hypot(direction.x, direction.z) < 0.001) direction.set(0, 1, 0.001).normalize();
  return direction.multiplyScalar(distance).add(center);
}

export function polarGlobeMaterial(this: MeshStandardMaterial, shader: Parameters<MeshStandardMaterial['onBeforeCompile']>[0]) {
  // MOON_ME-compatible scene axes are east at +X, south at +Y and longitude 0 at −Z.
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 lunarRadial;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      lunarRadial = (modelMatrix * vec4(transformed, 1.0)).xyz + vec3(0.0, ${MOON_RADIUS_METERS.toFixed(1)}, 0.0);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 lunarRadial;')
    .replace('#include <map_fragment>', `
      vec3 radial = normalize(lunarRadial);
      float latitude = -asin(clamp(radial.y, -1.0, 1.0));
      #ifdef USE_MAP
        float u = 0.5 + atan(radial.x, -radial.z) / (2.0 * PI);
        float v = 0.5 + latitude / PI;
        // Wrap the UV derivatives at the antimeridian to avoid a blurred seam.
        vec2 du = dFdx(vec2(u, v));
        vec2 dv = dFdy(vec2(u, v));
        du.x -= floor(du.x + 0.5);
        dv.x -= floor(dv.x + 0.5);
        diffuseColor *= textureGrad(map, vec2(u, v), du, dv);
      #endif
    `)
    .replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
      float inactive = smoothstep(radians(${ACTIVE_LATITUDE.toFixed(1)}), radians(${FADE_LATITUDE.toFixed(1)}), latitude);
      gl_FragColor.rgb *= mix(1.0, ${INACTIVE_BRIGHTNESS.toFixed(2)}, inactive);`);
}
