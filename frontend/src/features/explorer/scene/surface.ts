import { isGlobe, sphericalForward } from './spherical';
import { MOON_RADIUS_METERS } from './projection';
import * as THREE from 'three';
import type { Coordinates, MapMetadataResponse } from '../../../api/types';
import { terrainAssetKey, projectedWithinBounds } from './metadata';
import { geographicToProjected, projectedToScene, type ScenePoint } from './projection';

export interface TerrainSurface { group: THREE.Group; key: string }

/** Probe actual transformed triangles, never an assumed elevation plane. */
export function sampleTerrainSurface(metadata: MapMetadataResponse | null | undefined, surface: TerrainSurface | null, location: Coordinates): ScenePoint | null {
  if (!metadata || !surface || surface.key !== terrainAssetKey(metadata) ||
      ![location.latitude, location.longitude].every(Number.isFinite) ||
      location.latitude < -90 || location.latitude > -80 || Math.abs(location.longitude) > 180) return null;
  if (isGlobe(metadata)) {
    surface.group.updateWorldMatrix(true, true);
    const p = sphericalForward(location.latitude, location.longitude);
    const center = new THREE.Vector3(0, -MOON_RADIUS_METERS, 0);
    const direction = new THREE.Vector3(p.x, p.y, p.z).sub(center).normalize();
    // Probe inward from above the reviewed radial-height range; preserve front-face culling.
    const start = center.addScaledVector(direction, MOON_RADIUS_METERS + 30000);
    const ray = new THREE.Raycaster(start, direction.negate(), 0, 60000);
    const hit = ray.intersectObject(surface.group, true)[0];
    return hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null;
  }
  const projected = geographicToProjected(location.latitude, location.longitude);
  if (!projectedWithinBounds(metadata, projected.x, projected.y)) return null;
  const point = projectedToScene(projected, metadata.render.sceneTransform!.verticalOriginM, metadata.render.sceneTransform!);
  surface.group.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(surface.group);
  if (bounds.isEmpty() || ![bounds.min.y, bounds.max.y].every(Number.isFinite)) return null;
  const margin = Math.max(1, bounds.max.y - bounds.min.y);
  const ray = new THREE.Raycaster(new THREE.Vector3(point.x, bounds.max.y + margin, point.z), new THREE.Vector3(0, -1, 0), 0, bounds.max.y - bounds.min.y + margin * 2);
  const hit = ray.intersectObject(surface.group, true)[0];
  return hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null;
}
