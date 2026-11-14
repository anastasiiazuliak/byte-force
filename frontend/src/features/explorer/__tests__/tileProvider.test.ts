import { describe, it, expect } from 'vitest';
import {
  getTileKey,
  parseTileKey,
  getTileBounds,
  formatTileUrl,
  calculateLODWithHysteresis,
  TileCacheManager,
} from '../tiles/tileProvider';
import type { TileCoord, TileNode } from '../tiles/tileTypes';

describe('3D Tile Provider and LOD Hierarchy (FE3D-02)', () => {
  it('formats and parses tile keys reliably', () => {
    const coord: TileCoord = { z: 2, x: 1, y: 3 };
    const key = getTileKey(coord);
    expect(key).toBe('2/1/3');

    const parsed = parseTileKey(key);
    expect(parsed).toEqual(coord);
  });

  it('calculates spatial bounding boxes for root and child tiles', () => {
    const rootBounds = getTileBounds({ z: 0, x: 0, y: 0 });
    expect(rootBounds.minX).toBe(-304000.0);
    expect(rootBounds.maxX).toBe(304000.0);
    expect(rootBounds.minY).toBe(-304000.0);
    expect(rootBounds.maxY).toBe(304000.0);

    const childBounds = getTileBounds({ z: 1, x: 0, y: 0 });
    expect(childBounds.minX).toBe(-304000.0);
    expect(childBounds.maxX).toBe(0.0);
    expect(childBounds.maxY).toBe(304000.0);
    expect(childBounds.minY).toBe(0.0);
  });

  it('formats tile url templates correctly', () => {
    const url = formatTileUrl('/terrain/{z}/{x}/{y}.glb', { z: 3, x: 4, y: 2 });
    expect(url).toBe('/terrain/3/4/2.glb');
  });

  it('selects LOD zoom levels with hysteresis to prevent oscillation', () => {
    // High distance -> low zoom
    const lodFar = calculateLODWithHysteresis(250000, 0);
    expect(lodFar).toBe(0);

    // Medium distance -> zoom 1
    const lodMed = calculateLODWithHysteresis(120000, 0);
    expect(lodMed).toBe(1);

    // Close inspection -> zoom 3 or 4
    const lodClose = calculateLODWithHysteresis(15000, 0);
    expect(lodClose).toBe(4);

    // Hysteresis test: near threshold (90,000m)
    // If coming from zoom 1, it should remain zoom 1 with hysteresis buffer
    const lodHysteresis = calculateLODWithHysteresis(92000, 1);
    expect(lodHysteresis).toBe(1);
  });

  it('manages LRU cache size and request concurrency', () => {
    const cache = new TileCacheManager(3, 2);

    expect(cache.canStartRequest()).toBe(true);
    cache.requestStarted();
    cache.requestStarted();
    expect(cache.canStartRequest()).toBe(false);
    cache.requestFinished();
    expect(cache.canStartRequest()).toBe(true);

    const makeNode = (key: string): TileNode => ({
      key,
      coord: { z: 1, x: 0, y: 0 },
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      status: 'loaded',
      lastUsedTimestamp: performance.now(),
    });

    cache.set('0/0/0', makeNode('0/0/0'));
    cache.set('1/0/0', makeNode('1/0/0'));
    cache.set('1/0/1', makeNode('1/0/1'));
    expect(cache.get('0/0/0')).toBeDefined();

    // Adding 4th node evicts the oldest
    cache.set('1/1/0', makeNode('1/1/0'));
    expect(cache.get('1/1/0')).toBeDefined();

    const telemetry = cache.getTelemetry(1, new Set(['1/0/0', '1/1/0']));
    expect(telemetry.cachedTilesCount).toBeLessThanOrEqual(3);
  });
});
