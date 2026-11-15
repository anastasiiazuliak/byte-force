import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import fixture from '../../../../../contracts/fixtures/map-metadata-real.json';
import type { AnalysisResponse, MapMetadataResponse } from '../../../api/types';
import { measuredSkyDirections, skyBodyPosition, SKY_MARKER_DISPLAY_DISTANCE } from '../scene/skyDirections';
import { sphericalForward } from '../scene/spherical';
const sha = '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a';
function globe() {
  const m = structuredClone(fixture.metadata);
  return { ...m, assets: { demoMeshUrl: '/static/globe/terrain.glb', terrainTemplate: null, surfaceTemplate: null, hillshadeTemplate: null },
    terrainDataset: { ...m.terrainDataset, metadataVerified: true, verticalReference: 'HORIZONS_LUNAR_REFERENCE_SPHERE_1737400M' },
    render: { ...m.render, visualization: 'spherical-cap', sceneTransform: { validated: true, originEastingM: 0, originNorthingM: 0, verticalOriginM: 0 } },
    sphericalCap: { validated: true, radiusMeters: 1737400, frame: 'MOON_ME_DE421', sceneAxes: 'Y,-Z-R,-X', heightExaggeration: 1 },
    sphericalMesh: { algorithm: 'native-pixel-centre-spherical-cap-v1', radiusMeters: 1737400, frame: 'MOON_ME_DE421', sceneAxes: 'Y,-Z-R,-X', heightExaggeration: 1, decorativeWalls: false, vertexCount: 40001, triangleCount: 79600, sourceLocalSha256: sha, vertexSampleSha256: 'a'.repeat(64), meshLocalSha256: 'b'.repeat(64), nativeVertexSampleSha256: 'c'.repeat(64) },
    overview: { algorithm: 'native-pixel-centre-polar-rings-v1', vertexCount: 40001, triangleCount: 79600, requestedLatitudeMaxDeg: -80, vertexSampleSha256: 'c'.repeat(64) }, geoSourceReview: { sourceLocalSha256: sha } };
}

