import type { MapMetadataResponse } from '../../../api/types';
import { terrainAssetKey, projectedWithinBounds } from '../scene/metadata';
import { sceneToGeographic, sceneToProjected, type ScenePoint } from '../scene/projection';

export function verifiedTerrainPick(metadata: MapMetadataResponse | null | undefined, loadedAssetKey: string | null, point: ScenePoint) {
  if (!metadata || !loadedAssetKey || terrainAssetKey(metadata) !== loadedAssetKey || ![point.x, point.y, point.z].every(Number.isFinite)) return null;
  const origin = metadata.render.sceneTransform!;
  const { projected } = sceneToProjected(point, origin);
  if (!projectedWithinBounds(metadata, projected.x, projected.y)) return null;
  return sceneToGeographic(point, origin);
}
