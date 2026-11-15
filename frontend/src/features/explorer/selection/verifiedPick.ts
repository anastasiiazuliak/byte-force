import { isGlobe, sphericalInverse } from '../scene/spherical';
import type { MapMetadataResponse } from '../../../api/types';
import { terrainAssetKey, projectedWithinBounds } from '../scene/metadata';
import { sceneToGeographic, sceneToProjected, type ScenePoint } from '../scene/projection';
import { ACTIVE_LATITUDE } from '../scene/polarGlobe';

export function verifiedTerrainPick(metadata: MapMetadataResponse | null | undefined, loadedAssetKey: string | null, point: ScenePoint) {
  if (!metadata || !loadedAssetKey || terrainAssetKey(metadata) !== loadedAssetKey || ![point.x, point.y, point.z].every(Number.isFinite)) return null;
  if (isGlobe(metadata)) {
    const geo = sphericalInverse(point);
    return geo.latitude >= -90 && geo.latitude <= ACTIVE_LATITUDE + 1e-7 && Math.abs(geo.elevationM) < 30000 ? geo : null;
  }
  const origin = metadata.render.sceneTransform!;
  const { projected } = sceneToProjected(point, origin);
  if (!projectedWithinBounds(metadata, projected.x, projected.y)) return null;
  const geo = sceneToGeographic(point, origin);
  return geo.latitude <= -80 && geo.latitude >= -90 ? geo : null;
}
