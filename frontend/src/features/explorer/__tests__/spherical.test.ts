import { expect, it } from 'vitest';
import * as THREE from 'three';
import fixture from '../../../../../contracts/fixtures/map-metadata-real.json';
import type { MapMetadataResponse } from '../../../api/types';
import { sphericalForward, sphericalInverse } from '../scene/spherical';
import { terrainAssetKey } from '../scene/metadata';
import { sampleTerrainSurface } from '../scene/surface';
import { verifiedTerrainPick } from '../selection/verifiedPick';
import { solarSceneDirection } from '../lighting/solarSceneDirection';
import { ACTIVE_LATITUDE, GLOBE_CENTER, GLOBE_MAX_POLAR_ANGLE, globeCloseupPosition, globeFitDistance, globeOverviewPosition } from '../scene/polarGlobe';
const sha = '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a';
function globe() {
  const m = structuredClone(fixture.metadata);
  return { ...m, assets: { demoMeshUrl: '/static/globe/terrain.glb', terrainTemplate: null, surfaceTemplate: null, hillshadeTemplate: null },
    terrainDataset: { ...m.terrainDataset, metadataVerified: true, verticalReference: 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M' },
    render: { ...m.render, visualization: 'spherical-cap', sceneTransform: { validated: true, originEastingM: 0, originNorthingM: 0, verticalOriginM: 0 } },
    sphericalCap: { validated: true, radiusMeters: 1737400, frame: 'MOON_ME_DE421', sceneAxes: 'Y,-Z-R,-X', heightExaggeration: 1 },
    sphericalMesh: { algorithm: 'native-pixel-centre-spherical-cap-v1', radiusMeters: 1737400, frame: 'MOON_ME_DE421', sceneAxes: 'Y,-Z-R,-X', heightExaggeration: 1, decorativeWalls: false, vertexCount: 40001, triangleCount: 79600, sourceLocalSha256: sha, vertexSampleSha256: 'a'.repeat(64), meshLocalSha256: 'b'.repeat(64), nativeVertexSampleSha256: 'c'.repeat(64) },
    overview: { algorithm: 'native-pixel-centre-polar-rings-v1', vertexCount: 40001, triangleCount: 79600, requestedLatitudeMaxDeg: -80, vertexSampleSha256: 'c'.repeat(64) }, geoSourceReview: { sourceLocalSha256: sha } };
}
it.each([-90, -89.999999, -89.5, -80])('spherical forward/inverse at latitude %s, including seam', latitude => {
  for (const longitude of [-180, -179.999, -90, 0, 90, 179.999, 180]) {
    const p = sphericalForward(latitude, longitude, 1823);
    const g = sphericalInverse(p);
    expect(g.latitude).toBeCloseTo(latitude, 9);
    if (latitude !== -90) expect(g.longitude).toBeCloseTo(longitude, 9);
    expect(g.elevationM).toBeCloseTo(1823, 8);
  }
  expect(sphericalForward(-80, 0).y).toBeCloseTo(-26395.0099166, 2);
});
it('radially intersects actual triangles from lunar center, not projected bounds or a flat plane', () => {
  const m = globe() as MapMetadataResponse;
  // Deliberately unrelated source bounds: spherical picks must not use them.
  m.render.boundsMeters = { minX: 1, maxX: 2, minY: 1, maxY: 2 };
  const location = { latitude: -85, longitude: 180 };
  const p = sphericalForward(-85, 180, 1200);
  const normal = new THREE.Vector3(p.x, p.y + 1737400, p.z).normalize();
  const tangent = new THREE.Vector3(1, 0, 0);
  const other = new THREE.Vector3().crossVectors(normal, tangent);
  const center = new THREE.Vector3(p.x, p.y, p.z);
  const vertices = [[-1000,-1000],[1000,-1000],[0,1000]].flatMap(([a,b]) => center.clone().addScaledVector(tangent,a).addScaledVector(other,b).toArray());
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  const material = new THREE.MeshBasicMaterial(); const group = new THREE.Group(); group.add(new THREE.Mesh(geometry, material));
  const surface = { group, key: terrainAssetKey(m)! };
  const hit = sampleTerrainSurface(m, surface, location)!;
  expect(hit).not.toBeNull();
  const geo = verifiedTerrainPick(m, surface.key, hit)!;
  expect(geo.latitude).toBeCloseTo(-85, 5); expect(Math.abs(geo.longitude)).toBeCloseTo(180, 5); expect(geo.elevationM).toBeCloseTo(1200, 0);
  expect(sampleTerrainSurface(m, surface, { latitude: -84, longitude: 180 })).toBeNull();
  expect(sampleTerrainSurface(m, { ...surface, key: 'stale' }, location)).toBeNull();
  expect(solarSceneDirection(m, location, { azimuthDeg: 90, elevationDeg: 30 })).toBeNull();
  geometry.dispose(); material.dispose();
});
it('fails closed on altered asset, axes, proof or origin', () => {
  expect(terrainAssetKey(globe() as MapMetadataResponse)).not.toBeNull();
  const mutations = [ (m: ReturnType<typeof globe>) => { m.assets.demoMeshUrl = '/static/overview/terrain.glb'; },
    (m: ReturnType<typeof globe>) => { m.sphericalCap.sceneAxes = 'X,Y,Z'; },
    (m: ReturnType<typeof globe>) => { m.sphericalMesh.nativeVertexSampleSha256 = 'd'.repeat(64); },
    (m: ReturnType<typeof globe>) => { m.render.sceneTransform.originEastingM = 1; } ];
  for (const mutate of mutations) { const m = globe(); mutate(m); expect(terrainAssetKey(m as MapMetadataResponse)).toBeNull(); }
});

it('fits the whole Moon in wide and portrait viewports and keeps close-ups above the polar surface', () => {
  const center = new THREE.Vector3(...GLOBE_CENTER);
  const radius = -GLOBE_CENTER[1];
  for (const aspect of [0.45, 1, 1.8]) {
    const limiting = Math.min(THREE.MathUtils.degToRad(24), Math.atan(Math.tan(THREE.MathUtils.degToRad(24)) * aspect));
    const offset = globeOverviewPosition(globeFitDistance(48, aspect)).sub(center);
    expect(Math.asin(radius / offset.length())).toBeLessThan(limiting);
    expect(offset.angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(0.002);
  }
  const p = sphericalForward(ACTIVE_LATITUDE, 157, 2000);
  const close = globeCloseupPosition(p).sub(center);
  expect(close.length()).toBeGreaterThan(radius + 2000);
  expect(close.angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(GLOBE_MAX_POLAR_ANGLE);
});

it('restricts geographic selection to the reviewed polar area even where the visual sphere extends farther', () => {
  const metadata = globe() as MapMetadataResponse;
  const key = terrainAssetKey(metadata);
  expect(verifiedTerrainPick(metadata, key, sphericalForward(ACTIVE_LATITUDE, 50))).not.toBeNull();
  expect(verifiedTerrainPick(metadata, key, sphericalForward(ACTIVE_LATITUDE + 0.01, 50))).toBeNull();
});
