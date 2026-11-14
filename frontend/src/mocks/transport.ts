import analysis from '../../../contracts/fixtures/analyze-partial.json';
import metadata from '../../../contracts/fixtures/map-metadata-unverified.json';
import type { AnalysisRequest, CompareRequest, ConfigResponse, LandingSitesResponse } from '../api/types';
import type { Transport } from '../api/client';

export const mockConfig: ConfigResponse = {
  region: { id: 'synthetic-south-pole', name: 'SYNTHETIC MOCK — NOT NASA', latitudeMin: -90, latitudeMax: -80, longitudeMin: -180, longitudeMax: 180 },
  analysis: { minStepMinutes: 10, maxStepMinutes: 1440, maxSamples: 2000, maxScenarios: 2 },
  features: { terrainAnalysis: false, scenarioComparison: true, horizonProfile: false, moonFixedEphemeris: false },
};
export const mockSites: LandingSitesResponse = { sites: [{ id: 'synthetic-a', name: 'SYNTHETIC Site A', description: 'Mock interaction only; not a verified landing site.', latitude: -89.5, longitude: 25, sourceUrl: null }] };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'X-Lunar-Data': 'synthetic-mock' } });
function scenario(request: AnalysisRequest) {
  const result = structuredClone(analysis);
  result.location = { ...request.location, elevationM: null };
  result.period = request.period;
  // One fixture sample only; no invented interpolation or science calculation.
  result.samples[0].timeUtc = request.period.startUtc;
  return result;
}
/** Explicitly injected test/demo transport. Never falls through to NASA or network. */
export function createMockTransport(baseUrl = '/api/v1'): Transport {
  const prefix = new URL(baseUrl, 'http://mock.invalid').pathname.replace(/\/$/, '') + '/';
  return async (input, init) => {
    init?.signal?.throwIfAborted();
    const pathname = new URL(String(input), 'http://mock.invalid').pathname;
        const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      if (path === 'health') return reply({ status: 'ok', version: 'synthetic-mock' });
      if (path === 'config') return reply(mockConfig);
      if (path === 'landing-sites') return reply(mockSites);
      if (path === 'map/metadata') return reply(metadata);
    }
    if (method === 'POST') {
      if (path === 'analyze') return reply(scenario(JSON.parse(String(init?.body)) as AnalysisRequest));
      if (path === 'compare') {
        const request = JSON.parse(String(init?.body)) as CompareRequest;
        return reply({ scenarios: request.scenarios.map(item => ({ id: item.id, analysis: scenario(item) })), differences: { sunVisibleHours: null, earthVisibleHours: null, bothVisibleHours: null } });
      }
      if (path === 'ephemeris') return reply({ error: { code: 'EPHEMERIS_UNAVAILABLE', message: 'SYNTHETIC MOCK: no verified Moon-fixed ephemeris provided.' } }, 503);
    }
    return reply({ error: { code: 'VALIDATION_ERROR', message: 'Unsupported mock route or method.' } }, 404);
  };
}
