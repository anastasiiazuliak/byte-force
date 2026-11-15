import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { boundaryWall, createDisplayPlinth, displayEdgeRaycast, DISPLAY_EDGE_LABEL } from '../scene/displayPlinth';
import type { MapMetadataResponse } from '../../../api/types';
import { terrainAssetKey } from '../scene/metadata';

function verifiedMetadata(): MapMetadataResponse {
  const sha = '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a';
  const common = { radiusMeters: 1737400, frame: 'MOON_ME_DE421', sceneAxes: 'Y,-Z-R,-X', heightExaggeration: 1 };
  return {
    render: { visualization: 'spherical-cap', sceneTransform: { validated: true, originEastingM: 0, originNorthingM: 0, verticalOriginM: 0 }, boundsMeters: { minX: -310000, maxX: 310000, minY: -310000, maxY: 310000 } },
    assets: { demoMeshUrl: '/static/globe/terrain.glb', terrainTemplate: null, surfaceTemplate: null, hillshadeTemplate: null },
    terrainDataset: { metadataVerified: true, verticalReference: 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M' },
    projection: { sourceFrame: 'MOON_ME_DE421', linearUnit: 'm', projDefinition: '+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m' },
    sphericalCap: { ...common, validated: true },
    sphericalMesh: { ...common, rings: 100, sectors: 400, algorithm: 'native-pixel-centre-spherical-cap-v1', decorativeWalls: false, vertexCount: 40001, triangleCount: 79600, sourceLocalSha256: sha, vertexSampleSha256: sha, meshLocalSha256: sha, nativeVertexSampleSha256: sha },
    overview: { rings: 100, sectors: 400, algorithm: 'native-pixel-centre-polar-rings-v1', vertexCount: 40001, triangleCount: 79600, requestedLatitudeMaxDeg: -80, vertexSampleSha256: sha },
    geoSourceReview: { sourceLocalSha256: sha },
  } as unknown as MapMetadataResponse;
}

function cap() {
  const positions = [0, 0, 0], indices: number[] = [];
  for (let r = 1; r <= 100; r++) for (let j = 0; j < 400; j++) {
    const angle = j * Math.PI / 200;
    positions.push(r * 3000 * Math.cos(angle), -r * r, r * 3000 * Math.sin(angle));
  }
  for (let j = 0; j < 400; j++) indices.push(0, 1 + j, 1 + (j + 1) % 400);
  for (let r = 1; r < 100; r++) for (let j = 0; j < 400; j++) {
    const a = 1 + (r - 1) * 400 + j, b = 1 + (r - 1) * 400 + (j + 1) % 400;
    indices.push(a, a + 400, b, b, a + 400, b + 400);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  return geometry;
}

describe('decorative display edge', () => {
  it('copies only the actual perimeter, preserves heights and input, and adds a flat 5km-lower edge', () => {
    const source = cap(), before = source.getAttribute('position').array.slice();
    const matrix = new THREE.Matrix4().makeTranslation(10, 20, 30);
    const wall = boundaryWall(source, matrix)!;
    expect(wall.getAttribute('position').count).toBe(800);
    expect(wall.index!.count / 3).toBe(800);
    const p = wall.getAttribute('position');
    for (let i = 0; i < 800; i += 2) {
      expect(p.getY(i)).toBe(-9980);
      expect(p.getY(i + 1)).toBe(-14980);
      expect(Math.hypot(p.getX(i) - 10, p.getZ(i) - 30)).toBeCloseTo(300000, 0);
    }
    expect(source.getAttribute('position').array).toEqual(before);
    expect(source.attributes.normal).toBeUndefined();
    wall.dispose(); source.dispose();
  });
  it('fails closed for invalid counts and broken topology', () => {
    expect(boundaryWall(new THREE.PlaneGeometry(), new THREE.Matrix4())).toBeNull();
    const source = cap();
    // Break an outer-ring face, not an allowed internal hole.
    source.index!.setX(source.index!.count - 1, 0);
    expect(boundaryWall(source, new THREE.Matrix4())).toBeNull();
  });
  it('ignores internal holes but rejects a broken outer perimeter', () => {
    const source = cap();
    source.setIndex(Array.from(source.index!.array).slice(3));
    const wall = boundaryWall(source, new THREE.Matrix4());
    expect(wall?.getAttribute('position').count).toBe(800);
    wall?.dispose();
  });
  it('fails closed for non-Globe, missing proof, absent or stale surfaces', () => {
    const surface = { group: new THREE.Group(), key: 'stale' };
    expect(createDisplayPlinth(null, surface)).toBeNull();
    expect(createDisplayPlinth({ render: {} } as MapMetadataResponse, surface)).toBeNull();
    const unverified = { render: { visualization: 'spherical-cap' } } as unknown as MapMetadataResponse;
    expect(createDisplayPlinth(unverified, surface)).toBeNull();
    expect(createDisplayPlinth(unverified, null)).toBeNull();
  });
  it('accepts current reviewed surfaces only, without attaching decoration or altering bounds', () => {
    const metadata = verifiedMetadata(), group = new THREE.Group();
    group.add(new THREE.Mesh(cap()));
    const key = terrainAssetKey(metadata)!;
    expect(key).not.toBeNull();
    const before = new THREE.Box3().setFromObject(group);
    const wall = createDisplayPlinth(metadata, { group, key });
    expect(wall).not.toBeNull();
    expect(group.children).toHaveLength(1);
    expect(new THREE.Box3().setFromObject(group)).toEqual(before);
    expect(createDisplayPlinth(metadata, { group, key: 'stale' })).toBeNull();
    const brokenProof = { ...metadata, sphericalCap: { validated: false } };
    expect(createDisplayPlinth(brokenProof, { group, key })).toBeNull();
    const foreignProof = { ...metadata, sphericalMesh: { algorithm: 'foreign-ring-layout' } };
    const foreignLayout = { ...metadata, overview: { ...(metadata as unknown as { overview: object }).overview, rings: 99 } };
    expect(createDisplayPlinth(foreignLayout, { group, key: terrainAssetKey(foreignLayout)! })).toBeNull();
    expect(createDisplayPlinth(foreignProof, { group, key: terrainAssetKey(foreignProof) ?? 'invalid' })).toBeNull();
    wall?.dispose();
  });
  const asset = resolve('../.validation/runtime-assets/static/globe/terrain.glb');
  const metadataFile = resolve('../.validation/runtime-assets/metadata/globe-map.json');
  it.skipIf(!existsSync(asset) || !existsSync(metadataFile))('extracts only the real GLB outer ring despite 592 internal boundary edges', async () => {
    const bytes = readFileSync(asset);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8')).metadata as MapMetadataResponse;
    let geometry: THREE.BufferGeometry | undefined;
    gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) geometry = (o as THREE.Mesh).geometry; });
    const source = geometry!;
    const edges = new Map<string, number>();
    const index = source.index!;
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3);
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    const boundary = [...edges].filter(([, count]) => count === 1);
    expect(boundary).toHaveLength(992);
    expect(boundary.filter(([key]) => key.split(':').every(i => Number(i) >= 39601))).toHaveLength(400);
    const positionsBefore = source.getAttribute('position').array.slice();
    const indicesBefore = source.index!.array.slice();
    const key = terrainAssetKey(metadata);
    expect(key).not.toBeNull();
    const wall = createDisplayPlinth(metadata, { group: gltf.scene, key: key! });
    expect(wall).not.toBeNull();
    expect(wall!.getAttribute('position').count).toBe(800);
    expect(wall!.index!.count / 3).toBe(800);
    const p = source.getAttribute('position'), w = wall!.getAttribute('position');
    const bottom = Math.min(...Array.from({ length: 400 }, (_, i) => p.getY(39601 + i))) - 5000;
    for (let i = 0; i < 400; i++) {
      const top = [w.getX(i * 2), w.getY(i * 2), w.getZ(i * 2)];
      expect(Array.from({ length: 400 }, (_, j) => 39601 + j).some(j =>
        p.getX(j) === top[0] && p.getY(j) === top[1] && p.getZ(j) === top[2])).toBe(true);
      expect(w.getY(i * 2 + 1)).toBeCloseTo(bottom, 2);
    }
    expect(source.getAttribute('position').array).toEqual(positionsBefore);
    expect(source.index!.array).toEqual(indicesBefore);
    console.info(`Real Globe: ${p.count} terrain vertices, ${index.count / 3} terrain triangles; ${boundary.length} boundary edges (400 outer, 592 internal); display 800 vertices / 800 triangles.`);
    wall!.dispose();
  });
  it('cannot raycast and explicitly disclaims lunar interior', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.raycast = displayEdgeRaycast;
    const hits: THREE.Intersection[] = [];
    mesh.raycast(new THREE.Raycaster(), hits);
    expect(hits).toEqual([]);
    expect(DISPLAY_EDGE_LABEL).toBe('Display edge · not lunar interior');
  });
});
