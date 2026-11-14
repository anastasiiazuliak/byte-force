import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  TileCacheManager,
  calculateLODWithHysteresis,
  getTileKey,
  getTileBounds,
  DEFAULT_LUNAR_TILE_MANIFEST,
} from '../tiles/tileProvider';
import type { TileCoord, TileNode, TileTelemetry, TileManifest } from '../tiles/tileTypes';

export interface UseTileLoaderOptions {
  camera: THREE.Camera;
  cameraTarget?: THREE.Vector3;
  manifest?: TileManifest;
  enabled?: boolean;
}

export function useTileLoader({
  camera,
  cameraTarget = new THREE.Vector3(0, 0, 0),
  manifest = DEFAULT_LUNAR_TILE_MANIFEST,
  enabled = true,
}: UseTileLoaderOptions) {
  const [activeZoom, setActiveZoom] = useState(0);
  const [telemetry, setTelemetry] = useState<TileTelemetry>({
    activeZoom: 0,
    visibleTilesCount: 1,
    loadedTilesCount: 1,
    pendingRequestsCount: 0,
    cachedTilesCount: 1,
    memoryEstimateMB: 0.15,
  });

  const cacheManager = useMemo(() => new TileCacheManager(32, 4), []);
  const activeTilesRef = useRef<Map<string, TileNode>>(new Map());
  const lastCameraDistance = useRef(camera.position.distanceTo(cameraTarget));

  // Initialize root tile (z=0, x=0, y=0)
  useEffect(() => {
    if (!enabled) return;

    const rootCoord: TileCoord = { z: 0, x: 0, y: 0 };
    const rootKey = getTileKey(rootCoord);
    const rootBounds = getTileBounds(rootCoord, manifest);

    const rootNode: TileNode = {
      key: rootKey,
      coord: rootCoord,
      bounds: rootBounds,
      status: 'loaded',
      lastUsedTimestamp: performance.now(),
    };

    cacheManager.set(rootKey, rootNode);
    activeTilesRef.current.set(rootKey, rootNode);
  }, [enabled, cacheManager, manifest]);

  // Update LOD zoom based on camera distance
  const updateLOD = useCallback(() => {
    if (!enabled) return;

    const distance = camera.position.distanceTo(cameraTarget);
    lastCameraDistance.current = distance;

    const targetZoom = calculateLODWithHysteresis(
      distance,
      activeZoom,
      manifest.minZoom,
      manifest.maxZoom
    );

    if (targetZoom !== activeZoom) {
      setActiveZoom(targetZoom);
    }

    // Update telemetry
    const visibleKeys = new Set(activeTilesRef.current.keys());
    setTelemetry(cacheManager.getTelemetry(targetZoom, visibleKeys));
  }, [enabled, camera, cameraTarget, activeZoom, manifest, cacheManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cacheManager.clear();
      activeTilesRef.current.clear();
    };
  }, [cacheManager]);

  return {
    activeZoom,
    telemetry,
    updateLOD,
  };
}
