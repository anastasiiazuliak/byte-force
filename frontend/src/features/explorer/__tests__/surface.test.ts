import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fixture from '../../../../../contracts/fixtures/map-metadata-real.json';
import type { MapMetadataResponse } from '../../../api/types';
import { terrainAssetKey } from '../scene/metadata';
import { projectedToGeographic } from '../scene/projection';
import { sampleTerrainSurface, type TerrainSurface } from '../scene/surface';

function setup() {
  const metadata = structuredClone(fixture.metadata) as MapMetadataResponse;
  metadata.terrainDataset.verticalReference = 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M';
  metadata.render.sceneTransform = { originEastingM: 123, originNorthingM: 30323, verticalOriginM: 1900, validated: true };
  metadata.render.boundsMeters = { minX: -1000, maxX: 1000, minY: 29000, maxY: 32000 };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -100,-30,-100, -100,10,100, 100,-10,-100,
    100,-10,-100, -100,10,100, 100,30,100,
  ], 3));
  const material = new THREE.MeshBasicMaterial();
  const group = new THREE.Group();
  group.position.set(50, 80, -60);
  group.rotation.y = Math.PI / 2;
  group.add(new THREE.Mesh(geometry, material));
  const surface: TerrainSurface = { group, key: terrainAssetKey(metadata)! };
  const location = projectedToGeographic(173, 30403);
  return { metadata, surface, location, dispose: () => { geometry.dispose(); material.dispose(); } };
}

describe('verified GLB surface sampler', () => {
  it('samples native sloped triangles preserving GLB node transforms and vertical frame', () => {
    const {metadata, surface, location, dispose} = setup();
    const point = sampleTerrainSurface(metadata, surface, location)!;
    expect(point.x).toBeCloseTo(50, 6);
    expect(point.z).toBeCloseTo(-80, 6);
    expect(point.y).toBeCloseTo(82, 6);
    expect(point.y + metadata.render.sceneTransform!.verticalOriginM).toBeCloseTo(1982, 6);
    dispose();
  });
  it('does not invent ground for missing/stale mesh, holes or outside published coverage', () => {
    const {metadata, surface, location, dispose} = setup();
    expect(sampleTerrainSurface(metadata, null, location)).toBeNull();
    expect(sampleTerrainSurface(metadata, {...surface, key:'stale'}, location)).toBeNull();
    expect(sampleTerrainSurface(metadata, surface, projectedToGeographic(800, 31000))).toBeNull();
    expect(sampleTerrainSurface(metadata, surface, projectedToGeographic(2000, 30323))).toBeNull();
    expect(sampleTerrainSurface(metadata, surface, {latitude:NaN, longitude:0})).toBeNull();
    metadata.terrainDataset.metadataVerified = false;
    expect(sampleTerrainSurface(metadata, surface, location)).toBeNull();
    dispose();
  });
  it('rejects an empty loaded group', () => {
    const {metadata, surface, location, dispose} = setup();
    expect(sampleTerrainSurface(metadata, {...surface, group:new THREE.Group()}, location)).toBeNull();
    dispose();
  });
});
