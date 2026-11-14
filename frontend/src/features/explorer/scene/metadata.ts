import type { MapMetadataResponse } from '../../../api/types';
/** The current projection implementation supports only this spherical polar CRS. */
export function canUseGeographicTerrain(metadata?: MapMetadataResponse | null): boolean {
  const projection = metadata?.projection;
  const definition = projection?.projDefinition ?? '';
  const transform = metadata?.render.sceneTransform;
  return Boolean(metadata?.terrainDataset.metadataVerified && metadata.terrainDataset.verticalReference &&
    transform?.validated && [transform.originEastingM, transform.originNorthingM, transform.verticalOriginM].every(Number.isFinite) &&
    projection?.sourceFrame && projection.linearUnit === 'm' &&
    ['+proj=stere', '+lat_0=-90', '+lon_0=0', '+R=1737400', '+units=m'].every(token => definition.split(/\s+/).includes(token)) &&
    !/\+(lat_ts|k|k_0)=/.test(definition) &&
    !definition.split(/\s+/).some(token => /^\+(x_0|y_0)=/.test(token) && Number(token.split('=')[1]) !== 0));
}
