import { isGlobe } from '../scene/spherical';
import type { Coordinates, MapMetadataResponse } from '../../../api/types';
import { geographicToProjected } from '../scene/projection';
import { terrainAssetKey, projectedWithinBounds } from '../scene/metadata';

/** Local topocentric azimuth (north through east), NOT a global Moon-fixed vector.
 * Stereographic horizontal differential scale k = sec²(colatitude/2); heights
 * remain metres. Apply k horizontally then normalize for the rendered patch.
 */
export function solarSceneDirection(
  metadata: MapMetadataResponse | null,
  location: Coordinates | null,
  sun: { azimuthDeg: number; elevationDeg: number } | null,
): [number, number, number] | null {
  if (isGlobe(metadata)) return null;
  if (!terrainAssetKey(metadata) || !metadata || !location || !sun) return null;
  const { latitude, longitude } = location;
  if (![latitude, longitude, sun.azimuthDeg, sun.elevationDeg].every(Number.isFinite) || latitude <= -90 || latitude > -80 || Math.abs(longitude) > 180 || Math.abs(sun.elevationDeg) > 90) return null;
  const point = geographicToProjected(latitude, longitude);
  if (!projectedWithinBounds(metadata, point.x, point.y)) return null;
  const rad = Math.PI / 180;
  const lon = longitude * rad, az = sun.azimuthDeg * rad, el = sun.elevationDeg * rad;
  const k = 1 / Math.cos((90 + latitude) * rad / 2) ** 2;
  const north = Math.cos(az) * Math.cos(el) * k;
  const east = Math.sin(az) * Math.cos(el) * k;
  const x = north * Math.sin(lon) + east * Math.cos(lon);
  const y = Math.sin(el);
  const z = -north * Math.cos(lon) + east * Math.sin(lon);
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}
