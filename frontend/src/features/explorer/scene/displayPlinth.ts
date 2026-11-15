import * as THREE from 'three';
import type { MapMetadataResponse } from '../../../api/types';
import type { TerrainSurface } from './surface';
import { terrainAssetKey } from './metadata';
import { isGlobe, validGlobeMapping } from './spherical';

export const DISPLAY_EDGE_LABEL = 'Display edge · not lunar interior';
export const displayEdgeRaycast: THREE.Mesh['raycast'] = () => {};

/** Reviewed native layout: pole + 100 ordered rings of 400 samples.
 * Internal holes from removed degenerate faces are not display edges.
 * Caller must validate the Globe proof before using this layout-specific helper.
 */
export function boundaryWall(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry | null {
  const p = geometry.getAttribute('position'), index = geometry.getIndex();
  if (!p || p.count !== 40001 || !index || index.count % 3 || index.count < 79000 * 3 || index.count > 79600 * 3) return null;
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (new Set(triangle).size !== 3 || triangle.some(v => !Number.isInteger(v) || v < 0 || v >= p.count)) return null;
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key);
      if (edge) { if (++edge.count > 2) return null; }
      else edges.set(key, { a, b, count: 1 });
    }
  }
  const outerStart = 39601;
  const boundary = [...edges.values()].filter(e => e.count === 1 && (e.a >= outerStart || e.b >= outerStart));
  // Require exactly the consecutive native outer-ring edges, including the seam.
  if (boundary.some(({ a, b }) => a < outerStart || b < outerStart ||
      !(Math.abs(a - b) === 1 || Math.abs(a - b) === 399))) return null;
  if (boundary.length !== 400) return null;
  const neighbors = new Map<number, number[]>();
  for (const { a, b } of boundary) {
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  }
  if (neighbors.size !== 400 || [...neighbors.values()].some(n => n.length !== 2)) return null;
  const ring: number[] = [];
  let current = boundary[0].a, previous = -1;
  do {
    if (ring.includes(current)) return null;
    ring.push(current);
    const next = neighbors.get(current)!.find(n => n !== previous)!;
    previous = current; current = next;
  } while (current !== ring[0]);
  if (ring.length !== 400) return null;
  const points = ring.map(i => new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix));
  if (points.some(v => ![v.x, v.y, v.z].every(Number.isFinite))) return null;
  const bottomY = Math.min(...points.map(v => v.y)) - 5000;
  const vertices: number[] = [], indices: number[] = [];
  points.forEach(v => vertices.push(v.x, v.y, v.z, v.x, bottomY, v.z));
  for (let i = 0; i < 400; i++) {
    const a = i * 2, b = ((i + 1) % 400) * 2;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  wall.setIndex(indices); wall.computeVertexNormals();
  return wall;
}

export function createDisplayPlinth(metadata: MapMetadataResponse | null | undefined, surface: TerrainSurface | null): THREE.BufferGeometry | null {
  if (!metadata || !isGlobe(metadata) || !validGlobeMapping(metadata) || !surface || surface.key !== terrainAssetKey(metadata)) return null;
  const layout = metadata as MapMetadataResponse & {
    sphericalMesh?: { rings?: number; sectors?: number };
    overview?: { rings?: number; sectors?: number };
  };
  if (layout.sphericalMesh?.rings !== 100 || layout.sphericalMesh.sectors !== 400 ||
      layout.overview?.rings !== 100 || layout.overview.sectors !== 400) return null;
  const meshes: THREE.Mesh[] = [];
  surface.group.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  if (meshes.length !== 1) return null;
  // Compute world transforms without updating/mutating the loaded scientific objects.
  const chain: THREE.Object3D[] = [];
  for (let o: THREE.Object3D | null = meshes[0]; o; o = o.parent) chain.unshift(o);
  const matrix = new THREE.Matrix4();
  for (const o of chain) matrix.multiply(o.matrixAutoUpdate ? new THREE.Matrix4().compose(o.position, o.quaternion, o.scale) : o.matrix);
  const proof = metadata as MapMetadataResponse & { sphericalMesh?: { triangleCount?: number } };
  if (meshes[0].geometry.index?.count !== Number(proof.sphericalMesh?.triangleCount) * 3) return null;
  return boundaryWall(meshes[0].geometry, matrix);
}
