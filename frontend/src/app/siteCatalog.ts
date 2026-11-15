import { canUseGeographicTerrain } from '../features/explorer/scene/metadata';
import type { MapMetadataResponse } from '../api/types';
export interface ExploratoryPatch { id: string; label: string; latitude: number; longitude: number; description: string; metadata: MapMetadataResponse | null }
export const exploratoryPatches: ExploratoryPatch[] = [
  { id: 'connecting-ridge', label: 'Connecting ridge', latitude: -89.45, longitude: -137.31, description: 'Exploratory coordinates, not an approved landing site.', metadata: null },
  { id: 'near-shackleton', label: 'Near Shackleton', latitude: -89.9, longitude: 0, description: 'Exploratory coordinates, not an approved landing site.', metadata: null },
  { id: 'near-de-gerlache', label: 'Near de Gerlache', latitude: -88.7, longitude: -68, description: 'Exploratory coordinates, not an approved landing site.', metadata: null },
];
/** A static catalog may select assets, never elevate their scientific approval. */
export async function loadSiteCatalog(signal: AbortSignal, reviewed: MapMetadataResponse | null): Promise<ExploratoryPatch[]> {
  try {
    const response = await fetch('/static/metadata/explorer-sites.json', { signal });
    if (!response.ok) return exploratoryPatches;
    const value = await response.json();
    if (value.schemaVersion !== 1 || !Array.isArray(value.sites) || value.sites.length !== 3) return exploratoryPatches;
    const root = reviewed?.assets.demoMeshUrl?.match(/^(\/[^?#]*?)connecting-ridge\/terrain\.glb$/)?.[1];
    return exploratoryPatches.map(expected => {
      const site = value.sites.find((s: ExploratoryPatch) => s.id === expected.id);
      const m = site?.metadata as MapMetadataResponse | undefined;
      if (!site || site.latitude !== expected.latitude || site.longitude !== expected.longitude || typeof site.label !== 'string' || typeof site.description !== 'string' || !m) throw new Error('Invalid patch');
      if (!root || !canUseGeographicTerrain(reviewed) || !reviewed) return expected;
      if (!canUseGeographicTerrain(m) || m.terrainDataset?.metadataVerified !== true || m.render?.sceneTransform?.validated !== true || m.terrainDataset.id !== reviewed.terrainDataset.id || JSON.stringify(m.projection) !== JSON.stringify(reviewed.projection) || m.terrainDataset.verticalReference !== reviewed.terrainDataset.verticalReference) throw new Error('Unreviewed metadata');
      if (!Object.values(m.assets).every(url => url === null || typeof url === 'string' && url.startsWith(root) && !/[\\?#%]/.test(url) && !url.includes('..') && !url.includes('//'))) throw new Error('Unsafe asset');
      const origins: Record<string, number[]> = { 'connecting-ridge': [-11308.18777098865, -12258.857997599333, 1926.098388671875], 'near-shackleton': [0, 3032.3358121667407, 622.2012329101562], 'near-de-gerlache': [-36551.48529118464, 14767.758650866574, 1739.0252685546875] };
      const t = m.render.sceneTransform!;
      const bounds = m.render.boundsMeters;
      if (m.regionId !== reviewed.regionId || m.render.type !== 'projected-terrain' || !Number.isInteger(m.render.tileSize) || m.render.tileSize <= 0 || !Number.isInteger(m.render.minZoom) || !Number.isInteger(m.render.maxZoom) || m.render.minZoom < 0 || m.render.maxZoom < m.render.minZoom || !bounds || !Object.values(bounds).every(Number.isFinite) || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY || !['terrainTemplate', 'surfaceTemplate', 'hillshadeTemplate', 'demoMeshUrl'].every(key => key in m.assets)) throw new Error('Invalid shape');
      if (m.assets.demoMeshUrl !== `${root}${expected.id}/terrain.glb` || m.assets.surfaceTemplate !== null || m.assets.hillshadeTemplate !== null || m.terrainDataset.sourceResolutionMeters !== 80 || ![t.originEastingM, t.originNorthingM, t.verticalOriginM].every((n, i) => n === origins[expected.id][i])) throw new Error('Unreviewed patch mapping');
      if (!m.assets.demoMeshUrl || !Object.values(m.render.sceneTransform).every(v => typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v))) throw new Error('Invalid transform');
      return { ...expected, metadata: m };
    });
  } catch { return exploratoryPatches; }
}