const time = '2026-11-14T00:00:00Z';
function analysis(az = 0, el = 0): AnalysisResponse {
  return { location: { latitude: -85, longitude: 0, elevationM: 1200 },
    quality: { ephemerisSource: 'JPL Horizons' },
    samples: [{ timeUtc: time, sun: { azimuthDeg: az, elevationDeg: el }, earth: { azimuthDeg: 90, elevationDeg: 0 } }],
  } as AnalysisResponse;
}
function measured(a = analysis(), m = globe() as MapMetadataResponse, t = time) {
  return measuredSkyDirections(m, a, t)!;
}
it('converts cardinal azimuths and zenith into an orthonormal scene ENU basis with the reviewed axis signs', () => {
  const north = new Vector3(...measured().sun);
  const east = new Vector3(...measured(analysis(90)).sun);
  const up = new Vector3(...measured(analysis(0, 90)).sun);
  const phi = -85 * Math.PI / 180;
  expect(north.x).toBeCloseTo(0); expect(north.y).toBeCloseTo(-Math.cos(phi)); expect(north.z).toBeCloseTo(Math.sin(phi));
  expect(east.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-12);
  expect(up.distanceTo(new Vector3(0, -Math.sin(phi), -Math.cos(phi)))).toBeLessThan(1e-12);
  for (const v of [north, east, up]) expect(v.length()).toBeCloseTo(1, 12);
  expect(north.dot(east)).toBeCloseTo(0); expect(north.dot(up)).toBeCloseTo(0); expect(east.dot(up)).toBeCloseTo(0);
  expect(new Vector3(...measured(analysis(180)).sun).distanceTo(north.clone().negate())).toBeLessThan(1e-12);
  expect(new Vector3(...measured(analysis(270)).sun).distanceTo(east.clone().negate())).toBeLessThan(1e-12);
  expect(new Vector3(...measured(analysis(0, -90)).sun).distanceTo(up.clone().negate())).toBeLessThan(1e-12);
  const p = sphericalForward(-85, 0, 1200);
  expect(measured().origin).toEqual([p.x, p.y, p.z]);
});
it('is continuous across the longitude seam', () => {
  const a = analysis(37, -12), b = analysis(37, -12);
  a.location.longitude = -180; b.location.longitude = 180;
  expect(new Vector3(...measured(a).sun).distanceTo(new Vector3(...measured(b).sun))).toBeLessThan(1e-12);
});
it('uses only the exact cached sample and preserves selected slot', () => {
  expect(measuredSkyDirections(globe() as MapMetadataResponse, analysis(), time, 'B')?.slot).toBe('B');
  expect(measured().timeUtc).toBe(time);
  expect(measured(analysis(), globe() as MapMetadataResponse, '2026-11-14T00:01:00Z')).toBeNull();
});
it('matches normalized ISO representations of the exact instant without interpolation', () => {
  for (const timestamp of ['2026-11-14T00:00:00.000Z', '2026-11-14T01:00:00+01:00']) {
    expect(measured(analysis(), globe() as MapMetadataResponse, timestamp)?.sun).toEqual(measured().sun);
    const a = analysis();
    a.samples[0].timeUtc = timestamp;
    expect(measured(a)?.earth).toEqual(measured().earth);
  }
  expect(measured(analysis(), globe() as MapMetadataResponse, '2026-11-14T00:00:00.001Z')).toBeNull();
});
it('rejects duplicate samples for the same instant and noncanonical azimuths', () => {
  const a = analysis();
  a.samples.push({ ...a.samples[0], timeUtc: '2026-11-14T00:00:00.000Z' });
  expect(measured(a)).toBeNull();
  for (const az of [-1, 360, 361]) expect(measured(analysis(az))).toBeNull();
  const b = analysis(); b.samples[0].earth.azimuthDeg = 360;
  expect(measured(b)).toBeNull();
});
it('view-space sunlight keeps the same world-space normal illumination during orbit', () => {
  const light = new Vector3(...measured(analysis(35, 18)).sun);
  const normal = new Vector3(0.3, 0.5, -0.2).normalize();
  const expected = normal.dot(light);
  const camera = new PerspectiveCamera();
  for (const position of [[0, 4e6, 6e6], [6e6, 4e6, 0]]) {
    camera.position.fromArray(position); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const viewLight = light.clone().transformDirection(camera.matrixWorldInverse);
    const viewNormal = normal.clone().transformDirection(camera.matrixWorldInverse);
    expect(viewNormal.dot(viewLight)).toBeCloseTo(expected, 12);
  }
});
it('rejects synthetic, missing height/frame, unverified terrain and stale or invalid samples', () => {
  for (const mutate of [
    (a: AnalysisResponse) => { a.quality.ephemerisSource = 'synthetic JPL Horizons'; },
    (a: AnalysisResponse) => { a.location.elevationM = null; },
    (a: AnalysisResponse) => { a.location.latitude = -90; },
    (a: AnalysisResponse) => { a.location.latitude = -79; },
    (a: AnalysisResponse) => { a.location.longitude = 181; },
    (a: AnalysisResponse) => { a.samples[0].sun.elevationDeg = NaN; },
    (a: AnalysisResponse) => { a.samples[0].earth.azimuthDeg = Infinity; },
    (a: AnalysisResponse) => { a.samples = []; },
  ]) { const a = analysis(); mutate(a); expect(measured(a)).toBeNull(); }
  for (const mutate of [
    (m: MapMetadataResponse) => { m.projection.sourceFrame = null; },
    (m: MapMetadataResponse) => { m.projection.sourceFrame = 'J2000'; },
    (m: MapMetadataResponse) => { m.terrainDataset.metadataVerified = false; },
    (m: MapMetadataResponse) => { m.assets.demoMeshUrl = '/stale.glb'; },
  ]) { const m = globe() as MapMetadataResponse; mutate(m); expect(measured(analysis(), m)).toBeNull(); }
});
it('camera orbit changes image projection, never the world marker tuple', () => {
  const d = measured(analysis(90, 25));
  const position = skyBodyPosition(d.origin, d.sun), saved = [...position];
  expect(new Vector3(...position).distanceTo(new Vector3(...d.origin))).toBeCloseTo(SKY_MARKER_DISPLAY_DISTANCE, 6);
  const camera = new PerspectiveCamera(48, 1.5, 1, 1e8);
  camera.position.set(0, 4e6, 6e6); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const first = new Vector3(...position).project(camera);
  camera.position.set(6e6, 4e6, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const second = new Vector3(...position).project(camera);
  expect(first.distanceTo(second)).toBeGreaterThan(0.1);
  expect(position).toEqual(saved); expect(skyBodyPosition(d.origin, d.sun)).toEqual(saved);
});
