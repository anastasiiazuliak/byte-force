import * as THREE from 'three';
import type { CameraPreset } from '../types';
import { geographicToScene } from './projection';
import type { GeographicCoordinates } from './projection';

export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  oblique: {
    id: 'oblique',
    name: 'South Pole Overview (Oblique)',
    description: 'Illustrative overview camera; geographic context depends on verified assets',
    position: [0, 28000, 42000],
    target: [0, 0, 0],
    fov: 48,
  },
  shackleton: {
    id: 'shackleton',
    name: 'Illustrative Close-up',
    description: 'Close-up camera preset; not a verified landing site',
    position: [-3500, 6500, 9500],
    target: [0, 1280, 0],
    fov: 45,
  },
  topDown: {
    id: 'topDown',
    name: 'Top-Down (Nadir)',
    description: 'Direct polar axis nadir view for map inspection',
    position: [0, 75000, 0.001],
    target: [0, 0, 0],
    fov: 50,
  },
  fitRegion: {
    id: 'fitRegion',
    name: 'Fit Region',
    description: 'High-altitude view encompassing full South Polar diorama',
    position: [0, 120000, 120000],
    target: [0, 0, 0],
    fov: 52,
  },
};

export const DEFAULT_CAMERA_PRESET = CAMERA_PRESETS.oblique;

export interface CameraAnimationState {
  isAnimating: boolean;
  startPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  startLookAt: THREE.Vector3;
  targetLookAt: THREE.Vector3;
  progress: number;
  durationMs: number;
  startTime: number;
}

export function createCameraAnimation(
  currentPos: THREE.Vector3,
  targetPos: [number, number, number],
  currentLookAt: THREE.Vector3,
  targetLookAt: [number, number, number],
  durationMs: number = 1000
): CameraAnimationState {
  return {
    isAnimating: true,
    startPosition: currentPos.clone(),
    targetPosition: new THREE.Vector3(...targetPos),
    startLookAt: currentLookAt.clone(),
    targetLookAt: new THREE.Vector3(...targetLookAt),
    progress: 0,
    durationMs,
    startTime: performance.now(),
  };
}

/**
 * Calculates camera target and approach position for a given lunar geographic coordinate.
 */
export function getFlyToTransform(
  location: GeographicCoordinates,
  elevationM: number = 0,
  approachDistanceM: number = 12000
): { target: [number, number, number]; position: [number, number, number] } {
  const scenePt = geographicToScene(location, elevationM);
  const target: [number, number, number] = [scenePt.x, scenePt.y, scenePt.z];

  const elevationAngleRad = (40 * Math.PI) / 180;
  const posY = scenePt.y + Math.sin(elevationAngleRad) * approachDistanceM;
  const posZ = scenePt.z + Math.cos(elevationAngleRad) * approachDistanceM;
  const posX = scenePt.x;

  return {
    target,
    position: [posX, posY, posZ],
  };
}

/**
 * Smooth cubic ease-in-out curve for natural camera flights.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
