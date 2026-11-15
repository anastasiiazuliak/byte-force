import { describe, expect, it } from 'vitest';
import { initialDraft, LatestRequest, parseScenario, draftCoordinates } from './scenario';
import { intervalContains } from '../features/timeline/MissionTimeline';
import { canUseGeographicTerrain } from '../features/explorer/scene/metadata';
import fixture from '../../../contracts/fixtures/map-metadata-real.json';
import type { ConfigResponse, MapMetadataResponse } from '../api/types';
const valid = { ...initialDraft, latitude: '-89,5', longitude: '180', start: '2028-04-15T00:00', end: '2028-04-16T00:00' };
describe('scenario validation and request lifecycle', () => {
  it('serializes explicitly as UTC and accepts decimal comma', () => {
    expect(parseScenario(valid)).toMatchObject({ location: { latitude: -89.5, longitude: 180 }, period: { startUtc: '2028-04-15T00:00:00.000Z' } });
  });
  it.each([{ latitude: '' }, { latitude: '-79' }, { longitude: 'Infinity' }, { start: '2028-02-30T00:00' }, { end: initialDraft.start }, { step: '0' }, { step: '2.5' }, { start: '1961-12-31T23:00' }, { end: '2650-01-01T00:00' }])('rejects invalid draft %o', change => expect(() => parseScenario({ ...valid, ...change })).toThrow());
  it('counts the terminal sample in configured limits', () => {
    const config = { analysis: { minStepMinutes: 10, maxStepMinutes: 1440, maxSamples: 24 } } as ConfigResponse;
    expect(() => parseScenario(valid, config)).toThrow('Period exceeds 24 samples');
    expect(parseScenario(valid, { ...config, analysis: { ...config.analysis, maxSamples: 25 } })).toBeTruthy();
  });
  it('invalidates stale results even if transport ignores abort', () => { const latest = new LatestRequest(); const a = latest.begin(); const b = latest.begin(); expect(a.signal.aborted).toBe(true); expect(a.current()).toBe(false); expect(b.current()).toBe(true); latest.cancel(); expect(b.current()).toBe(false); });
  it('uses half-open UTC intervals across midnight', () => { expect(intervalContains('2028-04-16T00:00:00Z','2028-04-15T23:00:00Z','2028-04-16T00:00:00Z')).toBe(false); expect(intervalContains('2028-04-15T23:00:00Z','2028-04-15T23:00:00Z','2028-04-16T00:00:00Z')).toBe(true); });
  it('requires verified metadata and supported projection for picks', () => { const original = fixture.metadata as MapMetadataResponse; const metadata = { ...original, terrainDataset: { ...original.terrainDataset, verticalReference: 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M' } }; expect(canUseGeographicTerrain({ ...metadata, terrainDataset: { ...metadata.terrainDataset, verticalReference: 'UNREVIEWED' } })).toBe(false); expect(canUseGeographicTerrain(null)).toBe(false); expect(canUseGeographicTerrain(metadata)).toBe(true); expect(canUseGeographicTerrain({ ...metadata, terrainDataset: { ...metadata.terrainDataset, metadataVerified: false } })).toBe(false); expect(canUseGeographicTerrain({ ...metadata, projection: { ...metadata.projection, projDefinition: '+proj=stere +lat_0=-90 +lon_0=45 +R=1737400 +units=m' } })).toBe(false); });
});

it('keeps spatial coordinates valid independently of an incomplete date edit', () => {
  expect(draftCoordinates({ latitude: '-89.45', longitude: '-137.31' })).toEqual({ latitude: -89.45, longitude: -137.31 });
  expect(draftCoordinates({ latitude: '', longitude: '0' })).toBeNull();
});
