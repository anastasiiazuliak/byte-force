import type { MapMetadataResponse } from '../../../api/types';
import { MOON_RADIUS_METERS as R, type ScenePoint } from './projection';
export function isGlobe(m?: MapMetadataResponse | null): boolean {
  return (m?.render as { visualization?: string } | undefined)?.visualization === 'spherical-cap';
}
export function sphericalForward(latitude: number, longitude: number, elevationM = 0): ScenePoint {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180, r = R + elevationM;
  return { x: r * Math.cos(lat) * Math.sin(lon), y: -r * Math.sin(lat) - R, z: -r * Math.cos(lat) * Math.cos(lon) };
}
export function sphericalInverse(p: ScenePoint) {
  const X = -p.z, Y = p.x, Z = -p.y - R;
  return { latitude: Math.atan2(Z, Math.hypot(X, Y)) * 180 / Math.PI,
    longitude: Math.hypot(X, Y) < 1e-8 ? 0 : Math.atan2(Y, X) * 180 / Math.PI,
    elevationM: Math.hypot(X, Y, Z) - R };
}
/** Source CRS is retained for provenance, not used as a spherical scene transform. */
export function validGlobeMapping(m: MapMetadataResponse): boolean {
  const v = m as MapMetadataResponse & { sphericalCap?: Record<string, unknown>; sphericalMesh?: Record<string, unknown>; overview?: Record<string, unknown>; geoSourceReview?: Record<string, unknown> };
  const c = v.sphericalCap, s = v.sphericalMesh, o = v.overview, t = m.render.sceneTransform;
  const sha = '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a';
  return Boolean(c?.validated === true && c.radiusMeters === R && c.frame === 'MOON_ME_DE421' && c.sceneAxes === 'Y,-Z-R,-X' && c.heightExaggeration === 1 &&
    t?.originEastingM === 0 && t.originNorthingM === 0 && t.verticalOriginM === 0 &&
    m.assets.demoMeshUrl === '/static/globe/terrain.glb' && m.assets.terrainTemplate === null && m.assets.surfaceTemplate === null && m.assets.hillshadeTemplate === null &&
    s?.algorithm === 'native-pixel-centre-spherical-cap-v1' && s.radiusMeters === R && s.frame === c.frame && s.sceneAxes === c.sceneAxes && s.heightExaggeration === 1 && s.decorativeWalls === false &&
    s.vertexCount === 40001 && Number(s.triangleCount) > 79000 && Number(s.triangleCount) <= 79600 && s.sourceLocalSha256 === sha &&
    /^[a-f0-9]{64}$/.test(String(s.vertexSampleSha256)) && /^[a-f0-9]{64}$/.test(String(s.meshLocalSha256)) &&
    s.nativeVertexSampleSha256 === o?.vertexSampleSha256 && o?.algorithm === 'native-pixel-centre-polar-rings-v1' && o.vertexCount === 40001 && o.triangleCount === 79600 && o.requestedLatitudeMaxDeg === -80 && v.geoSourceReview?.sourceLocalSha256 === sha);
}
