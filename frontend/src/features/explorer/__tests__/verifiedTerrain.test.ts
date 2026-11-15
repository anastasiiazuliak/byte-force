import { describe, it, expect } from 'vitest';
import fixture from '../../../../../contracts/fixtures/map-metadata-real.json';
import type { MapMetadataResponse } from '../../../api/types';
import { solarSceneDirection } from '../lighting/solarSceneDirection';
import { terrainAssetKey } from '../scene/metadata';
import { verifiedTerrainPick } from '../selection/verifiedPick';
import { projectedToScene, projectedToGeographic } from '../scene/projection';
function metadata(): MapMetadataResponse {
  const m = structuredClone(fixture.metadata) as MapMetadataResponse;
  m.terrainDataset.verticalReference = 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M';
  m.render.boundsMeters = { minX: -400000, maxX: 400000, minY: -400000, maxY: 400000 };
  return m;
}
describe('verified terrain picking', () => {
  it('round trips centre, corners, pole and signed coordinates with translated height origin', () => {
    const m = metadata();
    for (const [x,y] of [[0,0],[-400000,-400000],[-400000,400000],[400000,-400000],[400000,400000],[-12345,23456]]) {
      const point = projectedToScene({x,y}, 2100, m.render.sceneTransform!);
      const pick = verifiedTerrainPick(m, terrainAssetKey(m), point)!;
      const expected = projectedToGeographic(x,y);
      expect(pick.latitude).toBeCloseTo(expected.latitude, 9);
      expect(pick.longitude).toBeCloseTo(expected.longitude, 9);
      expect(pick.elevationM).toBeCloseTo(2100);
    }
  });
  it('rejects stale, absent, invalid and out of bounds picks', () => {
    const m = metadata(), key = terrainAssetKey(m);
    expect(verifiedTerrainPick(m, null, {x:0,y:0,z:0})).toBeNull();
    expect(verifiedTerrainPick(m, key, {x:NaN,y:0,z:0})).toBeNull();
    expect(verifiedTerrainPick(m, key, {x:1e7,y:0,z:0})).toBeNull();
    m.render.sceneTransform!.originEastingM++;
    expect(verifiedTerrainPick(m, key, {x:0,y:0,z:0})).toBeNull();
    m.terrainDataset.metadataVerified = false;
    expect(terrainAssetKey(m)).toBeNull();
  });
});
describe('local solar direction', () => {
  it.each([[0,0,-1],[90,1,0],[180,0,1],[270,-1,0]])('cardinal azimuth %s', (az,x,z) => {
    const d = solarSceneDirection(metadata(), {latitude:-89,longitude:0}, {azimuthDeg:az,elevationDeg:0})!;
    expect(d[0]).toBeCloseTo(x); expect(d[1]).toBeCloseTo(0); expect(d[2]).toBeCloseTo(z);
  });
  it('rotates north at longitude 90 and preserves below-horizon Sun with projection scale', () => {
    const d = solarSceneDirection(metadata(), {latitude:-85,longitude:90}, {azimuthDeg:0,elevationDeg:-30})!;
    expect(d[0]).toBeGreaterThan(0); expect(d[2]).toBeCloseTo(0); expect(d[1]).toBeLessThan(0);
    const k = 1 / Math.cos(2.5 * Math.PI / 180) ** 2;
    expect(d[0] / -d[1]).toBeCloseTo(k * Math.sqrt(3));
    expect(Math.hypot(...d)).toBeCloseTo(1);
  });
  it('rejects pole, bounds, incompatible CRS/reference and nonfinite inputs', () => {
    const m = metadata(), sun = {azimuthDeg:0,elevationDeg:1};
    expect(solarSceneDirection(m,{latitude:-90,longitude:0},sun)).toBeNull();
    expect(solarSceneDirection(m,{latitude:-89,longitude:0},{...sun,elevationDeg:NaN})).toBeNull();
    m.render.boundsMeters = {minX:1,maxX:2,minY:1,maxY:2};
    expect(solarSceneDirection(m,{latitude:-89,longitude:0},sun)).toBeNull();
    m.projection!.projDefinition += ' +k=2';
    expect(terrainAssetKey(m)).toBeNull();
    const n = metadata(); n.terrainDataset.verticalReference = 'unknown';
    expect(solarSceneDirection(n,{latitude:-89,longitude:0},sun)).toBeNull();
  });
});
