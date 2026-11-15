import { isGlobe, validGlobeMapping } from './spherical';
import type { MapMetadataResponse } from '../../../api/types';
/** The current projection implementation supports only this spherical polar CRS. */
export function canUseGeographicTerrain(metadata?: MapMetadataResponse | null): boolean {
  const projection = metadata?.projection;
  const definition = projection?.projDefinition ?? '';
  const transform = metadata?.render.sceneTransform;
  return Boolean((!isGlobe(metadata) || metadata && validGlobeMapping(metadata)) && metadata?.terrainDataset.metadataVerified && metadata.terrainDataset.verticalReference === 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M' &&
    transform?.validated && [transform.originEastingM, transform.originNorthingM, transform.verticalOriginM].every(Number.isFinite) &&
    projection?.sourceFrame && projection.linearUnit === 'm' &&
    ['+proj=stere', '+lat_0=-90', '+lon_0=0', '+R=1737400', '+units=m'].every(token => definition.split(/\s+/).includes(token)) &&
    !/\+(lat_ts|k|k_0)=/.test(definition) &&
    !definition.split(/\s+/).some(token => /^\+(x_0|y_0)=/.test(token) && Number(token.split('=')[1]) !== 0));
}

/** Identity includes URL and all reviewed mapping fields; any change invalidates old picks. */
export function terrainAssetKey(metadata?: MapMetadataResponse | null): string | null {
  if (!canUseGeographicTerrain(metadata) || metadata?.terrainDataset.verticalReference !== 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M' || !metadata?.assets?.demoMeshUrl) return null;
  if (metadata.assets.demoMeshUrl === '/static/globe/terrain.glb' && !isGlobe(metadata)) return null;
  const b = metadata.render.boundsMeters;
  if (!b || ![b.minX, b.maxX, b.minY, b.maxY].every(Number.isFinite) || b.minX >= b.maxX || b.minY >= b.maxY) return null;
  return JSON.stringify(metadata);
}

export function projectedWithinBounds(metadata: MapMetadataResponse, x: number, y: number): boolean {
  const b = metadata.render.boundsMeters;
  const tolerance = 1e-5; // Float roundoff at inclusive mesh edges, not extra coverage.
  return Boolean(b && Number.isFinite(x) && Number.isFinite(y) && x >= b.minX - tolerance && x <= b.maxX + tolerance && y >= b.minY - tolerance && y <= b.maxY + tolerance);
}
