import * as THREE from 'three';
import type { TileCoord, TileBounds, TileManifest, TileNode, TileTelemetry } from './tileTypes';

export const DEFAULT_LUNAR_TILE_MANIFEST: TileManifest = {
  formatVersion: '1.0',
  datasetId: 'LOLA_80S_80MPP',
  attribution: 'NASA GSFC / LOLA Science Team (Barker et al., 2023)',
  crs: {
    name: 'Moon (2015) - Sphere / Ocentric / South Polar',
    projection: 'South Polar Stereographic',
    datum: 'Moon (2015) - Sphere',
    radiusMeters: 1737400.0,
    standardParallel: -90.0,
    centralMeridian: 0.0,
    falseEasting: 0.0,
    falseNorthing: 0.0,
  },
  boundsProjectedMeters: {
    minX: -304000.0,
    maxX: 304000.0,
    minY: -304000.0,
    maxY: 304000.0,
  },
  boundsGeographic: {
    minLatitude: -90.0,
    maxLatitude: -80.0,
    minLongitude: -180.0,
    maxLongitude: 180.0,
  },
  rootTileExtentsMeters: 608000.0,
  minZoom: 0,
  maxZoom: 4,
  tileGridScheme: 'XYZ',
  sceneTransform: {
    axisMapping: {
      sceneX: 'projectedX',
      sceneY: 'elevationMeters - referenceElevationMeters',
      sceneZ: '-projectedY',
    },
    verticalScale: 1.0,
    referenceElevationMeters: 0.0,
    meshLocalOrigin: 'center',
  },
  layers: {
    terrainMesh: {
      urlTemplate: '/terrain/{z}/{x}/{y}.glb',
      format: 'glb',
      hasSkirts: true,
    },
    imagery: {
      urlTemplate: '/tiles/imagery/{z}/{x}/{y}.webp',
      format: 'image/webp',
    },
    hillshade: {
      urlTemplate: '/tiles/hillshade/{z}/{x}/{y}.webp',
      format: 'image/webp',
    },
  },
};

export function getTileKey(coord: TileCoord): string {
  return `${coord.z}/${coord.x}/${coord.y}`;
}

export function parseTileKey(key: string): TileCoord {
  const parts = key.split('/').map(Number);
  return { z: parts[0], x: parts[1], y: parts[2] };
}

/**
 * Calculates projected spatial bounding box for a given tile coordinate (XYZ scheme).
 */
export function getTileBounds(coord: TileCoord, manifest: TileManifest = DEFAULT_LUNAR_TILE_MANIFEST): TileBounds {
  const { minX, maxX, minY, maxY } = manifest.boundsProjectedMeters;
  const numTiles = 1 << coord.z;
  const tileWidth = (maxX - minX) / numTiles;
  const tileHeight = (maxY - minY) / numTiles;

  const tileMinX = minX + coord.x * tileWidth;
  const tileMaxX = tileMinX + tileWidth;

  // XYZ scheme: top-to-bottom Y (y=0 is at maxY)
  const tileMaxY = maxY - coord.y * tileHeight;
  const tileMinY = tileMaxY - tileHeight;

  return {
    minX: tileMinX,
    maxX: tileMaxX,
    minY: tileMinY,
    maxY: tileMaxY,
  };
}

/**
 * Formats URL template for a specific tile.
 */
export function formatTileUrl(template: string, coord: TileCoord): string {
  return template
    .replace('{z}', String(coord.z))
    .replace('{x}', String(coord.x))
    .replace('{y}', String(coord.y));
}

/**
 * Calculates target LOD zoom with hysteresis to prevent rapid flickering near boundaries.
 */
export function calculateLODWithHysteresis(
  cameraDistanceM: number,
  currentZoom: number,
  minZoom: number = 0,
  maxZoom: number = 4
): number {
  // Distance thresholds in meters:
  // Zoom 0: > 180,000m (high orbital view)
  // Zoom 1: 90,000m - 180,000m
  // Zoom 2: 45,000m - 90,000m
  // Zoom 3: 20,000m - 45,000m
  // Zoom 4: < 20,000m (close surface inspection)
  const thresholds = [180000, 90000, 45000, 20000];
  const hysteresisFactor = 0.15; // 15% buffer zone

  let targetZoom = 0;
  for (let z = 0; z < thresholds.length; z++) {
    const threshold = thresholds[z];
    // Apply hysteresis when zooming in vs out
    const effectiveThreshold =
      currentZoom > z
        ? threshold * (1 + hysteresisFactor)
        : threshold * (1 - hysteresisFactor);

    if (cameraDistanceM < effectiveThreshold) {
      targetZoom = z + 1;
    } else {
      break;
    }
  }

  return Math.max(minZoom, Math.min(maxZoom, targetZoom));
}

/**
 * Tile cache and lifecycle manager with LRU eviction and memory bounds.
 */
export class TileCacheManager {
  private cache = new Map<string, TileNode>();
  private maxCacheSize: number;
  private maxConcurrency: number;
  private pendingRequestsCount = 0;

  constructor(maxCacheSize: number = 32, maxConcurrency: number = 4) {
    this.maxCacheSize = maxCacheSize;
    this.maxConcurrency = maxConcurrency;
  }

  public get(key: string): TileNode | undefined {
    const node = this.cache.get(key);
    if (node) {
      node.lastUsedTimestamp = performance.now();
    }
    return node;
  }

  public set(key: string, node: TileNode): void {
    node.lastUsedTimestamp = performance.now();
    this.cache.set(key, node);
    this.evictIfNeeded();
  }

  public canStartRequest(): boolean {
    return this.pendingRequestsCount < this.maxConcurrency;
  }

  public requestStarted(): void {
    this.pendingRequestsCount++;
  }

  public requestFinished(): void {
    this.pendingRequestsCount = Math.max(0, this.pendingRequestsCount - 1);
  }

  public getTelemetry(activeZoom: number, visibleKeys: Set<string>): TileTelemetry {
    let loadedCount = 0;
    let memoryBytes = 0;

    for (const node of this.cache.values()) {
      if (node.status === 'loaded' && node.mesh) {
        loadedCount++;
        // Rough estimate: ~150KB per tile geometry/texture
        memoryBytes += 150 * 1024;
      }
    }

    return {
      activeZoom,
      visibleTilesCount: visibleKeys.size,
      loadedTilesCount: loadedCount,
      pendingRequestsCount: this.pendingRequestsCount,
      cachedTilesCount: this.cache.size,
      memoryEstimateMB: Number((memoryBytes / (1024 * 1024)).toFixed(2)),
    };
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Sort by LRU timestamp
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastUsedTimestamp - b.lastUsedTimestamp
    );

    const toRemoveCount = this.cache.size - this.maxCacheSize;
    for (let i = 0; i < toRemoveCount; i++) {
      const [key, node] = entries[i];
      if (node.abortController) {
        node.abortController.abort();
      }
      if (node.mesh) {
        this.disposeMesh(node.mesh);
      }
      this.cache.delete(key);
    }
  }

  public disposeMesh(mesh: THREE.Object3D): void {
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else if (m.material) {
          m.material.dispose();
        }
      }
    });
  }

  public clear(): void {
    for (const node of this.cache.values()) {
      if (node.abortController) node.abortController.abort();
      if (node.mesh) this.disposeMesh(node.mesh);
    }
    this.cache.clear();
    this.pendingRequestsCount = 0;
  }
}
