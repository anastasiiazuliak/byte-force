import type { AnalysisResponse, BodyPosition, MapMetadataResponse } from '../../../api/types';
import { terrainAssetKey } from './metadata';
import { MOON_RADIUS_METERS } from './projection';
import { isGlobe, sphericalForward } from './spherical';

export interface SkyDirections {
  origin: [number, number, number];
  sun: [number, number, number];
  earth: [number, number, number];
  timeUtc: string;
  slot: 'A' | 'B';
}

/** Display-only distance and radii, not physical body distances or sizes. */
export const SKY_MARKER_DISPLAY_DISTANCE = 8 * MOON_RADIUS_METERS;
export const SUN_MARKER_WORLD_RADIUS = 0.12 * MOON_RADIUS_METERS;
export const EARTH_MARKER_WORLD_RADIUS = 0.15 * MOON_RADIUS_METERS;

export function skyBodyPosition(origin: SkyDirections['origin'], direction: SkyDirections['sun']): [number, number, number] {
  return origin.map((value, i) => value + direction[i] * SKY_MARKER_DISPLAY_DISTANCE) as [number, number, number];
}

/** Exact cached Analyze sample only: no interpolation, fallback ephemeris or HTTP. */
export function measuredSkyDirections(
  metadata: MapMetadataResponse | null | undefined,
  analysis: AnalysisResponse | null | undefined,
  timeUtc: string | null | undefined,
  slot: 'A' | 'B' = 'A',
): SkyDirections | null {
  if (!metadata || !isGlobe(metadata) || !terrainAssetKey(metadata) || metadata.projection.sourceFrame !== 'MOON_ME' ||
      !analysis || analysis.quality.ephemerisSource !== 'JPL Horizons' || !timeUtc || !Number.isFinite(Date.parse(timeUtc)) ||
      (slot !== 'A' && slot !== 'B')) return null;
  const { latitude, longitude, elevationM } = analysis.location;
  if (typeof elevationM !== 'number' || ![latitude, longitude, elevationM].every(Number.isFinite) ||
      latitude <= -90 || latitude > -80 || Math.abs(longitude) > 180) return null;
  const instant = Date.parse(timeUtc);
    const matches = analysis.samples.filter(sample => Date.parse(sample.timeUtc) === instant);
  if (matches.length !== 1) return null;
  const sample = matches[0];
  const valid = (body: BodyPosition) => body && Number.isFinite(body.azimuthDeg) && body.azimuthDeg >= 0 && body.azimuthDeg < 360 &&
    Number.isFinite(body.elevationDeg) && Math.abs(body.elevationDeg) <= 90;
  if (!valid(sample.sun) || !valid(sample.earth)) return null;
  const rad = Math.PI / 180, phi = latitude * rad, lambda = longitude * rad;
  const direction = (body: BodyPosition): [number, number, number] => {
    const az = body.azimuthDeg * rad, el = body.elevationDeg * rad;
    const n = Math.cos(el) * Math.cos(az), e = Math.cos(el) * Math.sin(az), u = Math.sin(el);
    const x = -n * Math.sin(phi) * Math.cos(lambda) - e * Math.sin(lambda) + u * Math.cos(phi) * Math.cos(lambda);
    const y = -n * Math.sin(phi) * Math.sin(lambda) + e * Math.cos(lambda) + u * Math.cos(phi) * Math.sin(lambda);
    const z = n * Math.cos(phi) + u * Math.sin(phi);
    return [y, -z, -x];
  };
  const p = sphericalForward(latitude, longitude, elevationM);
  return { origin: [p.x, p.y, p.z], sun: direction(sample.sun), earth: direction(sample.earth), timeUtc, slot };
}
