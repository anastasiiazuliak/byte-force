import { afterEach, expect, it, vi } from 'vitest';
import { exploratoryPatches, loadSiteCatalog } from './siteCatalog';
afterEach(() => vi.unstubAllGlobals());
it('fails softly on absent catalogs with AbortSignal forwarded', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false }); vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  expect(await loadSiteCatalog(signal, null)).toEqual(exploratoryPatches);
  expect(fetcher).toHaveBeenCalledWith('/static/metadata/explorer-sites.json', { signal });
});
it('never promotes static flags without reviewed runtime metadata', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schemaVersion: 1, sites: exploratoryPatches.map(p => ({ ...p, metadata: { assets: { demoMeshUrl: 'https://foreign/terrain.glb' }, terrainDataset: { metadataVerified: true } } })) }) }));
  expect(await loadSiteCatalog(new AbortController().signal, null)).toEqual(exploratoryPatches);
});
it('rejects malformed catalogs rather than publishing coordinates', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schemaVersion: 1, sites: [] }) }));
  expect(await loadSiteCatalog(new AbortController().signal, null)).toEqual(exploratoryPatches);
});

import fixture from '../../../contracts/fixtures/map-metadata-real.json';
import type { MapMetadataResponse } from '../api/types';
const origins = [[-11308.18777098865, -12258.857997599333, 1926.098388671875], [0, 3032.3358121667407, 622.2012329101562], [-36551.48529118464, 14767.758650866574, 1739.0252685546875]];
function catalog() {
  return exploratoryPatches.map((p, i) => ({ ...p, metadata: { ...fixture.metadata, assets: { terrainTemplate: null, surfaceTemplate: null, hillshadeTemplate: null, demoMeshUrl: `/static/${p.id}/terrain.glb` }, render: { ...fixture.metadata.render, sceneTransform: { originEastingM: origins[i][0], originNorthingM: origins[i][1], verticalOriginM: origins[i][2], validated: true } }, terrainDataset: { ...fixture.metadata.terrainDataset, sourceResolutionMeters: 80, metadataVerified: true, verticalReference: 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M' } } }));
}
it('accepts only reviewed local patch mappings', async () => {
  const sites = catalog();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schemaVersion: 1, sites }) }));
  const result = await loadSiteCatalog(new AbortController().signal, sites[0].metadata as MapMetadataResponse);
  expect(result[1].metadata?.assets.demoMeshUrl).toBe('/static/near-shackleton/terrain.glb');
});
it.each(['https://foreign/terrain.glb', '/static/../foreign.glb', '/static/near-shackleton/unreviewed.glb'])('rejects unsafe or unknown asset %s', async url => {
  const sites = catalog(); const reviewed = structuredClone(sites[0].metadata);
  sites[1].metadata.assets.demoMeshUrl = url;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schemaVersion: 1, sites }) }));
  expect(await loadSiteCatalog(new AbortController().signal, reviewed as MapMetadataResponse)).toEqual(exploratoryPatches);
});
