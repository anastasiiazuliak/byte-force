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

function overviewCatalog() {
  const sites = catalog();
  const metadata = { ...structuredClone(sites[0].metadata),
    assets: { terrainTemplate: null, surfaceTemplate: null, hillshadeTemplate: null, demoMeshUrl: '/static/overview/terrain.glb' },
    render: { ...sites[0].metadata.render, boundsMeters: { minX: -303960, minY: -303960, maxX: 303960, maxY: 303960 },
      sceneTransform: { originEastingM: 0, originNorthingM: 0, verticalOriginM: 0, validated: true } },
    overview: { algorithm: 'native-pixel-centre-polar-rings-v1', vertexCount: 40001, triangleCount: 79600, requestedLatitudeMaxDeg: -80 },
    geoSourceReview: { sourceLocalSha256: '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a' } };
  return { schemaVersion: 1, sites, overview: { id: 'south-pole-overview', label: 'Overview', description: 'Coarse planar map', metadata } };
}
it('publishes the reviewed overview separately without changing native patches', async () => {
  const value = overviewCatalog(), publish = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => value }));
  const patches = await loadSiteCatalog(new AbortController().signal, value.sites[0].metadata as MapMetadataResponse, publish);
  expect(publish).toHaveBeenCalledWith(value.overview);
  expect(patches.map(p => p.id)).toEqual(exploratoryPatches.map(p => p.id));
});
it('rejects an overview with a wrong origin without losing native patches', async () => {
  const value = overviewCatalog(), publish = vi.fn(); value.overview.metadata.render.sceneTransform.originEastingM = 1;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => value }));
  const patches = await loadSiteCatalog(new AbortController().signal, value.sites[0].metadata as MapMetadataResponse, publish);
  expect(publish).not.toHaveBeenCalled(); expect(patches[1].metadata).not.toBeNull();
});

function globeCatalog() {
  const value = overviewCatalog();
  const native = 'c'.repeat(64);
  const metadata = { ...structuredClone(value.overview.metadata),
    assets: { ...value.overview.metadata.assets, demoMeshUrl: '/static/globe/terrain.glb' },
    render: { ...value.overview.metadata.render, visualization: 'spherical-cap' },
    overview: { ...value.overview.metadata.overview, vertexSampleSha256: native },
    sphericalCap: { validated: true, radiusMeters: 1737400, frame: 'MOON_ME_DE421', sceneAxes: 'Y,-Z-R,-X', heightExaggeration: 1 },
    sphericalMesh: { algorithm: 'native-pixel-centre-spherical-cap-v1', radiusMeters: 1737400, frame: 'MOON_ME_DE421', sceneAxes: 'Y,-Z-R,-X', heightExaggeration: 1, decorativeWalls: false,
      vertexCount: 40001, triangleCount: 79600, sourceLocalSha256: value.overview.metadata.geoSourceReview.sourceLocalSha256,
      vertexSampleSha256: 'a'.repeat(64), meshLocalSha256: 'b'.repeat(64), nativeVertexSampleSha256: native } };
  return { ...value, globe: { id: 'south-pole-globe', label: 'Globe', description: 'Real spherical cap', metadata } };
}
it('publishes Globe only against reviewed catalog while leaving native patches unchanged', async () => {
  const value = globeCatalog(), publish = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => value }));
  const result = await loadSiteCatalog(new AbortController().signal, value.sites[0].metadata as MapMetadataResponse, undefined, publish);
  expect(publish).toHaveBeenCalledWith(value.globe);
  expect(result.map(p => p.metadata?.assets.demoMeshUrl)).toEqual(value.sites.map(p => p.metadata.assets.demoMeshUrl));
  publish.mockClear();
  await loadSiteCatalog(new AbortController().signal, null, undefined, publish);
  expect(publish).not.toHaveBeenCalled();
});
it.each(['asset', 'axes', 'source', 'proof'])('rejects mismatched Globe %s without losing native patches', async field => {
  const value = globeCatalog(), publish = vi.fn(), m = value.globe.metadata;
  if (field === 'asset') m.assets.demoMeshUrl = '/static/overview/terrain.glb';
  if (field === 'axes') m.sphericalCap.sceneAxes = 'X,Y,Z';
  if (field === 'source') m.sphericalMesh.sourceLocalSha256 = '0'.repeat(64);
  if (field === 'proof') m.sphericalMesh.nativeVertexSampleSha256 = 'd'.repeat(64);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => value }));
  const result = await loadSiteCatalog(new AbortController().signal, value.sites[0].metadata as MapMetadataResponse, undefined, publish);
  expect(publish).not.toHaveBeenCalled(); expect(result[1].metadata).not.toBeNull();
});
