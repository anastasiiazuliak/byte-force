import * as THREE from 'three';
import type { EphemerisSample, IsoUtc } from '../../../api/types';

export interface InterpolatedCelestialPositions {
  sunDirection: [number, number, number];
  earthDirection: [number, number, number];
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  earthElevationDeg: number;
  earthAzimuthDeg: number;
  isInterpolated: boolean;
}

/**
 * Spherical linear interpolation between two 3D vectors.
 */
export function slerpUnitVectors(
  v0: [number, number, number],
  v1: [number, number, number],
  t: number
): [number, number, number] {
  const vec0 = new THREE.Vector3(...v0).normalize();
  const vec1 = new THREE.Vector3(...v1).normalize();

  const dot = THREE.MathUtils.clamp(vec0.dot(vec1), -1.0, 1.0);

  // If vectors are very close, use simple normalized linear interpolation
  if (dot > 0.9995) {
    const res = vec0.clone().lerp(vec1, t).normalize();
    return [res.x, res.y, res.z];
  }

  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);

  const w0 = Math.sin((1 - t) * theta) / sinTheta;
  const w1 = Math.sin(t * theta) / sinTheta;

  const res = vec0.multiplyScalar(w0).add(vec1.multiplyScalar(w1)).normalize();
  return [res.x, res.y, res.z];
}

/**
 * Calculates horizontal coordinates (elevation and azimuth in degrees)
 * from a Moon-fixed direction vector at the Lunar South Pole.
 */
export function vectorToPolarHorizontal(vector: [number, number, number]): {
  elevationDeg: number;
  azimuthDeg: number;
} {
  const [x, y, z] = vector;

  // At South Pole, local Up/Zenith is -Z_moon
  // Horizontal plane is spanned by X_moon (0° lon meridian) and Y_moon (90°E meridian)
  const rho = Math.hypot(x, y);
  const elevationRad = Math.atan2(-z, rho);
  const azimuthRad = Math.atan2(y, x);

  const elevationDeg = elevationRad * (180 / Math.PI);
  let azimuthDeg = azimuthRad * (180 / Math.PI);
  if (azimuthDeg < 0) azimuthDeg += 360;

  return { elevationDeg, azimuthDeg };
}

/**
 * Interpolates solar and earth vectors for an arbitrary UTC time
 * without triggering any network requests.
 */
export function interpolateEphemeris(
  samples: EphemerisSample[],
  targetTimeUtc: IsoUtc
): InterpolatedCelestialPositions | null {
  if (!samples || samples.length === 0) return null;

  const targetTimeMs = new Date(targetTimeUtc).getTime();
  if (isNaN(targetTimeMs)) return null;

  // Exact or single sample match
  if (samples.length === 1) {
    const s = samples[0];
    const sunHoriz = vectorToPolarHorizontal(s.sunDirection);
    const earthHoriz = vectorToPolarHorizontal(s.earthDirection);
    return {
      sunDirection: s.sunDirection,
      earthDirection: s.earthDirection,
      sunElevationDeg: sunHoriz.elevationDeg,
      sunAzimuthDeg: sunHoriz.azimuthDeg,
      earthElevationDeg: earthHoriz.elevationDeg,
      earthAzimuthDeg: earthHoriz.azimuthDeg,
      isInterpolated: false,
    };
  }

  // Find surrounding samples for time scrub
  let prevSample = samples[0];
  let nextSample = samples[samples.length - 1];

  const firstMs = new Date(samples[0].timeUtc).getTime();
  const lastMs = new Date(samples[samples.length - 1].timeUtc).getTime();

  if (targetTimeMs <= firstMs) {
    const s = samples[0];
    const sunHoriz = vectorToPolarHorizontal(s.sunDirection);
    const earthHoriz = vectorToPolarHorizontal(s.earthDirection);
    return {
      sunDirection: s.sunDirection,
      earthDirection: s.earthDirection,
      sunElevationDeg: sunHoriz.elevationDeg,
      sunAzimuthDeg: sunHoriz.azimuthDeg,
      earthElevationDeg: earthHoriz.elevationDeg,
      earthAzimuthDeg: earthHoriz.azimuthDeg,
      isInterpolated: false,
    };
  }

  if (targetTimeMs >= lastMs) {
    const s = samples[samples.length - 1];
    const sunHoriz = vectorToPolarHorizontal(s.sunDirection);
    const earthHoriz = vectorToPolarHorizontal(s.earthDirection);
    return {
      sunDirection: s.sunDirection,
      earthDirection: s.earthDirection,
      sunElevationDeg: sunHoriz.elevationDeg,
      sunAzimuthDeg: sunHoriz.azimuthDeg,
      earthElevationDeg: earthHoriz.elevationDeg,
      earthAzimuthDeg: earthHoriz.azimuthDeg,
      isInterpolated: false,
    };
  }

  for (let i = 0; i < samples.length - 1; i++) {
    const t0 = new Date(samples[i].timeUtc).getTime();
    const t1 = new Date(samples[i + 1].timeUtc).getTime();
    if (targetTimeMs >= t0 && targetTimeMs <= t1) {
      prevSample = samples[i];
      nextSample = samples[i + 1];
      const alpha = (targetTimeMs - t0) / (t1 - t0);

      const interpSun = slerpUnitVectors(prevSample.sunDirection, nextSample.sunDirection, alpha);
      const interpEarth = slerpUnitVectors(prevSample.earthDirection, nextSample.earthDirection, alpha);

      const sunHoriz = vectorToPolarHorizontal(interpSun);
      const earthHoriz = vectorToPolarHorizontal(interpEarth);

      return {
        sunDirection: interpSun,
        earthDirection: interpEarth,
        sunElevationDeg: sunHoriz.elevationDeg,
        sunAzimuthDeg: sunHoriz.azimuthDeg,
        earthElevationDeg: earthHoriz.elevationDeg,
        earthAzimuthDeg: earthHoriz.azimuthDeg,
        isInterpolated: true,
      };
    }
  }

  return null;
}
